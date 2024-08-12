//OLD

const { Team, Coach, Schedule, Field, Reservation, Slots } = require("../models/schema");
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

exports.generateSchedules = async (club_id, latestCreateReservation) => {
  try {
    // Fetch active teams with coaches and sort them by team name
    const teams = await Team.find({ club_id: club_id, is_active: true, coach_id: { $exists: true } }).sort({ team_name: 1 });

    // Group and sort teams by coach_id, then flatten into a single array
    const sortedTeams = Object.values(
      teams.reduce((map, team) => {
        if (!map[team.coach_id]) map[team.coach_id] = [];
        map[team.coach_id].push(team);
        return map;
      }, {})
    ).sort((a, b) => b.length - a.length).flat();

    // Extract reservation IDs and fetch corresponding reservations with populated field_id
    const reservationIds = latestCreateReservation.map(reservation => reservation._id);
    const reservations = await Reservation.find({ _id: { $in: reservationIds }, club_id: club_id, is_active: true })
      .populate('field_id');

    function chunkArray(reservations) {
      const parseDate = dateString => {
        const [month, day, year] = dateString.split('/');
        return new Date(`${year}-${month}-${day}`);
      };

      reservations.sort((a, b) => {
        const dateComparison = parseDate(a.reservation_date) - parseDate(b.reservation_date);

        if (dateComparison !== 0) {
          return dateComparison;
        }

        // If dates are the same, sort by field_name
        return a.field_id.field_name.localeCompare(b.field_id.field_name);
      });


      const chunks = [];
      let currentChunk = [];
      let currentWeekStart = null;

      for (const reservation of reservations) {
        const date = parseDate(reservation.reservation_date);

        if (currentWeekStart === null) {
          currentWeekStart = new Date(date);
          currentChunk.push(reservation);
        } else {
          const diffDays = Math.ceil((date - currentWeekStart) / (1000 * 60 * 60 * 24));

          if (diffDays <= 6) {
            currentChunk.push(reservation);
          } else {
            chunks.push(currentChunk);
            currentChunk = [reservation];
            currentWeekStart = new Date(date);
          }
        }
      }

      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
      }

      return chunks;
    }

    const reservationChunks = chunkArray(reservations);
    let schedulesCount = sortedTeams.reduce((acc, team) => ({ ...acc, [team._id]: 0 }), {});

    for (let chunk of reservationChunks) {
      for await (const team of sortedTeams) {
        console.log(`Team Name :-`, team.team_name);
        const totalSchedulesTeamShouldGet = team.preferred_days.length;
        let skipFlags = {};

        let { totalSchedulesForTeam, schedulesToSave } = await evaluateAndCountSchedules(chunk, team, skipFlags, totalSchedulesTeamShouldGet);
        console.log(`totalSchedulesForTeam ${totalSchedulesForTeam} >= ${totalSchedulesTeamShouldGet} totalSchedulesTeamShouldGet`);

        if (totalSchedulesForTeam >= totalSchedulesTeamShouldGet) {
          await saveSchedules(schedulesToSave);
          schedulesCount[team._id] += totalSchedulesForTeam;
          continue;
        }

        for (const flag of ['skipTimingCheck', 'skipSlotAvailability', 'skipRegion']) {
          skipFlags[flag] = true;
          console.log(skipFlags, "skipFlags");

          ({ totalSchedulesForTeam, schedulesToSave } = await evaluateAndCountSchedules(chunk, team, skipFlags, totalSchedulesTeamShouldGet));
          console.log(`totalSchedulesForTeam ${totalSchedulesForTeam} >= ${totalSchedulesTeamShouldGet} totalSchedulesTeamShouldGet`);

          if (totalSchedulesForTeam >= totalSchedulesTeamShouldGet) {
            await saveSchedules(schedulesToSave);
            schedulesCount[team._id] += totalSchedulesForTeam;
            break;
          }
        }

        if (totalSchedulesForTeam < totalSchedulesTeamShouldGet) {
          await saveSchedules(schedulesToSave);
          schedulesCount[team._id] += totalSchedulesForTeam;
        }
      }

      // Optionally, re-sort teams based on schedules count if required
      // sortedTeams.sort((a, b) => schedulesCount[a._id] - schedulesCount[b._id]);
    }

    console.log("<----------------------Practice Scheduling Completed---------------------->");
  } catch (error) {
    console.error("Error generating Schedule:", error);
  }
};

