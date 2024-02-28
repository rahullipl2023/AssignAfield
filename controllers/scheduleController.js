// Import necessary modules and models
const {
  Team,
  Coach,
  Club,
  Schedule,
  Field,
  Reservation,
  Slots
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
    // console.log("Coaches:", coaches);

    // Fetch all active teams
    const teams = await Team.find({ club_id: club_id, is_active: true }).sort({ age_group: 1 });;
    // console.log("Teams:", teams);

    // Fetch all active reservations and populate the field_id
    const reservations = await Reservation.find({ club_id: club_id, is_active: true }).populate({
      path: 'field_id',
      options: { sort: { is_lights_available: 1 } } // Sort fields by is_lights_available in ascending order
    });
    // console.log("Reservations:", reservations);

    // Iterate through each team
    for (const team of teams) {
      console.log(team,"team")
      // console.log("team:", team);
      // Iterate through each reservation
      for (const reservation of reservations) {
        console.log(reservation, "reservation");
        let findSlot = await Slots.find({ reservation_id: reservation._id, club_id: team.club_id })
        if (findSlot.length == 0) {
          const field = await Field.findById(reservation.field_id);
          const maxTeamsPerField = field.teams_per_field;
          const teamsScheduled = await Schedule.find({
            field_id: reservation.field_id,
            reservation_date: reservation.reservation_date
          });
          const remainingPortion = 1 / maxTeamsPerField * (maxTeamsPerField - teamsScheduled.length);
          let reservationArray = [];
          reservationArray.push({
            start_time: reservation.reservation_start_time,
            end_time: reservation.reservation_end_time,
            remaining_portion: remainingPortion,
            coach_available: true
          })
          const bookedSlotEntry = new Slots({
            club_id: team.club_id,
            reservation_id: reservation._id,
            field_id: reservation.field_id._id,
            reservation_time_portion: reservationArray,
            reservation_date: reservation.reservation_date,
          });
          // Save the booked slot entry
          const savedSlotEntry = await bookedSlotEntry.save();
          // Access the _id of the saved document
          const savedSlotId = savedSlotEntry._id;
          let isRsWpT = await isReservationWithinPreferredTiming(reservation, team)
          // If the reservation does not match the team's preferred timing, skip
          if (!isRsWpT) {
            console.log("Reservation is not within preferred timing. Skipping...");
            continue;
          } else {
            // Calculate the portion of the field for the team
            const portionNeeded = team.preferred_field_size;
            // Schedule the practice for the team on the reserved field
            const schedules = await Schedule.find({
              team_id: team._id,
              club_id: team.club_id,
              schedule_date: reservation.reservation_date
            })
            if (schedules.length == 0) {
              await schedulePractice(team, portionNeeded, reservation, reservationArray, savedSlotId);
            }
          }
        } else {
          findSlot[0].reservation_time_portion = findSlot[0].reservation_time_portion.filter((slot) => {
            const numerator = parseInt((slot.remaining_portion.toString()).split('/')[0]);
            return numerator > 0;
          });
          const reservation1 = await Reservation.find({ club_id: club_id, _id: findSlot[0].reservation_id }).populate("field_id");
          // If the reservation does not match the team's preferred timing, skip
          let isRsWpT = await isReservationWithinPreferredTiming(reservation, team)
          if (!isRsWpT) {
            console.log("Reservation is not within preferred timing. Skipping...");
            continue;
          } else {
            // Calculate the portion of the field for the team
            const portionNeeded = team.preferred_field_size;
            // Schedule the practice for the team on the reserved field
            const schedules = await Schedule.find({
              team_id: team._id,
              club_id: team.club_id,
              schedule_date: reservation1[0].reservation_date
            })
            console.log(schedules,"Already exists schedule")
            if (schedules.length == 0) {
              await schedulePractice(team, portionNeeded, reservation1[0], findSlot[0].reservation_time_portion, findSlot[0]._id);
            }
          }
        }
        console.log("------------------------------------Reservation END-----------------------------------------");
      }
    }
  } catch (error) {
    console.log("Error generating Schedule:", error);
  }
};

