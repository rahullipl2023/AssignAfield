const { Team, Coach, Schedule, Field, Reservation, Slots } = require("../models/schema");
const { ObjectId } = require('mongoose').Types;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

exports.generateSchedules = async (club_id, latestCreateReservation) => {
  try {
    // Fetch all active teams
    const teams = await Team.find({ club_id: club_id, is_active: true, coach_id: { $exists: true } }).sort({ team_name: 1 });

    // Extract the reservation ids from the latestCreateReservation array
    const reservationIds = latestCreateReservation.map(reservation => reservation._id);

    // Find the reservations and populate the field_id field
    const reservations = await Reservation.find({ _id: { $in: reservationIds }, club_id: club_id, is_active: true })
      .populate('field_id');

    const chunkSize = 7; // Define the chunk size

    // Helper function to split the reservations into chunks
    const chunkArray = (array, size) => {
      const chunked = [];
      for (let i = 0; i < array.length; i += size) {
        chunked.push(array.slice(i, i + size));
      }
      return chunked;
    };

    const reservationChunks = chunkArray(reservations, chunkSize);
    for (let chunk of reservationChunks) {
      //Iterate through each team
      for await (const team of teams) {
        console.log("Team Name :- ", team.team_name)
        let skipFlags = {}; // Initialize skip flags for each team
        const totalSchedulesTeamShouldGet = team.preferred_days.length;
        // Evaluate schedules with all conditions and count
        const { totalSchedulesForTeam, schedulesToSave } = await evaluateAndCountSchedules(chunk, team, skipFlags, totalSchedulesTeamShouldGet);
        // Check if total schedules match the required count
        if (totalSchedulesForTeam >= totalSchedulesTeamShouldGet) {
          // Save schedules if total matches
          await saveSchedules(schedulesToSave);
        } else {
          // Set flags one by one until all conditions are met  //, 'skipFieldLights'
          for (const flag of ['skipTimingCheck', 'skipCoach', 'skipSlotAvailability', 'skipPreferredDays', 'skipCoachOverlap', 'skipRegion']) {

            skipFlags[flag] = true;
            const { totalSchedulesForTeam, schedulesToSave } = await evaluateAndCountSchedules(chunk, team, skipFlags, totalSchedulesTeamShouldGet);
            // If total matches, save schedules
            if (totalSchedulesForTeam >= totalSchedulesTeamShouldGet) {
              await saveSchedules(schedulesToSave);
              break;
            }
          }
          // If after setting all flags, total schedules are still less than required, save schedules
          if (totalSchedulesForTeam < totalSchedulesTeamShouldGet) {
            await saveSchedules(schedulesToSave);
          }
        }
      }
    }
    console.log("<----------------------Practice Scheduling Completed---------------------->")
  } catch (error) {
    console.log("Error generating Schedule:", error);
  }
}

