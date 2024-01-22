const mongoose = require("mongoose");
const { Schedule, Coach, Team, Field } = require("../models/schema");

// Function to update the schedule based on coach, field, and team data
async function updateSchedule() {
  try {
    // Fetch all active coaches
    const coaches = await Coach.find({ is_active: true });

    // Fetch all active teams
    const teams = await Team.find({ is_active: true });

    // Fetch all active fields
    const fields = await Field.find({ is_active: true });

    // Clear existing schedule data
    await Schedule.deleteMany({});

    // Schedule practices for teams
    for (const team of teams) {
      // Get the preferred field size for the team
      const preferredFieldSize = parseFloat(team.preferred_field_size);
      // Find a compatible field for the team
      const compatibleField = await findCompatibleField(team, fields);

      if (compatibleField) {
        // Find a compatible coach for the team
        const compatibleCoach = findCompatibleCoach(
          team,
          coaches,
          compatibleField
        );
        if (compatibleCoach) {
          // Calculate the portion of the field for the team
          const portionNeeded = preferredFieldSize; //preferredFieldSize / compatibleField.field_size;
          //const teamsPerField = compatibleField.teams_per_field;
          const totalPortion = 1; //1 / teamsPerField;
          const remainingPortion = totalPortion - portionNeeded;
          // Schedule the practice for the team
          await schedulePractice(team, compatibleCoach, compatibleField, 90);

          // If there is remaining portion, schedule it for other teams
          if (remainingPortion > 0) {
            await scheduleRemainingPortion(
              team,
              compatibleCoach,
              compatibleField,
              remainingPortion,
              90
            );
          }
        }
      }
    }

    console.log("Schedule updated successfully");
    return "Schedule updated successfully";
  } catch (error) {
    console.error("Error updating schedule:", error);
    return `Error updating schedule: ${error.message || error}`;
  }
}

// Helper function to find a compatible field for the team
async function findCompatibleField(team, fields) {
  // Fetch all schedules for the preferred timing
  const [preferred_timing_to, preferred_timing_from] =
    team.preferred_timing.split(" to ");
  const conflictingSchedules = await Schedule.find({
    practice_start_time: { $lte: preferred_timing_to },
    practice_end_time: { $gte: preferred_timing_from },
  });

  const compatibleField = fields.find(async (field) => {
    // Check if the field is not present in the conflicting schedules
    const isFieldAvailable = !conflictingSchedules.some((schedule) =>
      schedule.field_id.equals(field._id)
    );

    const isFieldTimingAvailable = await fieldIsAvailable(field, [
      preferred_timing_to,
      preferred_timing_from,
    ]);

    const isCompatibleForAgeGroup = await fieldIsCompatibleForTeamAgeGroup(
      field,
      team.age_group
    );
    console.log("isCompatibleForAgeGroup:", isCompatibleForAgeGroup);

    return (
      isFieldAvailable && isFieldTimingAvailable && isCompatibleForAgeGroup
    );
  });

  return compatibleField;
}

async function fieldIsAvailable(field, preferredTimings) {
  let isFieldTimingAvailable;
  if (
    preferredTimings[0] >= field.field_open_time &&
    preferredTimings[1] <= field.field_close_time
  ) {
    // The team's preferred timing is within the field's opening and closing times
    // The field is available for the team to schedule practice
    isFieldTimingAvailable = true;
  } else {
    // The team's preferred timing is outside the field's opening and closing times
    // The field is not available for the team to schedule practice
    isFieldTimingAvailable = false;
  }

  return isFieldTimingAvailable;
}