async function evaluateAndCountSchedules(reservations, team, skipFlags, totalSchedulesTeamShouldGet) {
  let totalSchedulesForTeam = 0;
  let schedulesToSave = [];
  let data = {};

  // Cache team details that don't change
  const teamId = new ObjectId(team._id);
  const clubId = new ObjectId(team.club_id);
  const teamPrefferdStartTime = await convertTimeToMinutes(team.practice_start_time);
  const teamPrefferdEndTime = await convertTimeToMinutes(team.practice_end_time);
  let remainingTime = team.practice_length;

  // Fetch active coaches only once
  const coaches = await Coach.find({ club_id: team.club_id, is_active: true });

  for (let j = 0; j < reservations.length; j++) {
    const reservation = reservations[j];
    // console.log(`Processing reservation ${j}:`, reservation);
    // Stop processing if the team has already received enough schedules
    if (totalSchedulesForTeam >= totalSchedulesTeamShouldGet) {
      console.log(`Reached total schedules team should get: ${totalSchedulesForTeam} >= ${totalSchedulesTeamShouldGet}`);
      return { totalSchedulesForTeam, schedulesToSave };
    }

    // Check if a schedule already exists for the team on the reservation date
    const query = {
      team_id: teamId,
      club_id: clubId,
      schedule_date: reservation.reservation_date
    };
    const scheduleExists = await Schedule.exists(query);
    console.log(`Schedule exists for query ${JSON.stringify(query)}: ${!!scheduleExists}`);
    if (scheduleExists) continue;

    // Skip duplicate reservations
    if (data.reservation_date === reservation.reservation_date &&
      data.team_id === team._id.toString() &&
      data.club_id === team.club_id.toString()) {
      console.log(`Duplicate reservation detected for date ${data.reservation_date}, team ID ${data.team_id}`);
      continue;
    }

    const reservationDate = new Date(reservation.reservation_date);
    const reservationDay = reservationDate.toLocaleString("en-US", { weekday: "long" });

    // Find available slots for the reservation
    const findSlot = await Slots.find({ reservation_id: reservation._id, club_id: team.club_id, reservation_date: reservation.reservation_date });
    const field = await Field.findById(reservation.field_id._id);
    const hasAvailableSlot = findSlot.length > 0;
    console.log(`Field ID: ${field._id}, Has Available Slot: ${hasAvailableSlot}`);
    const reservationStartTime = await convertTimeToMinutes(reservation.reservation_start_time);
    const reservationEndTime = await convertTimeToMinutes(reservation.reservation_end_time);
    let calculatedStartTime = 0;
    let practice_ideal_start_time = 0;
    let practice_start_time = 0;
    let practice_end_time = 0;

    let isFieldPortionAvailable = false;
    let slotToUse = null;
    // If no available slots, calculate start time based on preferred or reservation times
    if (!hasAvailableSlot) {
      calculatedStartTime = (teamPrefferdStartTime >= reservationStartTime && teamPrefferdEndTime <= reservationEndTime) ? teamPrefferdStartTime : reservationStartTime;
      // calculatedStartTime = reservationStartTime
      console.log(`Calculated Start Time: ${calculatedStartTime}...11111`);
      practice_ideal_start_time = await convertMinutesToTime(calculatedStartTime);
      practice_start_time = practice_ideal_start_time
      practice_end_time = await convertMinutesToTime(calculatedStartTime + remainingTime);
      console.log(`Practice Start Time: ${practice_ideal_start_time}, End Time: ${practice_end_time},1111111111111`);
      isFieldPortionAvailable = await compareFractions(field.teams_per_field, team.preferred_field_size);
    } else {
      let conditionMet = false;
      findSlot[0].reservation_time_portion = findSlot[0].reservation_time_portion.filter(slot => parseInt((slot.remaining_portion.toString()).split('/')[0]) > 0);
      // Filter out reservation times that overlap with existing schedules
      const availableSlots = [];
      for (let slot of findSlot[0].reservation_time_portion) {
        const slotStartTime = await convertTimeToMinutes(slot.start_time);
        const slotEndTime = await convertTimeToMinutes(slot.end_time);
        let isAvailable = true;

        const coach = coaches.find(coach => coach._id.equals(team.coach_id));
        const otherTeamSchedules = await Schedule.find({
          coach_id: new ObjectId(coach._id),
          schedule_date: reservation.reservation_date,
          team_id: { $ne: new ObjectId(team._id) }
        });

        const filteredSchedulesToSave = schedulesToSave.filter(schedule => schedule.schedule_date == reservation.reservation_date);
        const allSchedules = [...otherTeamSchedules, ...filteredSchedulesToSave];

        for (let schedule of allSchedules) {
          const scheduleStartTime = await convertTimeToMinutes(schedule.practice_ideal_start_time);
          const scheduleEndTime = await convertTimeToMinutes(schedule.practice_end_time);
          // Check if slot overlaps with schedule
          if (
            (slotStartTime >= scheduleStartTime && slotStartTime < scheduleEndTime) ||
            (slotEndTime > scheduleStartTime && slotEndTime <= scheduleEndTime) ||
            (slotStartTime <= scheduleStartTime && slotEndTime >= scheduleEndTime)
          ) {
            isAvailable = false;
            break;
          }
        }
        if (isAvailable) {
          availableSlots.push(slot);
        }
      }

      for (let item of availableSlots) {
        const slotStartTime = await convertTimeToMinutes(item.start_time);
        const slotEndTime = await convertTimeToMinutes(item.end_time);
        const slotDifference = slotEndTime - slotStartTime;

        calculatedStartTime = slotStartTime;
        practice_ideal_start_time = await convertMinutesToTime(calculatedStartTime);
        practice_start_time = practice_ideal_start_time;

        if (slotDifference >= remainingTime) {
          practice_end_time = await convertMinutesToTime(calculatedStartTime + remainingTime);
          console.log(`Practice Start Time: ${practice_ideal_start_time}, End Time: ${practice_end_time}, 222222`);
          // Check if there are available slots based on current field capacity
          const schedulesForCurrentField = await Schedule.countDocuments({
            field_id: new ObjectId(field._id),
            schedule_date: reservation.reservation_date,
            practice_start_time: practice_start_time,
            practice_end_time: practice_end_time
          });
          if (Number(field.teams_per_field) > schedulesForCurrentField) {
            conditionMet = true;
            break;
          }
        }
        if (slotDifference >= team.minimum_length) {
          practice_end_time = await convertMinutesToTime(calculatedStartTime + team.minimum_length);
          console.log(`Practice Start Time: ${practice_ideal_start_time}, End Time: ${practice_end_time}, 333333`);
          // Check if there are available slots based on current field capacity
          const schedulesForCurrentField = await Schedule.countDocuments({
            field_id: new ObjectId(field._id),
            schedule_date: reservation.reservation_date,
            practice_start_time: practice_start_time,
            practice_end_time: practice_end_time
          });
          if (Number(field.teams_per_field) > schedulesForCurrentField) {
            conditionMet = true;
            break;
          }
        }
      }

      if (!conditionMet) continue;

      isFieldPortionAvailable = await checkFieldPortion(findSlot[0].reservation_time_portion, team.preferred_field_size);

      slotToUse = findSlot[0].reservation_time_portion;
    }

    let rs = {
      practice_start_time: practice_ideal_start_time,
      practice_end_time,
      reservation_date: reservation.reservation_date,
      field_id: reservation.field_id._id,
    };

    // If field portion is available, check further conditions
    if (isFieldPortionAvailable > 0) {
      const [region, prefferedDay, teamTravelling, prefferedTime, compatibleCoach] = await Promise.all([
        checkRegion(reservation, team, skipFlags),
        checkTeamsPrefferedDay(reservationDay, team, skipFlags),
        checkTeamTravelling(team, reservation),
        checkTeamPrefferedTime(reservation, team, skipFlags),
        findCompatibleCoach(team, coaches, rs, schedulesToSave)
      ]);

      // If any condition fails, continue to the next reservation
      if (!prefferedDay || teamTravelling || !region || !prefferedTime || !compatibleCoach) continue;

      // Check remaining portion of the field
      const teamsScheduled = await Schedule.countDocuments({
        field_id: new ObjectId(reservation.field_id._id),
        schedule_date: reservation.reservation_date,
        practice_start_time: practice_start_time,
        practice_end_time: practice_end_time
      });

      if (Number(field.teams_per_field) <= teamsScheduled) continue;

      const remainingPortion = 1 / field.teams_per_field * (field.teams_per_field - teamsScheduled);
      console.log(`Remaining Portion: ${remainingPortion}, Teams Scheduled: ${teamsScheduled}`);

      const reservationArray = slotToUse || [{
        start_time: reservation.reservation_start_time,
        end_time: reservation.reservation_end_time,
        remaining_portion: remainingPortion,
        coach_available: true
      }];

      // Save booked slot entry if it doesn't exist
      const bookedSlotEntry = hasAvailableSlot ? findSlot[0] : await new Slots({
        club_id: team.club_id,
        reservation_id: reservation._id,
        field_id: reservation.field_id._id,
        reservation_time_portion: reservationArray,
        reservation_date: reservation.reservation_date
      }).save();
      console.log(`Booked Slot Entry ID: ${bookedSlotEntry._id}`);

      // Check if the slot is still available
      const isSlotAvailable = await checkSlotAvailability(reservation, practice_ideal_start_time, practice_end_time, skipFlags);
      if (!isSlotAvailable) continue;

      // Save the schedule data
      const scheduleData = {
        team_id: team._id,
        club_id: team.club_id,
        coach_id: team.coach_id,
        field_id: reservation.field_id._id,
        field_portion: team.preferred_field_size,
        schedule_date: reservation.reservation_date,
        practice_ideal_start_time: practice_ideal_start_time,
        practice_start_time: practice_start_time,
        practice_end_time: practice_end_time,
        practice_length: team.practice_length,
        portion_name: teamsScheduled + 1,
        reservation: reservation,
        slot: reservationArray,
        slot_id: bookedSlotEntry._id
      };
      totalSchedulesForTeam++;
      schedulesToSave.push(scheduleData);
      data = {
        reservation_date: reservation.reservation_date,
        team_id: team._id.toString(),
        club_id: team.club_id.toString()
      };
      console.log(`Schedule saved. Total Schedules for Team: ${totalSchedulesForTeam}`);
    }
  }

  return { totalSchedulesForTeam, schedulesToSave };
}