async function evaluateAndCountSchedules(reservations, team, skipFlags, totalSchedulesTeamShouldGet) {
  let totalSchedulesForTeam = 0;
  let schedulesToSave = [];
  let data = {};
  try {
    for await (let reservation of reservations) {
      if (totalSchedulesForTeam >= totalSchedulesTeamShouldGet) {
        console.log("Total Schedules For Team :- ", totalSchedulesForTeam)
        console.log("Schedules To Save :- ", schedulesToSave)
        console.log("Total Schedules match the required count");
        return { totalSchedulesForTeam, schedulesToSave };
      }

      let scheduleExists = await Schedule.find({
        schedule_date: reservation.reservation_date,
        team_id: new ObjectId(team._id),
        club_id: new ObjectId(team.club_id)
      });

      if (scheduleExists && scheduleExists.length > 0) {
        console.log("Schedule Already Exits");
        continue; // Skip to the next reservation
      }
      if (
        data?.reservation_date === reservation.reservation_date &&
        data?.team_id === (team._id).toString() &&
        data?.club_id === (team.club_id).toString()
      ) {
        console.log("Reservation Already Exits");
        continue; // Skip to the next reservation
      } else {
        console.log("Reservation Date :- ", reservation.reservation_date);
        const reservationDate = new Date(reservation.reservation_date);
        const reservationDay = reservationDate.toLocaleString("en-US", { weekday: "long" });
        console.log("Reservation Day :- ", reservationDay);


        const findSlot = await Slots.find({ reservation_id: reservation._id, club_id: team.club_id, reservation_date: reservation.reservation_date });
        const hasAvailableSlot = findSlot.length > 0;
        const field = await Field.findById(reservation.field_id._id);

        const teamPrefferdStartTime = await convertTimeToMinutes(team.practice_start_time)
        const teamPrefferdEndTime = await convertTimeToMinutes(team.practice_end_time)
        const reservationStartTime = await convertTimeToMinutes(reservation.reservation_start_time);
        const reservationEndTime = await convertTimeToMinutes(reservation.reservation_end_time);
        const remainingTime = team.practice_length;
        // Check if the team's preferred start and end times fall within the reservation start and end times
        let calculatedStartTime = (teamPrefferdStartTime >= reservationStartTime && teamPrefferdEndTime <= reservationEndTime) ? teamPrefferdStartTime : reservationStartTime;
        // Calculate practice start and end times in minutes
        const practice_start_time = await convertMinutesToTime(calculatedStartTime);
        const practice_end_time = await convertMinutesToTime(calculatedStartTime + remainingTime);
        const existingSchedules = await Schedule.find({
          field_id: field._id,
          schedule_date: reservation.reservation_date,
          practice_start_time: practice_start_time,
          practice_end_time: practice_end_time
        });
        if (existingSchedules.length < Number(field.teams_per_field) + 2) {
          if (!hasAvailableSlot) {
            const isfieldPortionAvailable = await compareFractions(field.teams_per_field, team.preferred_field_size)
            if (isfieldPortionAvailable < 0) {
              continue;
            }
            const maxTeamsPerField = field.teams_per_field;
            const teamsScheduled = await Schedule.find({ field_id: reservation.field_id._id, reservation_date: reservation.reservation_date });
            const remainingPortion = 1 / maxTeamsPerField * (maxTeamsPerField - teamsScheduled.length);
            const reservationArray = [{
              start_time: reservation.reservation_start_time,
              end_time: reservation.reservation_end_time,
              remaining_portion: remainingPortion,
              coach_available: true
            }];

            const bookedSlotEntry = new Slots({
              club_id: team.club_id,
              reservation_id: reservation._id,
              field_id: reservation.field_id._id,
              reservation_time_portion: reservationArray,
              reservation_date: reservation.reservation_date
            });

            const savedSlotEntry = await bookedSlotEntry.save();
            const savedSlotId = savedSlotEntry._id;

            const region = await checkRegion(reservation, team, skipFlags);
            const prefferedDay = await checkTeamsPrefferedDay(reservationDay, team, skipFlags);
            const teamTravelling = await checkTeamTravelling(team, reservation);
            const prefferedTime = await checkTeamPrefferedTime(reservation, team, skipFlags);
            if (!region && !prefferedDay && teamTravelling && !prefferedTime) {
              continue;
            }
            const portionNeeded = team.preferred_field_size;
            const scheduleData = await schedulePractice(team, portionNeeded, reservation, reservationArray, savedSlotId, skipFlags);
            if (scheduleData && Object.keys(scheduleData).length > 0) {
              totalSchedulesForTeam++;
              schedulesToSave.push(scheduleData);
              data.reservation_date = reservation.reservation_date;
              data.team_id = team._id.toString();
              data.club_id = team.club_id.toString();
            }
          } else {
            findSlot[0].reservation_time_portion = findSlot[0].reservation_time_portion.filter(slot => parseInt((slot.remaining_portion.toString()).split('/')[0]) > 0);
            const isfieldPortionAvailable = await checkFieldPortion(findSlot[0].reservation_time_portion, team.preferred_field_size)
            if (!isfieldPortionAvailable) {
              continue;
            }
            const region = await checkRegion(reservation, team, skipFlags);
            const prefferedDay = await checkTeamsPrefferedDay(reservationDay, team, skipFlags);
            const teamTravelling = await checkTeamTravelling(team, reservation);
            const prefferedTime = await checkTeamPrefferedTime(reservation, team, skipFlags);
            if (!region && !prefferedDay && teamTravelling && !prefferedTime) {
              continue;
            }
            const portionNeeded = team.preferred_field_size;
            const scheduleData = await schedulePractice(team, portionNeeded, reservation, findSlot[0].reservation_time_portion, findSlot[0]._id, skipFlags);
            if (scheduleData && Object.keys(scheduleData).length > 0) {
              totalSchedulesForTeam++;
              schedulesToSave.push(scheduleData);
              data.reservation_date = reservation.reservation_date;
              data.team_id = team._id.toString();
              data.club_id = team.club_id.toString();
            }
          }
        } else {
          console.log("Existing Schedules are more than the Fields requirement continue....");
          continue;
        }
      }
    }
    console.log("Total Schedules For Team :- ", totalSchedulesForTeam)
    console.log("Schedules To Save :- ", schedulesToSave)
    return { totalSchedulesForTeam, schedulesToSave };
  } catch (error) {
    console.error('Error:', error);
  }
}