// Helper function to check if the field is compatible for the team's age group
async function fieldIsCompatibleForTeamAgeGroup(field, teamAgeGroup) {
  console.log(field,teamAgeGroup);
  // Adjust this logic based on your requirements
  // For example, if the team is younger, assign them early slots; if older, assign late slots

  // Assuming age group format is "U-X" where X is the age limit
  const teamAgeLimit = parseInt(teamAgeGroup.split("-")[1]);
  console.log(teamAgeLimit, "team age group limit");
  // Adjust the age threshold based on your preference
  const ageThresholdForEarlySlot = 15; // For example, teams under 15 are considered younger

  if (teamAgeLimit <= ageThresholdForEarlySlot) {
    // If the team is younger than or equal to the threshold, assign early slots
    return (
      compareTimes(field.field_open_time, "08:00") >= 0 &&
      compareTimes(field.field_close_time, "14:00") <= 0
    );
  } else {
    // If the team is older, assign late slots
    return (
      compareTimes(field.field_open_time, "16:00") >= 0 &&
      compareTimes(field.field_close_time, "22:00") <= 0
    );
  }
}

// Helper function to find a compatible coach for the team
async function findCompatibleCoach(team, coaches, field) {
  return coaches.find((coach) => {
    return (
      coachIsAvailable(
        coach,
        field.field_open_time,
        field.field_close_time,
        team.preferred_timing
      ) &&
      (coach.multiple_teams_availability ||
        (field._id.toString() in coach.fields &&
          coach.preferred_time.includes(team.preferred_timing)))
    );
  });
}

// Helper function to check if the coach is available during the preferred timing and field hours
async function coachIsAvailable(
  coach,
  fieldOpenTime,
  fieldCloseTime,
  preferredTiming
) {
  const coachPreferredTimings = coach.preferred_time.split(" to ");
  const teamPreferredTimings = preferredTiming.split(" to ");

  return (
    compareTimes(coachPreferredTimings[0], teamPreferredTimings[0]) >= 0 &&
    compareTimes(coachPreferredTimings[1], teamPreferredTimings[1]) <= 0 &&
    compareTimes(coachPreferredTimings[0], fieldOpenTime) >= 0 &&
    compareTimes(coachPreferredTimings[1], fieldCloseTime) <= 0
  );
}

// Helper function to schedule the practice for the team
async function schedulePractice(team, coach, field, practiceLength) {
  const preferred_timing = team.preferred_timing.split(" to ");
  const scheduleEntry = new Schedule({
    team_id: team._id,
    club_id: team.club_id,
    coach_id: coach._id,
    field_id: field._id,
    practice_start_time: getRandomStartTime(
      field.field_open_time,
      field.field_close_time,
      preferred_timing
    ),
    practice_end_time: getRandomEndTime(
      field.field_open_time,
      field.field_close_time,
      preferred_timing
    ),
    practice_length: practiceLength,
  });

  await scheduleEntry.save();
}

async function scheduleRemainingPortion(
  team,
  coach,
  field,
  remainingPortion,
  practiceLength
) {
  const preferred_timing = team.preferred_timing.split(" to ");
  // Fetch all teams assigned to the field during the preferred timing
  const teamsAssignedToField = await Schedule.find({
    field_id: field._id,
    practice_start_time: { $lte: preferred_timing[0] },
    practice_end_time: { $gte: preferred_timing[1] },
  }).distinct("team_id");

  // Check if the field can accommodate more teams
  if (teamsAssignedToField.length < field.teams_per_field) {
    // Calculate the portion needed for the current team
    const portionNeeded = parseFloat(team.preferred_field_size);

    // Check if the remaining portion is enough for the current team
    if (portionNeeded <= remainingPortion) {
      // If enough, schedule on the same field
      const scheduleEntry = new Schedule({
        team_id: team._id,
        club_id: team.club_id,
        coach_id: coach._id,
        field_id: field._id,
        // Change this line in schedulePractice function
        practice_start_time: getRandomStartTime(
          field.field_open_time,
          field.field_close_time,
          team.preferred_timings
        ),
        practice_end_time: getRandomEndTime(
          field.field_open_time,
          field.field_close_time,
          team.preferred_timings
        ),

        practice_length: practiceLength,
      });

      await scheduleEntry.save();
      remainingPortion -= portionNeeded;
    }
  }

  // If there is still remaining portion and the field can accommodate more teams
  while (
    remainingPortion > 0 &&
    teamsAssignedToField.length < field.teams_per_field
  ) {
    // Find another compatible team for the remaining portion
    const otherTeam = await findTeamForRemainingPortion(
      field,
      teamsAssignedToField,
      remainingPortion
    );

    if (otherTeam) {
      // Schedule the remaining portion for the other team on the same field
      const scheduleEntry = new Schedule({
        team_id: otherTeam._id,
        club_id: otherTeam.club_id,
        coach_id: coach._id,
        field_id: field._id,
        // Change this line in schedulePractice function
        practice_start_time: getRandomStartTime(
          field.field_open_time,
          field.field_close_time,
          otherTeam.preferred_timings
        ),
        practice_end_time: getRandomEndTime(
          field.field_open_time,
          field.field_close_time,
          otherTeam.preferred_timings
        ),

        practice_length: practiceLength,
      });

      await scheduleEntry.save();

      // Adjust the remaining portion
      remainingPortion -= parseFloat(otherTeam.preferred_field_size);
      teamsAssignedToField.push(otherTeam._id);
    } else {
      // If no more compatible teams, exit the loop
      break;
    }
  }
}