// Function to check if a reservation is within the team's preferred timing
async function isReservationWithinPreferredTiming(reservation, team) {
  const reservationDate = new Date(reservation.reservation_date);
  const reservationDay = reservationDate.toLocaleString("en-US", { weekday: "long" });
  // Check if the reservation day is one of the preferred days of the team
  if(team.region == reservation.field_id.region){
    if (!team.preferred_days.includes(reservationDay)) {
    console.log("Reservation day is not within team's preferred days.");
    return false;
    }

    if (team.is_travelling) {
      // Check if any travelling date overlaps with the reservation date
      for await (const date of team.travelling_date) {
        const travellingStartDate = await convertDateToMilliseconds(date.travelling_start);
        const travellingEndDate = await convertDateToMilliseconds(date.travelling_end);
        const reservationStart = await convertDateToMilliseconds(reservation.reservation_date);
        if (reservationStart >= travellingStartDate && reservationStart <= travellingEndDate) {
          console.log("Reservation date is within team's travelling dates.");
          return false; // Return false if the reservation date overlaps with any travelling date
        }
      }
    }

    // Check if the reservation time falls within the team's preferred timing
    const reservationStartTime = await convertTimeToMinutes(reservation.reservation_start_time);
    const reservationEndTime = await convertTimeToMinutes(reservation.reservation_end_time);
    const preferredStartHour1 = await convertTimeToMinutes(team.practice_start_time);
    const adjustedPreferredEndTime = preferredStartHour1 + team.practice_length;
    return reservationStartTime <= preferredStartHour1 && adjustedPreferredEndTime <= reservationEndTime;
  }else{
    console.log("Team and field are not in same region")
    return false
  }
}

// Function to Schedule new practice session
async function schedulePractice(team, portionNeeded, reservation, slot, slot_id) {
  const teamPrefferdStartTime = await convertTimeToMinutes(team.practice_start_time)
  const teamPrefferdEndTime = await convertTimeToMinutes(team.practice_end_time)
  const reservationStartTime = await convertTimeToMinutes(reservation.reservation_start_time);
  const reservationEndTime = await convertTimeToMinutes(reservation.reservation_end_time);
  const remainingTime = team.practice_length;
  // Fetch all active coaches
  const coaches = await Coach.find({ club_id: team.club_id, is_active: true });
  // Initialize calculated start time variable
  let calculatedStartTime = 0;
  // let calculatedRemaining = 0
  // Check if the team's preferred start and end times fall within the reservation start and end times
  if (teamPrefferdStartTime >= reservationStartTime && teamPrefferdEndTime <= reservationEndTime) {
    // If so, use team's preferred start time
    calculatedStartTime = teamPrefferdStartTime;
  } else {
    // Otherwise, use reservation start time
    calculatedStartTime = reservationStartTime;
  }
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
  const portionName = String.fromCharCode(65 + existingSchedules.length); // A, B, C, ...
  // Perform aggregation to filter documents based on criteria
  const slotData = await Slots.find({
    field_id: reservation.field_id,
    reservation_date: reservation.reservation_date
  });

  let isSlotAvailable = false;
  for (let slot of slotData) {
    console.log(slot,"slot...375")
    for (let rData of slot.reservation_time_portion) {
      const rstart_time = await convertTimeToMinutes(rData.start_time)
      const rend_time = await convertTimeToMinutes(rData.end_time)
      const pstart_time = await convertTimeToMinutes(practice_start_time)
      const pend_time = await convertTimeToMinutes(practice_end_time)
      console.log("rstart_time",rstart_time, '<=', "pstart_time",pstart_time,'&&',"rend_time",rend_time, '>=', "pend_time",pend_time, "381")
      if (rstart_time <= pstart_time && rend_time >= pend_time) {
        isSlotAvailable = true;
        break;
      }
    }
  } 
  console.log(isSlotAvailable,"isSlotAvailable")
  if(isSlotAvailable){
      if (remainingTime <= reservationEndTime - calculatedStartTime) {
        // const remainingPortion = parseInt(reservation.field_id.field_portion) - parseInt(portionNeeded);
        // Find a compatible coach for the team and reserved field
        let rs = {
          practice_start_time: practice_start_time,
          practice_end_time: practice_end_time,
          reservation_date: reservation.reservation_date
        }
        const compatibleCoach = await findCompatibleCoach(team, coaches, rs);
        // If a compatible coach is found
        if (compatibleCoach) {
          const scheduleEntry = new Schedule({
            team_id: team._id,
            club_id: team.club_id,
            coach_id: compatibleCoach._id,
            field_id: reservation.field_id._id,
            field_portion: portionNeeded,
            schedule_date: reservation.reservation_date,
            practice_start_time: practice_start_time,
            practice_end_time: practice_end_time,
            practice_length: remainingTime,
            portion_name: portionName
          });
          let savedSchedule = await scheduleEntry.save();
          let rsArray = slot.length > 0 ? slot : reservation;
          let updatedReservationArray = await updateReservationArray(rsArray, practice_start_time, practice_end_time, portionNeeded);
          let updateSlot = await Slots.findByIdAndUpdate(slot_id, {
            $set: {
              reservation_time_portion: updatedReservationArray
            }
          }, { new: true });
        }
      } else {
        console.log(`The team's practice length (${team.practice_length}) exceeds the reserved time slot.`);
      }
  }
}