async function saveSchedules(schedules) {
  // Save schedules to the database
  for await (item of schedules) {

    const scheduleEntry = new Schedule({
      team_id: item.team_id,
      club_id: item.club_id,
      coach_id: item.coach_id,
      field_id: item.field_id,
      field_portion: item.field_portion,
      schedule_date: item.schedule_date,
      practice_start_time: item.practice_start_time,
      practice_end_time: item.practice_end_time,
      practice_length: item.practice_length,
      portion_name: item.portion_name
    });
    let savedSchedule = await scheduleEntry.save();
    console.log("Saved Schedule in DB :- ", savedSchedule);
    console.log("<-------------------Schedule Created---------------->")
    let rsArray = item.slot.length > 0 ? item.slot : [];
    let updatedReservationArray = await updateReservationArray(rsArray, item.practice_start_time, item.practice_end_time, item.field_portion);
    let updateSlot = await Slots.findByIdAndUpdate(item.slot_id, {
      $set: {
        reservation_time_portion: updatedReservationArray
      }
    }, { new: true });
  }
}

// Function to Schedule new practice session
async function schedulePractice(team, portionNeeded, reservation, slot, slot_id, skipFlags) {
  const teamPrefferdStartTime = await convertTimeToMinutes(team.practice_start_time)
  const teamPrefferdEndTime = await convertTimeToMinutes(team.practice_end_time)
  const reservationStartTime = await convertTimeToMinutes(reservation.reservation_start_time);
  const reservationEndTime = await convertTimeToMinutes(reservation.reservation_end_time);
  const remainingTime = team.practice_length;
  const is_lights_available = reservation.field_id.is_light_available
  // Fetch all active coaches
  const coaches = await Coach.find({ club_id: team.club_id, is_active: true });

  // Check if the team's preferred start and end times fall within the reservation start and end times
  let calculatedStartTime = (teamPrefferdStartTime >= reservationStartTime && teamPrefferdEndTime <= reservationEndTime) ? teamPrefferdStartTime : reservationStartTime;
  // Calculate practice start and end times in minutes
  const practice_start_time = await convertMinutesToTime(calculatedStartTime);
  const practice_end_time = await convertMinutesToTime(calculatedStartTime + remainingTime);
  // Find all schedules booked for the given reservation date and field
  const existingSchedules = await Schedule.find({
    field_id: reservation.field_id._id,
    schedule_date: reservation.reservation_date,
    practice_start_time: practice_start_time,
    practice_end_time: practice_end_time
  });

  // Calculate the portion name dynamically based on the number of existing schedules
  const portionName = existingSchedules.length + 1;

  let isSlotAvailable = await checkSlotAvailability(reservation, practice_start_time, practice_end_time, skipFlags)
  if (!isSlotAvailable) {
    return {}
  }
  if (remainingTime <= reservationEndTime - calculatedStartTime) {
    // const remainingPortion = parseInt(reservation.field_id.field_portion) - parseInt(portionNeeded);
    // Find a compatible coach for the team and reserved field
    let rs = {
      practice_start_time: practice_start_time,
      practice_end_time: practice_end_time,
      reservation_date: reservation.reservation_date
    }
    const compatibleCoach = await findCompatibleCoach(team, coaches, rs, skipFlags);
    // const isEveningSchedule = await checkForEveningSchedules(is_lights_available, practice_start_time, skipFlags)
    // if (compatibleCoach && isEveningSchedule) {
    if (compatibleCoach) {
      const data = {
        team_id: team._id,
        club_id: team.club_id,
        coach_id: compatibleCoach._id,
        field_id: reservation.field_id._id,
        field_portion: portionNeeded,
        schedule_date: reservation.reservation_date,
        practice_start_time: practice_start_time,
        practice_end_time: practice_end_time,
        practice_length: remainingTime,
        portion_name: portionName,
        reservation: reservation,
        slot: slot,
        slot_id: slot_id
      }
      return data
    } else {
      return {}
    }
  }
}