async function findTeamForRemainingPortion(
  field,
  teamsAssignedToField,
  remainingPortion
) {
  // Fetch teams that are not already assigned to the field during the preferred timing
  const availableTeams = await Team.find({
    _id: { $nin: teamsAssignedToField },
    is_active: true,
    age_group: { $eq: team.age_group }, // Adjust this logic based on your requirements
  });

  // Find a compatible team for the remaining portion
  return availableTeams.find((otherTeam) => {
    const portionNeeded = parseFloat(otherTeam.preferred_field_size);
    return portionNeeded <= remainingPortion;
  });
}

// Helper function to compare two timings in HH:mm format
function compareTimes(timing1, timing2) {
  if (!timing2) {
    // Handle the case where timing2 is undefined
    return 1; // Or another suitable default value
  }

  const [hour1, minute1] = timing1.split(":").map((part) => parseInt(part));
  const [hour2, minute2] = timing2.split(":").map((part) => parseInt(part));

  if (hour1 !== hour2) {
    return hour1 - hour2;
  } else {
    return minute1 - minute2;
  }
}

// Helper function to add minutes to a timing in HH:mm format
function addMinutes(timing, minutes) {
  const [hour, minute] = timing.split(":").map((part) => parseInt(part));
  const totalMinutes = hour * 60 + minute + minutes;

  const newHour = Math.floor(totalMinutes / 60);
  const newMinute = totalMinutes % 60;

  return `${newHour < 10 ? "0" : ""}${newHour}:${
    newMinute < 10 ? "0" : ""
  }${newMinute}`;
}

// Helper function to get a random start time within the given range
function getRandomStartTime(openTime, closeTime, preferredTimings) {
  console.log(preferredTimings, "preferredTimings");
  const filteredTimings = preferredTimings.filter(
    (timing) =>
      compareTimes(openTime, timing) <= 0 &&
      compareTimes(timing, closeTime) <= 0
  );

  const randomPreferredTiming =
    filteredTimings[Math.floor(Math.random() * filteredTimings.length)];

  return randomPreferredTiming || openTime;
}

// Helper function to get a random end time within the given range
function getRandomEndTime(openTime, closeTime, preferredTimings) {
  const filteredTimings = preferredTimings.filter(
    (timing) =>
      compareTimes(openTime, timing) <= 0 &&
      compareTimes(timing, closeTime) <= 0
  );

  const randomPreferredTiming =
    filteredTimings[Math.floor(Math.random() * filteredTimings.length)];

  if (randomPreferredTiming) {
    const maxPracticeLength = 90; // Maximum practice length in minutes
    const endTime = addMinutes(randomPreferredTiming, maxPracticeLength);

    return compareTimes(endTime, closeTime) <= 0 ? endTime : closeTime;
  } else {
    // Handle the case where no valid timing is found
    return openTime; // Or another suitable default value
  }
}

module.exports = { updateSchedule };