async function saveSchedules(schedules) {
  for await (const item of schedules) {
    const query = {
      team_id: new ObjectId(item.team_id),
      club_id: new ObjectId(item.club_id),
      schedule_date: item.schedule_date
    };

    // Upsert the schedule: either update an existing schedule or create a new one
    let savedSchedule = await Schedule.findOneAndUpdate(
      query,
      {
        $set: {
          practice_ideal_start_time: item.practice_ideal_start_time,
          practice_start_time: item.practice_start_time,
          practice_end_time: item.practice_end_time,
          practice_length: item.practice_length,
          portion_name: item.portion_name,
          coach_id: item.coach_id,
          field_id: item.field_id,
          field_portion: item.field_portion
        }
      },
      { upsert: true, new: true } // upsert option to insert if no matching document is found
    );

    if (savedSchedule.isNew) {
      console.log("<-------------------Schedule Created---------------->");
    } else {
      console.log("<-------------------Schedule Updated---------------->");
    }

    const updatedReservationArray = await updateReservationArray(
      item.slot,
      item.practice_ideal_start_time,
      item.practice_end_time,
      item.field_portion
    );

    await Slots.findByIdAndUpdate(
      item.slot_id,
      { $set: { reservation_time_portion: updatedReservationArray } },
      { new: true }
    );
    console.log("<-------------------Slot Updated---------------->");
  }
}