// Function to updated the available reservations
async function updateReservationArray(reservationArray, practice_start_time, practice_end_time, field_portion) {
  let updatedReservationArray = [];

  // Ensure reservationArray is properly initialized
  const slots = Array.isArray(reservationArray) ? reservationArray : (reservationArray ? [reservationArray] : []);
  for (let slot of slots) {
    if (slot && typeof slot.remaining_portion !== 'string') {
      slot.remaining_portion = slot.remaining_portion.toString();
    }
    if (slot && await convertTimeToMinutes(practice_start_time) < await convertTimeToMinutes(slot.end_time) && await convertTimeToMinutes(practice_end_time) > await convertTimeToMinutes(slot.start_time)) {
      if (await convertTimeToMinutes(practice_start_time) > await convertTimeToMinutes(slot.start_time)) {
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
      if (await convertTimeToMinutes(practice_end_time) < await convertTimeToMinutes(slot.end_time)) {
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
    // Check if any travelling date overlaps with the reservation date
    for (const date of team.travelling_date) {
      const travellingStartDate = await convertDateToMilliseconds(date.travelling_start);
      const travellingEndDate = await convertDateToMilliseconds(date.travelling_end);
      const reservationStart = await convertDateToMilliseconds(reservation.reservation_date);
      if (reservationStart >= travellingStartDate && reservationStart <= travellingEndDate) {
        return false; // Return false if the reservation date overlaps with any travelling date
      }
    }
  }
  return true; // Return true if there are no overlaps
}

async function checkTeamPrefferedTime(reservation, team, skipFlags) {
  if (!skipFlags.skipTimingCheck) {
    // Check if the reservation time falls within the team's preferred timing
    const reservationStartTime = await convertTimeToMinutes(reservation.reservation_start_time);
    const reservationEndTime = await convertTimeToMinutes(reservation.reservation_end_time);
    const preferredStartHour1 = await convertTimeToMinutes(team.practice_start_time);
    const adjustedPreferredEndTime = preferredStartHour1 + team.practice_length;
    return (reservationStartTime <= preferredStartHour1 && adjustedPreferredEndTime <= reservationEndTime) || (preferredStartHour1 >= reservationStartTime && adjustedPreferredEndTime <= reservationEndTime) ||
      (preferredStartHour1 <= reservationEndTime && adjustedPreferredEndTime <= reservationEndTime);
  } else {
    return true;
  }
}

// Function to find Compatible coach of team
async function findCompatibleCoach(team, coaches, reservation, skipFlags) {
  const coach = coaches.find(coach => {
    if (coach._id.equals(team.coach_id)) {
      return coach;
    }
  });
  if (coach) {
    if (skipFlags && skipFlags.skipCoach) {
      return coach
    } else {

      const isCompatible = await checkCoachAvailability(coach, reservation, team, skipFlags);
      if (isCompatible) {
        return coach;
      } else {
        return null;
      }
    }
  } else {
    return null;
  }
}

// Function to check coach's availability for the new reservation
async function checkCoachAvailability(coach, reservation, team, skipFlags) {
  const coachStartTime = await convertTimeToMinutes(coach.coaching_start_time);
  const coachEndTime = await convertTimeToMinutes(coach.coaching_end_time);
  const reservationStartTime = await convertTimeToMinutes(reservation.practice_start_time);
  const reservationEndTime = await convertTimeToMinutes(reservation.practice_end_time);

  // Fetch all schedules for other teams coached by the same coach on the reservation date
  const otherTeamSchedules = await Schedule.find({
    coach_id: coach._id,
    schedule_date: reservation.reservation_date,
    team_id: { $ne: team._id } // Exclude the current team's schedule
  });
  // Check if the reservation overlaps with any other team's practice time
  for (const schedule of otherTeamSchedules) {

    const scheduleStartTime = await convertTimeToMinutes(schedule.practice_start_time);
    const scheduleEndTime = await convertTimeToMinutes(schedule.practice_end_time);
    if (skipFlags && skipFlags.skipCoachOverlap) {
      return true
    } else if (
      (reservationStartTime >= scheduleStartTime && reservationStartTime < scheduleEndTime) ||
      (reservationEndTime > scheduleStartTime && reservationEndTime <= scheduleEndTime) ||
      (scheduleStartTime >= reservationStartTime && scheduleEndTime <= reservationEndTime)
    ) {
      // If overlap found, return false
      return false;
    }
  }
  // Check if the coach's available time overlaps with the reservation time
  if (coachStartTime <= reservationStartTime && coachEndTime >= reservationEndTime) {
    // If no overlap found, return true
    return true;
  } else {
    return false;
  }
}

async function checkSlotAvailability(reservation, practice_start_time, practice_end_time, skipFlags) {
  if (skipFlags?.skipSlotAvailability) {
    return true; // Skipping slot availability check
  } else {
    try {
      const slotData = await Slots.find({
        field_id: reservation.field_id,
        reservation_date: reservation.reservation_date
      });

      for (let slot of slotData) {
        for (let rData of slot.reservation_time_portion) {
          const rstart_time = await convertTimeToMinutes(rData.start_time);
          const rend_time = await convertTimeToMinutes(rData.end_time);
          const pstart_time = await convertTimeToMinutes(practice_start_time);
          const pend_time = await convertTimeToMinutes(practice_end_time);
          if (rstart_time <= pstart_time && rend_time >= pend_time) {
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
  // Ensure findSlot and its reservation_time_portion array are valid
  if (!reservation_time_portion) {
    return false;
  }

  for (let availableSlot of reservation_time_portion) {
    if (await compareFractions(availableSlot.remaining_portion, preferred_field_size) >= 0) {
      return true;
    }
  }

  // If none of the slots meet the condition, return false
  return false;
}

async function compareFractions(fraction1, fraction2) {
  fraction1 = `${fraction1}`
  fraction2 = `${fraction2}`

  // Helper function to normalize a fraction
  function normalizeFraction(fraction) {
    if (fraction.includes('/')) {
      return fraction;
    } else {
      return `${fraction}/1`;
    }
  }

  // Normalize both fractions
  fraction1 = normalizeFraction(fraction1);
  fraction2 = normalizeFraction(fraction2);

  // Split the fractions into numerator and denominator
  const [num1, denom1] = fraction1.split('/').map(Number);
  const [num2, denom2] = fraction2.split('/').map(Number);

  // Compare fractions by cross-multiplying to avoid precision issues
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
  const [year, month, day] = dateString.split('-');

  // Create a new Date object using the components (months are zero-based in JavaScript)
  const date = new Date(year, month - 1, day);

  // Check if the date is valid
  if (isNaN(date.getTime())) {
    // If the date is invalid, return an error message or handle it as per your requirement
    return 0
  }

  // Return the date in milliseconds
  return date.getTime();
}