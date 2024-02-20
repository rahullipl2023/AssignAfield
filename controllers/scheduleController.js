// Import necessary modules and models
const {
  Team,
  Coach,
  Club,
  Schedule,
  Field,
  Reservation,
} = require("../models/schema");
const moment = require('moment');
const { ObjectId } = require('mongoose').Types;

// Get Schedules By Club Id with Sort, Pagination, and Response Metadata
exports.getSchedulesByClubId = async (req, res) => {
  try {
    const club_id = req.params.clubId;
    const { search, sort, page, pageSize } = req.query;
    let query = { club_id };

    if (search) {
      // Search for coaches, fields, and teams based on their names
      const [coaches, fields, teams] = await Promise.all([
        Coach.find({ first_name: { $regex: search, $options: "i" } }),
        Field.find({ field_name: { $regex: search, $options: "i" } }),
        Team.find({ team_name: { $regex: search, $options: "i" } }),
      ]);

      // Extract IDs of the matched coaches, fields, and teams
      const coachIds = coaches.map((coach) => coach._id);
      const fieldIds = fields.map((field) => field._id);
      const teamIds = teams.map((team) => team._id);

      // Construct the query for searching schedules
      query.$or = [
        { coach_id: { $in: coachIds } },
        { field_id: { $in: fieldIds } },
        { team_id: { $in: teamIds } },
      ];
    }

    let sortOption;

    if (sort == "1") {
      sortOption = { "team_id.team_name": 1 };
    } else if (sort == "2") {
      sortOption = { "team_id.team_name": -1 };
    } else if (sort == "3") {
      sortOption = { practice_start_time: 1 };
    } else if (sort == "4") {
      sortOption = { practice_start_time: -1 };
    } else if (sort == "5") {
      sortOption = { schedule_date: 1 };
    } else if (sort == "6") {
      sortOption = { schedule_date: -1 };
    }

    const currentPage = parseInt(page) || 1;
    const pageSizeValue = parseInt(pageSize) || 10;

    const skip = (currentPage - 1) * pageSizeValue;
    const schedules = await Schedule.find(query)
      .populate("team_id")
      .populate("field_id")
      .populate("coach_id")
      .sort(sortOption)
      .skip(skip)
      .limit(pageSizeValue);

    const totalCount = await Schedule.countDocuments(query);
    const totalPages = Math.ceil(totalCount / pageSizeValue);

    return res.status(200).json({
      success: true,
      message: "Schedules retrieved successfully",
      schedules: schedules,
      metadata: {
        totalCount: totalCount,
        currentPage: currentPage,
        totalPages: totalPages,
      },
    });
  } catch (error) {
    console.error("Error getting schedules by club ID:", error);
    return res.status(500).json({ success: false, error: "Server Error" });
  }
};

// Get Schedules By Team Id OR Coach Id with Search, Sort, Pagination, and Response Metadata
exports.getSchedulesByTeamOrCoach = async (req, res) => {
  try {
    const club_id = req.params.clubId;
    const { team_id, coach_id, search, sort, page, pageSize } = req.query;

    const query = {
      club_id,
      $or: [],
    };

    if (team_id && ObjectId.isValid(team_id)) {
      query.$or.push({ team_id: new ObjectId(team_id) });
    }

    if (coach_id && ObjectId.isValid(coach_id)) {
      query.$or.push({ coach_id: new ObjectId(coach_id) });
    }

    if (search) {
      const searchRegex = { $regex: search, $options: "i" };
      query.$or.push(
        { team_id: searchRegex },
        { field_id: searchRegex },
        { coach_id: searchRegex }
      );
    }

    // Ensure that $or array is not empty
    if (query.$or.length === 0) {
      delete query.$or;
    }

    let sortOption;

    if (sort == "1") {
      sortOption = { "team_id.team_name": 1 };
    } else if (sort == "2") {
      sortOption = { "team_id.team_name": -1 };
    } else if (sort == "3") {
      sortOption = { practice_start_time: 1 };
    } else if (sort == "4") {
      sortOption = { practice_start_time: -1 };
    } else if (sort == "5") {
      sortOption = { schedule_date: 1 };
    } else if (sort == "6") {
      sortOption = { schedule_date: -1 };
    }

    const currentPage = parseInt(page) || 1;
    const pageSizeValue = parseInt(pageSize) || 10;

    const skip = (currentPage - 1) * pageSizeValue;

    const schedules = await Schedule.find(query)
      .populate("team_id")
      .populate("field_id")
      .populate("coach_id")
      .sort(sortOption)
      .skip(skip)
      .limit(pageSizeValue);

    const totalCount = await Schedule.countDocuments(query);
    const totalPages = Math.ceil(totalCount / pageSizeValue);

    return res.status(200).json({
      success: true,
      message: "Schedules retrieved successfully",
      schedules: schedules,
      metadata: {
        totalCount: totalCount,
        currentPage: currentPage,
        totalPages: totalPages,
      },
    });
  } catch (error) {
    console.error("Error getting schedules by team or coach:", error);
    return res.status(500).json({ success: false, error: "Server Error" });
  }
};