async function updateReservationArray(reservationArray, practice_start_time, practice_end_time, field_portion) {
  let updatedReservationArray = [];

  const slots = Array.isArray(reservationArray) ? reservationArray : (reservationArray ? [reservationArray] : []);
  const practiceStartTimeMinutes = await convertTimeToMinutes(practice_start_time);
  const practiceEndTimeMinutes = await convertTimeToMinutes(practice_end_time);

  for (let slot of slots) {
    const slotStartTimeMinutes = await convertTimeToMinutes(slot.start_time);
    const slotEndTimeMinutes = await convertTimeToMinutes(slot.end_time);

    if (practiceStartTimeMinutes < slotEndTimeMinutes && practiceEndTimeMinutes > slotStartTimeMinutes) {
      if (practiceStartTimeMinutes > slotStartTimeMinutes) {
        updatedReservationArray.push({
          start_time: slot.start_time,
          end_time: practice_start_time,
          remaining_portion: slot.remaining_portion.toString(),
          coach_available: slot.coach_available
        });
      }

      const remainingPortion = await subtractPortions(slot.remaining_portion.toString(), field_portion.toString());
      const numerator = parseInt(remainingPortion.split('/')[0]);
      const denomenator = parseInt(remainingPortion.split('/')[1]);
      if (numerator > 0 && denomenator > 0) {
        updatedReservationArray.push({
          start_time: practice_start_time,
          end_time: practice_end_time,
          remaining_portion: remainingPortion.toString(),
          coach_available: slot.coach_available
        });
      }

      if (practiceEndTimeMinutes < slotEndTimeMinutes) {
        updatedReservationArray.push({
          start_time: practice_end_time,
          end_time: slot.end_time,
          remaining_portion: slot.remaining_portion.toString(),
          coach_available: slot.coach_available
        });
      }
    } else {
      updatedReservationArray.push(slot);
    }
  }
  return updatedReservationArray;
}