// Function to updated the available reservations
async function updateReservationArray(reservationArray, practice_start_time, practice_end_time, field_portion) {
  let updatedReservationArray = [];
  const slots = Array.isArray(reservationArray) && reservationArray.length > 0 ? reservationArray : reservationArray;
  for (let slot of slots) {
    if (slot && typeof slot.remaining_portion !== 'string') {
      slot.remaining_portion = slot.remaining_portion.toString();
    }
    console.log(slot,"*****************")
    if (practice_start_time < slot.end_time && practice_end_time > slot.start_time) {
      if (practice_start_time > slot.start_time) {
        updatedReservationArray.push({
          start_time: slot.start_time,
          end_time: practice_start_time,
          remaining_portion: slot.remaining_portion.toString(),
          coach_available: slot.coach_available
        });
      }

      const remainingPortion = subtractPortions(slot.remaining_portion.toString(), field_portion.toString());
      const numerator = parseInt(remainingPortion.split('/')[0]);
      if (numerator > 0) {
        updatedReservationArray.push({
          start_time: practice_start_time,
          end_time: practice_end_time,
          remaining_portion: remainingPortion.toString(),
          coach_available: slot.coach_available
        });
      }
      if (practice_end_time < slot.end_time) {
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

// Function to find Compatible coach of team
async function findCompatibleCoach(team, coaches, reservation) {
  for (const coach of coaches) {
    const availability1 = await checkCoachAvailability(coach, reservation);
    if (availability1) {
      return coach;
    }
  }
  return null; // Return null if no compatible coach is found
}

// Function to check coach's availability for the new reservation
async function checkCoachAvailability(coach, reservation) {
  const coachStartTime = await convertTimeToMinutes(coach.coaching_start_time);
  const coachEndTime = await convertTimeToMinutes(coach.coaching_end_time);
  const reservationStartTime = await convertTimeToMinutes(reservation.practice_start_time);
  const reservationEndTime = await convertTimeToMinutes(reservation.practice_end_time);

  const existingSchedules = await Schedule.find({
    coach_id: coach._id,
    schedule_date: reservation.reservation_date
  });

  if (existingSchedules.length >= coach.max_team_you_coach) {
    return false;
  }

  const promises = existingSchedules.map(async (schedule) => {
    const scheduleStartTime = await convertTimeToMinutes(schedule.practice_start_time);
    const scheduleEndTime = await convertTimeToMinutes(schedule.practice_end_time);
    const overlaps = await checkOverlaps(scheduleStartTime, reservationStartTime, scheduleEndTime, reservationEndTime);
    const availabilityOverlaps = await checkAvailability(coachStartTime, coachEndTime, reservationStartTime, reservationEndTime);
    return !overlaps && availabilityOverlaps;
  });

  const results = await Promise.all(promises);
  return results.every(result => result);
}

// Function to subtract two portion strings
function subtractPortions(existingPortion, subtractedPortion) {
  // Split and trim the strings to extract numerator and denominator
  const existingParts = existingPortion.includes('/') ? existingPortion.trim().split('/').map(Number) : [parseInt(existingPortion), 1];
  const subtractedParts = subtractedPortion.trim().split('/').map(Number);

  // Ensure subtractedParts[1] has a value, defaulting to 1 if it's undefined
  const subtractedDenominator = subtractedParts[1] || 1;

  const newNumerator = existingParts[0] * subtractedDenominator - subtractedParts[0] * existingParts[1];
  const newDenominator = existingParts[1] * subtractedDenominator;

  const gcd = calculateGCD(newNumerator, newDenominator);
  return `${newNumerator / gcd}/${newDenominator / gcd}`;
}

// Function to calculate Greatest Common Divisor (GCD) using Euclidean algorithm
function calculateGCD(a, b) {
  while (b !== 0) {
    let temp = b;
    b = a % b;
    a = temp;
  }
  return a;
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

async function checkOverlaps(scheduleStartTime, reservationStartTime, scheduleEndTime, reservationEndTime) {
  return (
    (scheduleStartTime >= reservationStartTime && scheduleStartTime < reservationEndTime) ||
    (scheduleEndTime > reservationStartTime && scheduleEndTime <= reservationEndTime) ||
    (scheduleStartTime < reservationStartTime && scheduleEndTime > reservationEndTime)
  );
}

async function checkAvailability(coachStartTime, coachEndTime, reservationStartTime, reservationEndTime) {
  return (
    coachStartTime < reservationEndTime &&
    coachEndTime > reservationStartTime
  );
}