// View Schedule By ID
exports.viewScheduleById = async (req, res) => {
  try {
    const scheduleId = req.params.scheduleId;

    const schedule = await Schedule.findById(scheduleId)
      .populate("team_id")
      .populate("field_id")
      .populate("coach_id");

    if (!schedule) {
      return res
        .status(404)
        .json({ success: false, message: "Schedule not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Schedule details",
      schedule,
    });
  } catch (error) {
    console.error("Error fetching schedule by ID:", error);
    return res.status(500).json({ success: false, error: "Server Error" });
  }
};

//-------------------------------------------------------------------------------------------------------------------------------------

exports.generateSchedules = async (club_id) => {
  try {
    // Fetch all active coaches
    const coaches = await Coach.find({ club_id: club_id, is_active: true });

    // Fetch all active teams
    const teams = await Team.find({ club_id: club_id, is_active: true });

    // Fetch all active reservations and populate the field_id
    const reservations = await Reservation.find({ club_id: club_id, is_active: true }).populate("field_id");

    // Iterate through each team
    for (const team of teams) {
      console.log("Team :- ", team);
      // Iterate through each reservation
      for (const reservation of reservations) {
        console.log("Reservation :- ", reservation);
        // If the reservation does not match the team's preferred timing, skip
        if (!isReservationWithinPreferredTiming(reservation, team)) {
          console.log(" If  the reservation does not match the team's preferred timing, skipping... ");
          continue;
        }

        // Find a compatible coach for the team and reserved field
        const compatibleCoach = await findCompatibleCoach(
          team,
          coaches,
          reservation
        );
        console.log("compatibleCoach :- ", compatibleCoach);
        // If a compatible coach is found
        if (compatibleCoach) {
          // Calculate the portion of the field for the team
          const portionNeeded = parseFloat(team.preferred_field_size);
          console.log("portionNeeded :- ", portionNeeded);
          // Schedule the practice for the team on the reserved field
          const schedules = await Schedule.find({
            field_id: reservation.field_id,
            team_id: team._id,
            club_id: team.club_id,
            schedule_date: reservation.reservation_date
          })
          console.log(schedules, "jhfsdhfkjdsnvbfdjhvbfdjbvfvfuidfdufdufikdsi");
          if (schedules.length == 0) {
            await schedulePractice(
              team,
              compatibleCoach,
              reservation.field_id, // Use the reserved field directly
              portionNeeded,
              reservation
            );
          }
        }
      }
    }
  } catch (error) {
    console.log("Error generating Schedule: ", error);
  }
};

function isReservationWithinPreferredTiming(reservation, team) {
  const reservationDate = new Date(reservation.reservation_date);
  const reservationDay = reservationDate.toLocaleString("en-US", { weekday: "long", });
  // Check if the reservation day is one of the preferred days of the team
  if (!team.preferred_days.includes(reservationDay)) {
    console.log(" If  the reservation day is not in the preferred days list, returning false...");
    return false;
  }

  const [reservationStartHour, reservationStartMinute] = reservation.reservation_start_time.split(":").map((part) => parseInt(part));
  const [reservationEndHour, reservationEndMinute] = reservation.reservation_end_time.split(":").map((part) => parseInt(part));
  const reservationStartTime = reservationStartHour * 60 + reservationStartMinute;
  const reservationEndTime = reservationEndHour * 60 + reservationEndMinute;


  const preferredStartHour = parseInt(team.practice_start_time.split(":")[0]);
  const preferredStartMinute = parseInt(team.practice_start_time.split(":")[1]);
  const preferredStartHour1 = preferredStartHour * 60 + preferredStartMinute
  const preferredEndHour = parseInt(team.practice_end_time.split(":")[0]);
  const preferredEndMinute = parseInt(team.practice_end_time.split(":")[1]);
  const preferredEndHour1 = preferredEndHour * 60 + preferredEndMinute


  // Adjust the preferred end time considering the practice length
  const adjustedPreferredEndTime = preferredStartHour1 + team.practice_length;
  return (
    reservationStartTime >= preferredStartHour1 && adjustedPreferredEndTime <= reservationEndTime
  );
}

async function schedulePractice(team, coach, field, portionNeeded, reservation) {
  // Calculate the remaining time available for practice
  const remainingTime = team.practice_length;
  const [reservationStartHour, reservationStartMinute] = reservation.reservation_start_time.split(":").map((part) => parseInt(part));
  const [reservationEndHour, reservationEndMinute] = reservation.reservation_end_time.split(":").map((part) => parseInt(part));
  const reservationStartTime = reservationStartHour * 60 + reservationStartMinute;
  const reservationEndTime = reservationEndHour * 60 + reservationEndMinute;

  const reservationDate = reservation.reservation_date;
  // Check if the remaining time is less than the reserved time slot
  if (remainingTime <= reservationEndTime - reservationStartTime) {
    // Calculate the practice end time based on the team's practice length
    const practice_start_time = await convertMinutesToTime(reservationStartTime);
    const practice_end_time = await convertMinutesToTime(reservationStartTime + remainingTime);

    // Log the schedule entry details
    console.log(team._id, "<-team._id", team.club_id, "<-team.club_id", coach._id, "<-coach._id", field._id, "<-field._id", portionNeeded, "<-portionNeeded");
    console.log(practice_start_time, "<-practice_start_time", practice_end_time, "<-practice_end_time", team.practice_length, "<-team.practice_length");
    const remainingPortion = parseInt(reservation.field_id.field_portion) - parseInt(portionNeeded)
    console.log("Remaining Portion :- ", remainingPortion)
    // Save the schedule entry
    const scheduleEntry = new Schedule({
      team_id: team._id,
      club_id: team.club_id,
      coach_id: coach._id,
      field_id: field._id,
      field_portion: portionNeeded,
      schedule_date: reservationDate, // Assign the reservation date to the practice date
      practice_start_time: practice_start_time,
      practice_end_time: practice_end_time,
      practice_length: remainingTime, // Update practice length to remaining time
      // remaining_portion: remainingPortion
    });
    console.log(scheduleEntry, "scheduleEntry");
    await scheduleEntry.save();

    // Update the reservation's start and end time
    const updatedReservationStartTime = practice_end_time; // Update reservation start time
    const updatedReservationEndTime = await convertMinutesToTime(reservationEndTime); // No change in reservation end time

    // Update the reservation in the database
    await Reservation.findByIdAndUpdate(reservation._id, {
      updated_start_time: updatedReservationStartTime,
      updated_end_time: updatedReservationEndTime,
      remaining_portion: remainingPortion
    });
  } else {
    console.log(
      `The team's practice length (${team.practice_length}) exceeds the reserved time slot.`
    );
  }
}

// Helper function to find a compatible coach for the team
async function findCompatibleCoach(team, coaches, reservation) {
  return coaches.find((coach) => {
    const isWithinCoachTime = team.practice_start_time >= coach.coaching_start_time && team.practice_end_time <= coach.coaching_end_time;
    return (
      coachIsAvailable(coach, reservation.reservation_start_time, reservation.reservation_end_time, team) && (isWithinCoachTime)
    );
  });
}

// Helper function to check if the coach is available during the preferred timing and field hours
async function coachIsAvailable(coach, reservation_start_time, reservation_end_time, team) {

  const coachStartTime = coach.coaching_start_time
  const coachEndTime = coach.coaching_End_time
  const teamPreferredStartTimings = team.practice_start_time
  const teamPreferredEndTimings = team.practice_end_time
  console.log(
    compareTimes(coachStartTime, teamPreferredStartTimings) >= 0 &&
    compareTimes(coachEndTime, teamPreferredEndTimings) <= 0 &&
    compareTimes(coachStartTime, reservation_start_time) >= 0 &&
    compareTimes(coachEndTime, reservation_end_time) <= 0
  );
  return (
    compareTimes(coachStartTime, teamPreferredStartTimings) >= 0 &&
    compareTimes(coachEndTime, teamPreferredEndTimings) <= 0 &&
    compareTimes(coachStartTime, reservation_start_time) >= 0 &&
    compareTimes(coachEndTime, reservation_end_time) <= 0
  );
}

async function scheduleRemainingPortion(team, coach, field, remainingPortion, reservation) {
  const remainingTime = team.practice_length;
  const reservationEndTime = reservation.reservation_end_time;
  const reservationStartTime = reservation.reservation_start_time;
  const reservationDate = reservation.reservation_date;

  if (remainingTime <= reservationEndTime - reservationStartTime) {
    // Calculate the practice end time based on the team's practice length
    const practice_start_time = reservationStartTime;
    const practice_end_time = reservationStartTime + remainingTime;

    // Fetch all teams assigned to the field during the preferred timing
    const teamsAssignedToField = await Schedule.find({
      field_id: field._id,
      practice_start_time: { $lte: practice_start_time },
      practice_end_time: { $gte: practice_end_time },
      schedule_date: reservationDate,
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
          field_portion: portionNeeded,
          schedule_date: reservationDate,
          practice_start_time: practice_start_time,
          practice_end_time: practice_end_time,
          practice_length: team.practice_length,
        });

        await scheduleEntry.save();
        remainingPortion -= portionNeeded;

        // Update the reservation's start and end time
        const updatedReservationStartTime = practice_end_time; // Update reservation start time
        const updatedReservationEndTime = reservationEndTime; // No change in reservation end time

        // Update the reservation in the database
        await Reservation.findByIdAndUpdate(reservation._id, {
          reservation_start_time: updatedReservationStartTime,
          reservation_end_time: updatedReservationEndTime,
        });
        // Adjust the remaining portion
        remainingPortion -= parseFloat(otherTeam.preferred_field_size);
        teamsAssignedToField.push(otherTeam._id);
      }
    }

    // If there is still remaining portion and the field can accommodate more teams
    while (remainingPortion > 0 && teamsAssignedToField.length < field.teams_per_field) {
      // Find another compatible team for the remaining portion
      const otherTeam = await findTeamForRemainingPortion(field, teamsAssignedToField, remainingPortion);

      if (otherTeam) {
        const teamPreferredStartTimings = otherTeam.practice_start_time
        const teamPreferredEndTimings = otherTeam.practice_end_time
        let practice_start_time = await getRandomStartTime(updatedReservationStartTime, updatedReservationEndTime, [teamPreferredStartTimings, teamPreferredEndTimings], otherTeam.practice_length);
        let practice_end_time = await getRandomEndTime(updatedReservationStartTime, updatedReservationEndTime, practice_start_time, otherTeam.practice_length);
        // Schedule the remaining portion for the other team on the same field
        const scheduleEntry = new Schedule({
          team_id: otherTeam._id,
          club_id: otherTeam.club_id,
          coach_id: coach._id,
          field_id: field._id,
          practice_start_time: practice_start_time,
          practice_end_time: practice_end_time,
          practice_length: practiceLength,
        });

        await scheduleEntry.save();

        // Update the reservation's start and end time
        const updatedReservationStartTime = practice_end_time; // Update reservation start time
        const updatedReservationEndTime = reservationEndTime; // No change in reservation end time

        // Update the reservation in the database
        await Reservation.findByIdAndUpdate(reservation._id, {
          reservation_start_time: updatedReservationStartTime,
          reservation_end_time: updatedReservationEndTime,
        });
        // Adjust the remaining portion
        remainingPortion -= parseFloat(otherTeam.preferred_field_size);
        teamsAssignedToField.push(otherTeam._id);
      } else {
        // If no more compatible teams, exit the loop
        break;
      }
    }
  }
}