async function checkRegion(reservation, team, skipFlags) {
  let region = false;
  if (skipFlags && skipFlags.skipRegion) {
    region = true;
  } else {
    if (team.region.toLowerCase() == 'all' || team.region == '' || (reservation.field_id && reservation.field_id.region && (reservation.field_id.region.toLowerCase() == 'all' || reservation.field_id.region == ''))) {
      region = true;
    } else if (reservation.field_id && reservation.field_id.region &&
      team.region.toLowerCase() == reservation.field_id.region.toLowerCase()) {
      region = true;
    } else {
      region = false
    }
  }
  return region
}

async function checkTeamsPrefferedDay(reservationDay, team, skipFlags) {
  if (skipFlags && skipFlags.skipPreferredDays) {
    return true
  } else if (team.preferred_days.includes(reservationDay)) {
    return true
  } else {
    return false
  }
}

async function checkTeamTravelling(team, reservation) {
  if (team.is_travelling) {
    // Convert reservation date to milliseconds once for comparison
    const reservationStart = await convertDateToMilliseconds(reservation.reservation_date);

    for (const date of team.travelling_date) {
      const travellingStartDate = await convertDateToMilliseconds(date.travelling_start);
      const travellingEndDate = await convertDateToMilliseconds(date.travelling_end);

      // Check if the reservation date is between the travelling start and end dates
      if (reservationStart >= travellingStartDate && reservationStart <= travellingEndDate) {
        return true; // Return true if there is an overlap
      }
    }
    // If no overlap was found
    return false;
  } else {
    // Return false if the team is not travelling
    return false;
  }
}

async function checkTeamPrefferedTime(reservation, team, skipFlags) {
  if (!skipFlags.skipTimingCheck) {
    // Check if the reservation time falls within the team's preferred timing
    const reservationEndTime = await convertTimeToMinutes(reservation.reservation_end_time);
    const preferredStartHour1 = await convertTimeToMinutes(team.practice_start_time);
    const adjustedPreferredEndTime = preferredStartHour1 + team.minimum_length;
    return preferredStartHour1 <= reservationEndTime && adjustedPreferredEndTime <= reservationEndTime;
  } else {
    return true;
  }
}

async function findCompatibleCoach(team, coaches, reservation, schedulesToSave) {
  const coach = coaches.find(coach => coach._id.equals(team.coach_id));
  if (!coach) return false;

  const coachStartTime = await convertTimeToMinutes(coach.coaching_start_time);
  const coachEndTime = await convertTimeToMinutes(coach.coaching_end_time);
  const reservationStartTime = await convertTimeToMinutes(reservation.practice_start_time);
  const reservationEndTime = await convertTimeToMinutes(reservation.practice_end_time);

  if (coachStartTime <= reservationStartTime && coachEndTime >= reservationEndTime) {

    // Fetch all schedules for other teams coached by the same coach on the reservation date
    const otherTeamSchedules = await Schedule.find({
      coach_id: new ObjectId(coach._id),
      schedule_date: reservation.reservation_date,
      team_id: { $ne: new ObjectId(team._id) } // Exclude the current team's schedule
    });

    // Filter schedulesToSave to include only those with the reservation_date
    const filteredSchedulesToSave = schedulesToSave.filter(schedule => schedule.schedule_date == reservation.reservation_date);

    // Combine the filtered schedulesToSave with otherTeamSchedules
    let allSchedules = [...otherTeamSchedules, ...filteredSchedulesToSave];
    if (allSchedules.length > 0) {
      // Check for overlaps or conflicts with other schedules
      let allSchedulesPass = false;

      for (const schedule of allSchedules) {
        const scheduleStartTime = await convertTimeToMinutes(schedule.practice_ideal_start_time);
        const scheduleEndTime = await convertTimeToMinutes(schedule.practice_end_time);
        const overlaps = (
          (reservationStartTime >= scheduleStartTime && reservationStartTime < scheduleEndTime) || // Reservation starts during another schedule
          (reservationEndTime > scheduleStartTime && reservationEndTime <= scheduleEndTime) || // Reservation ends during another schedule
          (scheduleStartTime >= reservationStartTime && scheduleEndTime <= reservationEndTime) // Schedule is encompassed by the reservation
        );
        if ((reservation.field_id.toString() == schedule.field_id.toString())) {
          if (!overlaps) {
            allSchedulesPass = true;
            break; // Exit the loop early if the condition is met
          }
        }
      }
      return allSchedulesPass;
    } else {
      console.log("no schedules available")
      return true;
    }
  } else {
    console.log("Coach's timing not matched with reservation time")
    return false;
  }
}

