// Import necessary modules and models
const { Team, Coach, Club, Schedule } = require("../models/schema");

// Create Schedule
exports.createSchedule = async (req, res) => {
  try {
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

// Get Schedules By Club Id with Search and Sort
exports.getSchedulesByClubId = async (req, res) => {
  try {
    const club_id = req.params.clubId;
    const { search, sort } = req.query;
    let query = { club_id };

    if (search) {
      query.$or = [
        { team_id: { $regex: search, $options: "i" } },
        { field_id: { $regex: search, $options: "i" } },
        { coach_id: { $regex: search, $options: "i" } },
      ];
    }

    const sortOption = sort ? { [sort]: 1 } : null;

    const schedules = await Schedule.find(query)
      .populate("team_id", "team_name") // Assuming 'team_name' is the field to be populated from the Team model
      .populate("field_id", "field_name") // Assuming 'field_name' is the field to be populated from the Field model
      .populate("coach_id", "first_name last_name") // Assuming 'first_name' and 'last_name' are the fields to be populated from the Coach model
      .sort(sortOption);

    return res.status(200).json({
      success: true,
      message: "Schedules retrieved successfully",
      schedules: schedules,
    });
  } catch (error) {
    console.error("Error getting schedules by club ID:", error);
    return res.status(500).json({ success: false, error: "Server Error" });
  }
};

// Get Schedules By Team Id OR Coach Id
exports.getSchedulesByTeamOrCoach = async (req, res) => {
  try {
    const club_id = req.params.clubId;
    const { team_id, coach_id } = req.query;

    const query = {
      club_id,
      $or: [{ team_id }, { coach_id }],
    };

    const schedules = await Schedule.find(query);

    return res.status(200).json({
      success: true,
      message: "Schedules retrieved successfully",
      schedules: schedules,
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
      .populate("team_id", "team_name")
      .populate("field_id", "field_name")
      .populate("coach_id", "first_name last_name");

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
    // Implement the logic to read and import schedule data from the Excel sheet
    // You can use libraries like 'exceljs' for handling Excel sheets
    // ...

    return res.status(200).json({
      success: true,
      message: "Schedules imported successfully",
      schedules: importedSchedules, // Replace 'importedSchedules' with the actual imported data
    });
  } catch (error) {
    console.error("Error importing schedules:", error);
    return res.status(500).json({ success: false, error: "Server Error" });
  }
};