async function findTeamForRemainingPortion(teamsAssignedToField, remainingPortion) {
  // Fetch teams that are not already assigned to the field during the preferred timing
  const availableTeams = await Team.find({
    _id: { $nin: teamsAssignedToField },
    is_active: true,
  });

  // Find a compatible team for the remaining portion
  return availableTeams.find((otherTeam) => {
    const portionNeeded = parseFloat(otherTeam.preferred_field_size);
    return portionNeeded <= remainingPortion;
  });
}

// Helper function to compare two timings in HH:mm format
async function compareTimes(timing1, timing2) {
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
async function addMinutes(timing, minutes) {
  const [hour, minute] = timing.split(":").map((part) => parseInt(part));
  const totalMinutes = hour * 60 + minute + minutes;

  const newHour = Math.floor(totalMinutes / 60);
  const newMinute = totalMinutes % 60;

  return `${newHour < 10 ? "0" : ""}${newHour}:${newMinute < 10 ? "0" : ""}${newMinute}`;
}

// Helper function to get a random start time within the given range
async function getRandomStartTime(openTime, closeTime, preferredTimings, length) {
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
async function getRandomEndTime(openTime, closeTime, preferredTimings, length) {
  const endTime = addMinutes(preferredTimings, length);
  return endTime;
}

async function convertMinutesToTime(minutes) {
  // Calculate hours and minutes
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  // Format hours and minutes
  const formattedHours = String(hours).padStart(2, '0');
  const formattedMinutes = String(remainingMinutes).padStart(2, '0');
  const formattedSeconds = '00'; // Since we are converting to HH:mm:ss

  // Construct the time string
  const timeString = `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
  return timeString;
}