async function checkSlotAvailability(reservation, practice_start_time, practice_end_time, skipFlags) {
  if (skipFlags?.skipSlotAvailability) {
    return true; // Skipping slot availability check
  } else {
    try {
      const slotData = await Slots.find({
        field_id: new ObjectId(reservation.field_id),
        reservation_date: reservation.reservation_date
      });
      for (let slot of slotData) {
        for (let rData of slot.reservation_time_portion) {
          const rstart_time = await convertTimeToMinutes(rData.start_time);
          const rend_time = await convertTimeToMinutes(rData.end_time);
          const pstart_time = await convertTimeToMinutes(practice_start_time);
          const pend_time = await convertTimeToMinutes(practice_end_time);
          if (rstart_time <= pstart_time && rend_time >= pend_time) {
            console.log("Slot is available")
            return true; // Slot is available
          }
        }
      }
      return false; // No available slot found
    } catch (error) {
      console.error("Error checking slot availability:", error);
      return false; // Return false in case of an error
    }
  }
}

async function checkFieldPortion(reservation_time_portion, preferred_field_size) {
  if (!reservation_time_portion) return false;

  for (let availableSlot of reservation_time_portion) {
    const fractionComparison = await compareFractions(availableSlot.remaining_portion, preferred_field_size);
    if (fractionComparison >= 0) {
      return true;
    }
  }
  return false;
}

async function compareFractions(fraction1, fraction2) {
  const normalizeFraction = (fraction) => fraction.includes('/') ? fraction : `${fraction}/1`;

  fraction1 = normalizeFraction(`${fraction1}`);
  fraction2 = normalizeFraction(`${fraction2}`);

  const [num1, denom1] = fraction1.split('/').map(Number);
  const [num2, denom2] = fraction2.split('/').map(Number);

  return (num1 * denom2) - (num2 * denom1);
}

// Function to subtract two portion strings
async function subtractPortions(existingPortion, subtractedPortion) {

  // Split and trim the strings to extract numerator and denominator
  const existingParts = existingPortion.includes('/') ? existingPortion.trim().split('/').map(Number) : [parseInt(existingPortion), 1];
  const subtractedParts = subtractedPortion.trim().split('/').map(Number);

  // Ensure subtractedParts[1] has a value, defaulting to 1 if it's undefined
  const subtractedDenominator = subtractedParts[1] || 1;

  const newNumerator = existingParts[0] * subtractedDenominator - subtractedParts[0] * existingParts[1];
  const newDenominator = existingParts[1] * subtractedDenominator;

  const gcd = await calculateGCD(newNumerator, newDenominator);
  return `${newNumerator / gcd}/${newDenominator / gcd}`;
}

// Function to calculate Greatest Common Divisor (GCD) using Euclidean algorithm
async function calculateGCD(a, b) {
  while (b !== 0) {
    let temp = b;
    b = a % b;
    a = temp;
  }
  return a;
}

// Function to convert time in minutes to "HH:MM" format
async function convertMinutesToTime(minutes) {
  // Calculate hours and minutes
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  // Format hours and minutes
  const formattedHours = String(hours).padStart(2, '0');
  const formattedMinutes = String(remainingMinutes).padStart(2, '0');

  // Construct the time string
  const timeString = `${formattedHours}:${formattedMinutes}`;
  return timeString;
}

// Function to convert time in "HH:MM" format to minutes
async function convertTimeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

async function convertDateToMilliseconds(dateString) {
  // Split the date string into month, day, and year components
  const [month, day, year] = dateString.split('/');

  // Create a new Date object using the components (months are zero-based in JavaScript)
  const date = new Date(year, month - 1, day);

  // Check if the date is valid
  if (isNaN(date.getTime())) {
    // If the date is invalid, return an error message or handle it as per your requirement
    return 0;
  }

  // Return the date in milliseconds
  return date.getTime();
}
