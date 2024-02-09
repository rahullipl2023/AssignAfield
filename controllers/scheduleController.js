// Import necessary modules and models
const { Team, Coach, Club, Schedule, Field } = require("../models/schema");
const ExcelJS = require("exceljs");
const fs = require("fs").promises;
const path = require("path");
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;

// Create Schedule
exports.createSchedule = async (req, res) => {
  try {
    const {
      club_id,
      team_id,
      coach_id,
      field_id,
      field_portion,
      schedule_date,
      schedule_day,
      practice_start_time,
      practice_end_time,
      contact_number,
      permit,
    } = req.body;
    const createSchedule = await Schedule.create({
      team_id,
      club_id,
      coach_id,
      field_id,
      field_portion,
      schedule_date,
      schedule_day,
      practice_start_time,
      practice_end_time,
      contact_number,
      permit,
    });
    if (!createSchedule) {
      return res
        .status(400)
        .json({ success: false, message: "Error creating the schedule" });
    }

    return res.status(201).json({
      success: true,
      message: "Successfully created schedule",
      schedule: createSchedule,
    });
  } catch (error) {
    console.error("Error in create schedule:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

// Update Schedule
exports.updateSchedule = async (req, res) => {
  try {
    const scheduleId = req.params.scheduleId;

    const {
      team_id,
      club_id,
      coach_id,
      field_id,
      field_portion,
      schedule_date,
      schedule_day,
      practice_start_time,
      practice_end_time,
      contact_number,
      permit,
    } = req.body;

    const updatedSchedule = await Schedule.findByIdAndUpdate(
      scheduleId,
      {
        $set: {
          team_id,
          club_id,
          coach_id,
          field_id,
          field_portion,
          schedule_date,
          schedule_day,
          practice_start_time,
          practice_end_time,
          contact_number,
          permit,
        },
      },
      { new: true }
    );

    if (!updatedSchedule) {
      return res
        .status(404)
        .json({ success: false, message: "Schedule not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Successfully updated schedule",
      schedule: updatedSchedule,
    });
  } catch (error) {
    console.error("Error updating schedule:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

// Get Schedules By Club Id with Sort, Pagination, and Response Metadata
exports.getSchedulesByClubId = async (req, res) => {
  try {
    const club_id = req.params.clubId;
    const { search, sort, page, pageSize } = req.query;
    let query = { club_id };

    if (search) {
      // Search for coaches, fields, and teams based on their names
      const [coaches, fields, teams] = await Promise.all([
        Coach.find({ first_name: { $regex: search, $options: 'i' } }),
        Field.find({ field_name: { $regex: search, $options: 'i' } }),
        Team.find({ team_name: { $regex: search, $options: 'i' } })
      ]);

      // Extract IDs of the matched coaches, fields, and teams
      const coachIds = coaches.map(coach => coach._id);
      const fieldIds = fields.map(field => field._id);
      const teamIds = teams.map(team => team._id);

      // Construct the query for searching schedules
      query.$or = [
        { coach_id: { $in: coachIds } },
        { field_id: { $in: fieldIds } },
        { team_id: { $in: teamIds } }
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
    console.log(query,"query")
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

// Soft Delete Schedule By ID
exports.softDeleteScheduleById = async (req, res) => {
  try {
    const scheduleId = req.params.scheduleId;

    // Find the schedule by ID and update the 'deleted_at' field
    const softDeletedSchedule = await Schedule.findByIdAndUpdate(
      scheduleId,
      {
        $set: {
          deleted_at: new Date(),
        },
      },
      { new: true } // Return the updated schedule
    );

    if (!softDeletedSchedule) {
      return res
        .status(404)
        .json({ success: false, message: "Schedule not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Schedule soft deleted successfully",
      softDeletedSchedule: softDeletedSchedule,
    });
  } catch (error) {
    console.error("Error soft deleting schedule by ID:", error);
    return res.status(500).json({ success: false, error: "Server Error" });
  }
};

// Import Schedule via Excel Sheet
exports.importSchedule = async (req, res) => {
  try {
    const club_id  = req.params.clubId;
    const file = req.file;

    // Check if the buffer is a valid Buffer instance
    if (!Buffer.isBuffer(file.buffer)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid file buffer" });
    }

    // Create a temporary file path
    const tempFilePath = path.join(__dirname, "temp.xlsx");

    // Write the buffer to the temporary file
    await fs.writeFile(tempFilePath, file.buffer);

    // Load the workbook from the temporary file
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(tempFilePath);

    // Remove the temporary file
    await fs.unlink(tempFilePath);

    const worksheet = workbook.getWorksheet(1);

    const schedulesData = [];

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber !== 1) {
        // Skip header row
        const [
          team_name,
          field_name,
          coach_name,
          field_portion,
          schedule_day,
          schedule_date,
          practice_start_time,
          practice_end_time,
          practice_length,
          permit
          // ... other fields
        ] = row.values;
        console.log(row.values,"row.values")
        // Convert Date objects to time strings directly
        const formattedPracticeStartTime = formatDateToString1(practice_start_time);
        const formattedPracticeEndTime = formatDateToString1(practice_end_time);

        schedulesData.push({
          club_id,
          team_name,
          field_name,
          coach_name,
          field_portion,
          schedule_day,
          schedule_date,
          practice_start_time: formattedPracticeStartTime,
          practice_end_time: formattedPracticeEndTime,
          practice_length,
          permit,
          // ... other fields
        });
      }
    });

    // Create schedules without a transaction
    const createSchedules = await Promise.all(
      schedulesData.map(async (scheduleData) => {
        // Check if the team, coach, and field exist; if not, create them

        // Check if the team exists, if not create a new team
        let team = await Team.findOne({ team_name: scheduleData.team_name });
        if (!team) {
          team = await Team.create({ team_name: scheduleData.team_name });
        }

        // Check if the coach exists, if not create a new coach
        let coach = await Coach.findOne({
          coach_name: scheduleData.coach_name,
        });
        if (!coach) {
          coach = await Coach.create({ coach_name: scheduleData.coach_name });
        }

        // Check if the field exists, if not create a new field
        let field = await Field.findOne({
          field_name: scheduleData.field_name,
        });
        if (!field) {
          field = await Field.create({ field_name: scheduleData.field_name });
        }

        // Use the IDs of the created or existing team, coach, and field to create the schedule
        const schedule = await Schedule.create({
          team_id: team._id,
          coach_id: coach._id,
          field_id: field._id,
          ...scheduleData,
        });

        return schedule;
      })
    );

    return res.status(200).json({
      success: true,
      message: "Schedules imported successfully",
      schedules: createSchedules, // Replace 'importedSchedules' with the actual imported data
    });
  } catch (error) {
    console.error("Error importing schedules:", error);
    return res.status(500).json({ success: false, error: "Server Error" });
  }
};

// Helper function to format date to time string in HH:mm format
function formatDateToString(date) {
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

const formatDateToString1 = (date) => {
  // Check if the input is a valid Date object
  if (!(date instanceof Date)) {
    return ''; // Return empty string or handle the error appropriately
  }

  // Get hours and minutes in UTC timezone
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();

  // Pad single digit hours and minutes with leading zeros
  const formattedHours = hours.toString().padStart(2, '0');
  const formattedMinutes = minutes.toString().padStart(2, '0');

  // Concatenate hours and minutes with a colon to get HH:mm format
  return `${formattedHours}:${formattedMinutes}`;
};

