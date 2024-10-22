// Latest with out slot calculation

const { Team, Coach, Schedule, Field, Reservation, Slots } = require("../models/schema");
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper function to simulate an asynchronous operation
function simulateAsyncOperation(data) {
  return new Promise(resolve => setTimeout(() => resolve(data), 100));
}

function parseDate(dateStr) {
  const [month, day, year] = dateStr.split('/');
  return new Date(year, month - 1, day);
}

function formatDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

function getWeekRange(startDate) {
  const start = new Date(startDate);
  const end = new Date(start);

  const dayOfWeek = start.getDay();
  const diffToMonday = (dayOfWeek + 6) % 7;
  start.setDate(start.getDate() - diffToMonday);

  end.setDate(end.getDate() + (6 - dayOfWeek));

  return {
    start: formatDate(start),
    end: formatDate(end)
  };
}

function parseTimeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

async function chunkReservations(reservations) {
  // Step 1: Map and sort reservations based on date and duration
  const sortedReservations = reservations
    .map(r => ({
      date: parseDate(r.reservation_date),
      duration: parseTimeToMinutes(r.reservation_end_time) - parseTimeToMinutes(r.reservation_start_time),
      reservation: r
    }))
    .sort((a, b) => {
      // First, compare by date (ascending order)
      const dateDiff = a.date - b.date;
      if (dateDiff !== 0) return dateDiff;

      // If the dates are the same, compare by duration (descending order)
      return b.duration - a.duration;
    })
    .map(r => r.reservation);

  const reservationDates = sortedReservations.map(r => parseDate(r.reservation_date));
  const uniqueDates = new Set();
  let duplicateReservations = [];
  const chunks = [];

  let datePointer = 0;

  async function processChunk(startDate, endDate) {
    const chunk = await simulateAsyncOperation(sortedReservations.filter(r => {
      const date = parseDate(r.reservation_date);
      return date >= parseDate(startDate) && date <= parseDate(endDate);
    }));
    return chunk;
  }

  // Step 2: Chunking process
  while (datePointer < reservationDates.length) {
    const date = reservationDates[datePointer];
    const { start, end } = getWeekRange(date);

    const weeklyChunk = (await processChunk(start, end)).filter(r => {
      if (!uniqueDates.has(r.reservation_date)) {
        uniqueDates.add(r.reservation_date);
        return true;
      } else {
        duplicateReservations.push(r);
        return false;
      }
    });

    if (weeklyChunk.length > 0) {
      chunks.push(weeklyChunk);
    }

    while (datePointer < reservationDates.length && formatDate(reservationDates[datePointer]) <= end) {
      datePointer++;
    }
  }

  // Step 3: Process duplicates in remaining chunks
  while (duplicateReservations.length > 0) {
    const date = parseDate(duplicateReservations[0].reservation_date);
    const { start, end } = getWeekRange(date);

    const duplicateChunk = (await processChunk(start, end)).filter(r => {
      return parseDate(r.reservation_date) >= parseDate(start) && parseDate(r.reservation_date) <= parseDate(end);
    });

    if (duplicateChunk.length > 0) {
      chunks.push(duplicateChunk);
    }

    duplicateReservations = duplicateReservations.filter(r => !duplicateChunk.includes(r));
  }

  return chunks;
}

exports.generateSchedules = async (club_id, latestCreateReservation) => {
  try {
    // Fetch active teams with coaches and sort them by team name
    const teams = await Team.find({ club_id: club_id, is_active: true, coach_id: { $ne: null, $exists: true } }).sort({ team_name: 1 });

    // Group and sort teams by coach_id, then flatten into a single array
    const sortedTeams = Object.values(
      teams.reduce((map, team) => {
        if (!map[team.coach_id]) map[team.coach_id] = [];
        map[team.coach_id].push(team);
        return map;
      }, {})
    )
      .sort((a, b) => b.length - a.length)  // Sort by the number of teams per coach
      .flat()  // Flatten the array of teams
      .sort((a, b) => b.practice_length - a.practice_length);  // Sort by practice_length in descending order
    // Extract reservation IDs and fetch corresponding reservations with populated field_id
    const reservationIds = latestCreateReservation.map(reservation => reservation._id);
    const reservations = await Reservation.find({ _id: { $in: reservationIds }, club_id: club_id, is_active: true })
      .populate('field_id');

    const reservationChunks = await chunkReservations(reservations);
    let schedulesCount = sortedTeams.reduce((acc, team) => ({ ...acc, [team._id]: 0 }), {});
    for (let chunk of reservationChunks) {
      for await (const team of sortedTeams) {
        const totalSchedulesTeamShouldGet = team.preferred_days.length;
        let skipFlags = {};

        let { totalSchedulesForTeam, schedulesToSave } = await evaluateAndCountSchedules(chunk, team, skipFlags, totalSchedulesTeamShouldGet);

        if (totalSchedulesForTeam >= totalSchedulesTeamShouldGet) {
          await saveSchedules(schedulesToSave);
          schedulesCount[team._id] += totalSchedulesForTeam;
          continue;
        }

        for (const flag of ['skipTimingCheck', 'skipSlotAvailability', 'skipRegion']) {
          skipFlags[flag] = true;

          ({ totalSchedulesForTeam, schedulesToSave } = await evaluateAndCountSchedules(chunk, team, skipFlags, totalSchedulesTeamShouldGet));

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

async function saveSchedules(schedules) {
  for await (const item of schedules) {
    const query = {
      team_id: item.team_id,
      club_id: item.club_id,
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
  }
}

async function evaluateAndCountSchedules(chunk, team, skipFlags, totalSchedulesTeamShouldGet) {
  // Initialize variables for total schedules, schedules to save, and temporary data storage.
  let totalSchedulesForTeam = 0;
  let schedulesToSave = [];
  let data = {};
  const coachId = new ObjectId(team.coach_id); // Convert coach_id to ObjectId.
  const minimumPracticeLength = team.minimum_length; // Minimum practice length for the team.
  let practiceLength = team.practice_length; // Default practice length.
  let coaches;
  const teamPrefferdStartTime = await convertTimeToMinutes(team.practice_start_time);
  const teamPrefferdEndTime = await convertTimeToMinutes(team.practice_end_time);
  try {
    // Fetch all active coaches for the team’s club. This avoids fetching repeatedly during iteration.
    coaches = await Coach.find({ club_id: team.club_id, is_active: true });

    // Iterate over each reservation in the chunk.
    for (const reservation of chunk) {
      // await delay(2000);
      console.log("Team Name :-", team.team_name);
      console.log("Reservation Date :-", reservation.reservation_date);
      console.log("Reservation Start Time :-", reservation.reservation_start_time);
      console.log("Reservation End Time :-", reservation.reservation_end_time);
      console.log("*************************************************************")
      // If the total schedules already assigned to the team exceed the allowed limit, exit the loop.
      if (totalSchedulesForTeam >= totalSchedulesTeamShouldGet) break;

      // Define a query to check if a schedule already exists for the team on the reservation date.
      const query = { team_id: new ObjectId(team._id), club_id: new ObjectId(team.club_id), schedule_date: reservation.reservation_date };

      // Check if a schedule already exists. If it does, skip this reservation.
      const scheduleExists = await Schedule.exists(query);
      if (scheduleExists) continue;

      // Check if a schedule was already created for the same team, date, and club in this iteration. Skip if true.
      if (data.reservation_date === reservation.reservation_date &&
        data.team_id.equals(team._id) &&
        data.club_id.equals(team.club_id)) {
        continue;
      }

      // Convert the reservation date to a Date object and extract the day of the week.
      const reservationDate = new Date(reservation.reservation_date);
      const reservationDay = reservationDate.toLocaleString("en-US", { weekday: "long" });
      const field = reservation.field_id; // Get the field details from the reservation.
      const fieldCapacity = field.teams_per_field === "" || field.teams_per_field === null || field.teams_per_field === undefined ? 8 : field.teams_per_field;
 // Field capacity (number of teams that can practice simultaneously).
      let isPrefferedDay = await checkTeamsPrefferedDay(reservationDay, team, skipFlags);
      if(!isPrefferedDay) continue;
      // Convert the reservation start and end times to minutes.
      const reservationStartTime = await convertTimeToMinutes(reservation.reservation_start_time);
      const reservationEndTime = await convertTimeToMinutes(reservation.reservation_end_time);
      let initialCalculatedStartTime = (teamPrefferdStartTime >= reservationStartTime && teamPrefferdEndTime <= reservationEndTime) ? teamPrefferdStartTime : reservationStartTime;
      let initialCalculatedEndTime = initialCalculatedStartTime + practiceLength;

      const checkAndAssignTimes = async (team, field, reservation, calculatedStartTime, calculatedEndTime, practiceLength, minimumPracticeLength, fieldCapacity) => {
        // Find existing schedules
        const findExistingSchedules = await Schedule.find({
          club_id: new ObjectId(team.club_id),
          field_id: new ObjectId(field._id),
          schedule_date: reservation.reservation_date,
          $or: [
            {
              practice_start_time: { $lt: await convertMinutesToTime(calculatedEndTime) },
              practice_end_time: { $gt: await convertMinutesToTime(calculatedStartTime) },
            },
            {
              practice_start_time: { $gte: await convertMinutesToTime(calculatedStartTime), $lt: await convertMinutesToTime(calculatedEndTime) },
            },
            {
              practice_end_time: { $gt: await convertMinutesToTime(calculatedStartTime), $lte: await convertMinutesToTime(calculatedEndTime) },
            },
          ],
        });

        const matchingSchedules = await countMatchingSchedules(schedulesToSave, team, field, reservation, calculatedStartTime, calculatedEndTime);
        const totalExistingSchedules = [...findExistingSchedules, ...matchingSchedules];
        console.log(totalExistingSchedules.length, "totalExistingSchedules");
        console.log(fieldCapacity, "fieldCapacity");
        // Find all schedules with the same coach as the current team
        const schedulesWithSameCoach = totalExistingSchedules.filter(schedule => 
          schedule.coach_id.toString() == coachId.toString()
        );
        console.log(schedulesWithSameCoach,"schedulesWithSameCoach")

        // Check if totalExistingSchedules is less than field capacity
        if (totalExistingSchedules.length < fieldCapacity && schedulesWithSameCoach.length > 0) {
          let latestScheduleWithSameCoach = 0;

          // Use for...of to handle async/await properly
          for (const schedule of schedulesWithSameCoach) {
            const endTimeInMinutes = await convertTimeToMinutes(schedule.practice_end_time);
            if (endTimeInMinutes > latestScheduleWithSameCoach) {
              latestScheduleWithSameCoach = endTimeInMinutes;
            }
          }
          // Set the calculated start time based on the latest coach's schedule
          calculatedStartTime = latestScheduleWithSameCoach;
          calculatedEndTime = calculatedStartTime + practiceLength;

          // Check if the calculated end time is valid within the reservation end time
          if (calculatedEndTime <= reservationEndTime) {
            console.log("Valid slot found for the same coach with full practice length.","calculatedStartTime ->",calculatedStartTime, "calculatedEndTime ->",calculatedEndTime);
            return await checkAndAssignTimes(team, field, reservation, calculatedStartTime, calculatedEndTime, practiceLength, minimumPracticeLength, fieldCapacity);
          } else {
            // Try with minimum practice length
            calculatedEndTime = calculatedStartTime + minimumPracticeLength;

            if (calculatedEndTime <= reservationEndTime) {
              console.log("Valid slot found for the same coach with minimum practice length.","calculatedStartTime ->",calculatedStartTime, "calculatedEndTime ->",calculatedEndTime);
              return await checkAndAssignTimes(team, field, reservation, calculatedStartTime, calculatedEndTime, practiceLength, minimumPracticeLength, fieldCapacity);
            } else {
              console.log("No valid slot for the same coach even with minimum practice length. Continuing.");
            }
          }
        }

        // If the total schedules exceed or equal field capacity, adjust times and recheck
        if (totalExistingSchedules.length >= fieldCapacity) {
          for (const item of totalExistingSchedules) {
            calculatedStartTime = await convertTimeToMinutes(item.practice_end_time);
            calculatedEndTime = calculatedStartTime + practiceLength;

            console.log("Checking slot:", { calculatedStartTime, calculatedEndTime });

            if (calculatedEndTime <= reservationEndTime) {
              console.log("Valid slot found with full practice length.");
              return await checkAndAssignTimes(team, field, reservation, calculatedStartTime, calculatedEndTime, practiceLength, minimumPracticeLength, fieldCapacity);
            } else {
              // Try with minimum practice length
              calculatedEndTime = calculatedStartTime + minimumPracticeLength;

              console.log("Rechecking with minimum practice length:", { calculatedStartTime, calculatedEndTime });

              if (calculatedEndTime > reservationEndTime) {
                console.log("Slot exceeds reservation time even with minimum practice length. Continuing to next.");
                continue;
              } else {
                console.log("Valid slot found with minimum practice length.");
                return await checkAndAssignTimes(team, field, reservation, calculatedStartTime, calculatedEndTime, practiceLength, minimumPracticeLength, fieldCapacity);
              }
            }
          }

          // After the loop, if no valid slot is found
          if (calculatedEndTime > reservationEndTime) {
            console.log("No valid slot found within the reservation time.");
            return null; // or handle as needed
          }
        }
        // Base case to exit recursion
        console.log("Returning final calculated times:", { calculatedStartTime, calculatedEndTime, count: totalExistingSchedules.length });
        return { calculatedStartTime, calculatedEndTime, count: totalExistingSchedules.length };
      };



      // Initial call
      let result = await checkAndAssignTimes(team, field, reservation,initialCalculatedStartTime, initialCalculatedEndTime,practiceLength, minimumPracticeLength, fieldCapacity
      );

      if(!result) continue;

      let { calculatedStartTime, calculatedEndTime, count } = result


      // Create an object to store the reservation and schedule details.
      let rs = {
        practice_start_time: calculatedStartTime,
        practice_end_time: calculatedEndTime,
        reservation_date: reservation.reservation_date,
        field_id: reservation.field_id._id,
      };
      // Check various conditions simultaneously using Promise.all to ensure optimal scheduling.
      const [region, preferredDay, preferredTime, isCoachAvailable, isTeamTravelling] = await Promise.all([
        checkRegion(reservation, team, skipFlags), // Check if the region matches the team’s preferences.
        checkTeamsPrefferedDay(reservationDay, team, skipFlags), // Check if the reservation day matches the team’s preferred day.
        checkTeamPrefferedTime(reservation, team, skipFlags), // Check if the reservation time matches the team’s preferred time.
        findCompatibleCoach(team, coaches, rs, schedulesToSave), // Find if there’s a compatible coach available.
        checkTeamTravelling(team, reservation.reservation_date) // Check if the team is traveling on the reservation date.
      ]);
      console.log(`${!preferredDay} || ${!region} || ${!preferredTime} || ${!isCoachAvailable} || ${isTeamTravelling}`)
      // If any condition is not met, skip this reservation.
      if (!preferredDay || !region || !preferredTime || !isCoachAvailable || isTeamTravelling) continue;

      // await delay(2000);
      // Log the details of the schedule being created.
      console.log("----------Schedules Details-----------------------")
      console.log("Team Name :-", team.team_name);
      console.log("Reservation Date :-", reservation.reservation_date);
      console.log("Reservation Start Time :-", reservation.reservation_start_time);
      console.log("Reservation End Time :-", reservation.reservation_end_time);
      console.log("Field Name :-", reservation.field_id.field_name);
      console.log("Schedule Date :-", reservation.reservation_date);
      console.log("Practice Start Time :-", await convertMinutesToTime(calculatedStartTime));
      console.log("Practice End Time :-", await convertMinutesToTime(calculatedEndTime));
      console.log("Portion Name :-", count + 1);
      console.log("--------------------------------------------------");

      // Create a new schedule object with all the necessary details.
      const schedule = {
        team_id: new ObjectId(team._id),
        club_id: new ObjectId(team.club_id),
        coach_id: coachId,
        field_id: new ObjectId(field._id),
        field_portion: team.preferred_field_size,
        schedule_date: reservation.reservation_date,
        practice_ideal_start_time: await convertMinutesToTime(calculatedStartTime),
        practice_start_time: await convertMinutesToTime(calculatedStartTime),
        practice_end_time: await convertMinutesToTime(calculatedEndTime),
        practice_length: practiceLength,
        portion_name: count + 1 // Ensure each schedule has a unique portion name for the same field and time.
      };

      // Add the new schedule to the schedulesToSave array.
      schedulesToSave.push(schedule);
      totalSchedulesForTeam++; // Increment the total count of schedules for the team.

      // Update the temporary data object with the current reservation and team details.
      data = {
        reservation_date: reservation.reservation_date,
        team_id: new ObjectId(team._id),
        club_id: new ObjectId(team.club_id)
      };
    }
  } catch (error) {
    // Log any errors that occur during the process and rethrow the error.
    console.error("Error during schedule evaluation:", error);
    throw error;
  }

  // Return the total schedules created for the team and the array of schedules to be saved.
  return { totalSchedulesForTeam, schedulesToSave };
}

async function countMatchingSchedules(schedules, team, field, reservation, currentStartTime, potentialEndTime) {
  const startTimeStr = await convertMinutesToTime(currentStartTime);
  const endTimeStr = await convertMinutesToTime(potentialEndTime);

  const overlappingSchedules = schedules.filter(schedule => {
    // Check if the schedule overlaps with the current reservation time.
    const isOverlap =
      schedule.club_id.equals(team.club_id) &&
      schedule.field_id.equals(field._id) &&
      schedule.schedule_date === reservation.reservation_date &&
      (
        (schedule.practice_start_time < endTimeStr && schedule.practice_end_time > startTimeStr) ||
        (schedule.practice_start_time >= startTimeStr && schedule.practice_start_time < endTimeStr) ||
        (schedule.practice_end_time > startTimeStr && schedule.practice_end_time <= endTimeStr)
      );

    return isOverlap;
  });

  return overlappingSchedules; // Return the array of overlapping schedules.
}

// Function to convert time in minutes to "HH:MM" format
async function convertMinutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  const formattedHours = String(hours).padStart(2, '0');
  const formattedMinutes = String(remainingMinutes).padStart(2, '0');

  return `${formattedHours}:${formattedMinutes}`; // Return formatted time string
}

// Function to convert time in "HH:MM" format to minutes
async function convertTimeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes; // Return time in minutes
}

async function findCompatibleCoach(team, coaches, reservation, schedulesToSave) {
  // await delay(1000);
  console.log("---In the compatible coach function ----")
  const coach = coaches.find(coach => coach._id.equals(team.coach_id));
  if (!coach) return false;

  const coachStartTime = await convertTimeToMinutes(coach.coaching_start_time);
  const coachEndTime = await convertTimeToMinutes(coach.coaching_end_time);
  const reservationStartTime = reservation.practice_start_time;
  const reservationEndTime = reservation.practice_end_time;

  if (coachStartTime <= reservationStartTime && coachEndTime >= reservationEndTime) {

    // Fetch all schedules for other teams coached by the same coach on the reservation date
    const otherTeamSchedules = await Schedule.find({
      coach_id: new ObjectId(coach._id),
      schedule_date: reservation.reservation_date,
      team_id: { $ne: new ObjectId(team._id) } // Exclude the current team's schedule
    });

    // Filter schedulesToSave to include only those with the reservation_date
    const filteredSchedulesToSave = schedulesToSave.filter(schedule =>
      schedule.schedule_date == reservation.reservation_date &&
      schedule.coach_id.equals(new ObjectId(coach._id)) &&
      !schedule.team_id.equals(new ObjectId(team._id))
    );

    // Combine the filtered schedulesToSave with otherTeamSchedules
    let allSchedules = [...otherTeamSchedules, ...filteredSchedulesToSave];
    if (allSchedules.length > 0) {
      // Check for overlaps or conflicts with other schedules
      let allSchedulesPass = false;

      for (const schedule of allSchedules) {
        if ((reservation.field_id.toString() == schedule.field_id.toString())) {
          const scheduleStartTime = await convertTimeToMinutes(schedule.practice_ideal_start_time);
          const scheduleEndTime = await convertTimeToMinutes(schedule.practice_end_time);
          const overlaps = (
            (scheduleStartTime < reservationEndTime && scheduleEndTime > reservationStartTime) ||
            (scheduleStartTime >= reservationStartTime && scheduleStartTime < reservationEndTime) ||
            (scheduleEndTime > reservationStartTime && scheduleEndTime <= reservationEndTime)
          )
          console.log(`(${scheduleStartTime} < ${reservationEndTime} && ${scheduleEndTime} > ${scheduleStartTime}) ||
                    (${scheduleStartTime} >= ${reservationStartTime} && ${scheduleStartTime} < ${reservationEndTime}) ||
                    (${scheduleEndTime} > ${reservationStartTime} && ${scheduleEndTime} <= ${reservationEndTime})`)
          console.log("overlaps",overlaps)
          if (!overlaps) {
            // await delay(1000);
            console.log("Coach not overlaps return TRUE")
            allSchedulesPass = true;
            break; // Exit the loop early if the condition is met
          }
        }
      }
      console.log("----Out of compatible coach function ----")
      return allSchedulesPass;
    } else {
      // await delay(1000);
      console.log("No Schedules availabe return TRUE")
      console.log("----Out of compatible coach function ----")
      return true;
    }
  } else {
    // await delay(1000);
    console.log("Coach Timing not available return FALSE")
    console.log("----Out of compatible coach function ----")
    return false;
  }
}

// Function to check if the team is traveling on the given date
async function checkTeamTravelling(team, date) {
  const travelStartDate = new Date(team.travelling_start_date); // Convert traveling start date to Date object
  const travelEndDate = new Date(team.travelling_end_date); // Convert traveling end date to Date object
  const reservationDate = new Date(date); // Convert the reservation date to Date object

  // Return true if the reservation date is within the traveling period, false otherwise
  return reservationDate >= travelStartDate && reservationDate <= travelEndDate;
}

// Function to check if the reservation field's region matches the team's region
async function checkRegion(reservation, team, skipFlags) {
  if (skipFlags?.skipRegion) return true;

  const reservationRegion = reservation.field_id?.region?.toLowerCase() || '';
  const teamRegion = team.region.toLowerCase();

  return (
    teamRegion === 'all' ||
    reservationRegion === 'all' ||
    teamRegion === reservationRegion
  );
}

// Function to check if the reservation day matches the team's preferred days
async function checkTeamsPrefferedDay(reservationDay, team, skipFlags) {
  if (skipFlags?.skipPreferredDays) return true;

  return team.preferred_days.includes(reservationDay); // Return true if preferred day matches, false otherwise
}

// Function to check if the reservation time falls within the team's preferred timing
async function checkTeamPrefferedTime(reservation, team, skipFlags) {
  if (skipFlags?.skipTimingCheck) return true;

  const reservationEndTime = await convertTimeToMinutes(reservation.reservation_end_time);
  const preferredStartHour = await convertTimeToMinutes(team.practice_start_time);
  const adjustedPreferredEndTime = preferredStartHour + team.minimum_length;

  return preferredStartHour <= reservationEndTime && adjustedPreferredEndTime <= reservationEndTime; // Return true if time falls within preferred range
}
