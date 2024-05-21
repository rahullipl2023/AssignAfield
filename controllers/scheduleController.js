// Import necessary modules and models
const { Team, Coach, Schedule, Field, IsSchedulesCreating } = require("../models/schema");
const { ObjectId } = require('mongoose').Types;
const { eventEmitter } = require('./events');

// Create Schedule 
exports.createSchedule = async (req, res) => {
  try {
    const {
      team_id,
      club_id,
      coach_id,
      field_id,
      field_portion,
      schedule_day,
      schedule_date,
      practice_start_time,
      practice_end_time,
      practice_length,
      portion_name,
      contact_number,
      permit
    } = req.body;

    // Create a new schedule instance
    const newSchedule = new Schedule({
      team_id,
      club_id,
      coach_id,
      field_id,
      field_portion,
      schedule_day,
      schedule_date,
      practice_start_time,
      practice_end_time,
      practice_length,
      portion_name,
      contact_number,
      permit
    });

    // Save the new schedule to the database
    const savedSchedule = await newSchedule.save();

    res.status(201).json({
      success: true,
      message: "Schedule created successfully",
      schedule: savedSchedule
    });
  } catch (error) {
    console.error("Error creating schedule:", error);
    res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
};

// Update Schedule
exports.updateSchedule = async (req, res) => {
  try {
    const {
      team_id,
      club_id,
      coach_id,
      field_id,
      field_portion,
      schedule_day,
      schedule_date,
      practice_start_time,
      practice_end_time,
      practice_length,
      portion_name,
      contact_number,
      permit
    } = req.body;

    const scheduleId = req.params.id; // Assuming the schedule ID is passed in the request parameters

    // Check if the schedule exists
    const existingSchedule = await Schedule.findById(scheduleId);
    if (!existingSchedule) {
      return res.status(404).json({
        success: false,
        message: "Schedule not found"
      });
    }

    // Update the schedule with new data
    existingSchedule.team_id = team_id;
    existingSchedule.club_id = club_id;
    existingSchedule.coach_id = coach_id;
    existingSchedule.field_id = field_id;
    existingSchedule.field_portion = field_portion;
    existingSchedule.schedule_day = schedule_day;
    existingSchedule.schedule_date = schedule_date;
    existingSchedule.practice_start_time = practice_start_time;
    existingSchedule.practice_end_time = practice_end_time;
    existingSchedule.practice_length = practice_length;
    existingSchedule.portion_name = portion_name;
    existingSchedule.contact_number = contact_number;
    existingSchedule.permit = permit;

    // Save the updated schedule to the database
    const updatedSchedule = await existingSchedule.save();

    res.status(200).json({
      success: true,
      message: "Schedule updated successfully",
      schedule: updatedSchedule
    });
  } catch (error) {
    console.error("Error updating schedule:", error);
    res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
};

// Get Schedules By Club Id with Sort, Pagination, and Response Metadata
exports.getSchedulesByClubId = async (req, res) => {
  try {
    const club_id = req.params.clubId;
    const { search, sort, page, pageSize } = req.query;
    console.log(sort, "sort value", typeof sort, "type")
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
      // Sorting by schedule date
      sortOption = {}; // No initial sort option, will be sorted later
    } else if (sort == "6") {
      // Sorting by schedule date in descending order
      sortOption = {}; // No initial sort option, will be sorted later
    }

    const currentPage = parseInt(page) || 1;
    const pageSizeValue = parseInt(pageSize) || 10;

    const skip = (currentPage - 1) * pageSizeValue;
    // const schedules = await Schedule.find(query)
    //   .populate("team_id")
    //   .populate("field_id")
    //   .populate("coach_id")
    //   .sort(sortOption)
    //   .skip(skip)
    //   .limit(pageSizeValue);

    let schedules;

    // If sorting by date, retrieve schedules without initial sort and sort them later
    if (sort == "5" || sort == "6") {
      console.log("in the iff")
      schedules = await Schedule.find(query)
        .populate("team_id")
        .populate("field_id")
        .populate("coach_id")
        .skip(skip)
        .limit(pageSizeValue)
        .lean(); // Use lean() to get plain JavaScript objects instead of Mongoose documents

      schedules = schedules.sort((a, b) => {
        console.log(a, "a")
        console.log(b, "b")
        const dateA = new Date(a.schedule_date);
        const dateB = new Date(b.schedule_date);
        console.log(dateA, dateB)
        return sort == "5" ? dateA - dateB : dateB - dateA;
      });
    } else {
      // Otherwise, retrieve schedules with the specified sort option
      schedules = await Schedule.find(query)
        .populate("team_id")
        .populate("field_id")
        .populate("coach_id")
        .sort(sortOption)
        .skip(skip)
        .limit(pageSizeValue)
        .lean(); // Use lean() to get plain JavaScript objects instead of Mongoose documents
    }

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
    const { team_id, coach_id, search, sort_by, page, pageSize } = req.query;

    let IsSchedules = await IsSchedulesCreating.findOne({ club_id: club_id })
    if (IsSchedules && IsSchedules.is_schedules_creating) {
      return res.status(200).json({
        success: true,
        message: "Schedules are being created. Please wait until the process is completed.",
        schedules: [],
        metadata: {
          totalCount: 0,
          currentPage: 1,
          totalPages: 0,
        },
      });
    }


    let query = {
      club_id: new ObjectId(club_id),
      $or: [],
    };

    if (team_id && ObjectId.isValid(team_id)) {
      query.$or.push({ team_id: new ObjectId(team_id) });
    }

    if (coach_id && ObjectId.isValid(coach_id)) {
      query.$or.push({ coach_id: new ObjectId(coach_id) });
    }

    // Ensure that $or array is not empty
    if (query.$or.length === 0) {
      delete query.$or;
    }

    // Construct sort option
    const sortOption = {};
    switch (sort_by) {
      case '1':
        sortOption.team_name = 1;
        break;
      case '2':
        sortOption.team_name = -1;
        break;
      case '3':
        sortOption.practice_start_time = 1;
        break;
      case '4':
        sortOption.practice_start_time = -1;
        break;
      case '5':
        sortOption.schedule_date = 1;
        break;
      case '6':
        sortOption.schedule_date = -1;
        break;
      default:
        // Handle default sorting here if needed
        sortOption.schedule_date = 1;
        break;
    }

    const currentPage = parseInt(page) || 1;
    const pageSizeValue = parseInt(pageSize) || 10;

    const skip = (currentPage - 1) * pageSizeValue;

    // Construct aggregation pipeline
    const aggregationPipeline = [
      { $match: query },
      { $lookup: { from: 'teams', localField: 'team_id', foreignField: '_id', as: 'team_id' } },
      { $lookup: { from: 'coaches', localField: 'coach_id', foreignField: '_id', as: 'coach_id' } },
      { $lookup: { from: 'fields', localField: 'field_id', foreignField: '_id', as: 'field_id' } },
      // Unwind arrays
      { $unwind: '$team_id' },
      { $unwind: '$coach_id' },
      { $unwind: '$field_id' },
      // Project fields
      {
        $project: {
          team_name: { $ifNull: ['$team_id.team_name', ''] },
          club_id: { $ifNull: ['$club_id', ''] },
          field_portion: { $ifNull: ['$field_portion', ''] },
          schedule_day: { $ifNull: ['$schedule_day', ''] },
          schedule_date: { $ifNull: ['$schedule_date', ''] },
          practice_start_time: { $ifNull: ['$practice_start_time', ''] },
          practice_end_time: { $ifNull: ['$practice_end_time', ''] },
          practice_length: { $ifNull: ['practice_length', 0] },
          portion_name: { $ifNull: ['$portion_name', 0] },
          contact_number: { $ifNull: ['$contact_number', ''] },
          permit: { $ifNull: ['$permit', ''] },
          is_active: { $ifNull: ['$is_active', 1] },
          created_at: { $ifNull: ['$created_at', ''] },
          field_id: '$field_id',
          team_id: '$team_id',
          coach_id: '$coach_id',
        }
      },
    ];


    // Add $unwind stages conditionally based on the presence of coach_id and team_id
    if (!coach_id) {
      aggregationPipeline.push({ $unwind: '$coach_id' });
    }
    if (!team_id) {
      aggregationPipeline.push({ $unwind: '$team_id' });
    }

    // Add remaining stages
    aggregationPipeline.push(
      { $sort: sortOption },
      { $skip: skip },
      { $limit: pageSizeValue }
    );

    // Execute aggregation
    const schedules = await Schedule.aggregate(aggregationPipeline);

    // If sort_by is '5' (sorting by date), sort the schedules array
    if (sort_by == '5' || sort_by == '6') {
      schedules.sort((a, b) => {
        const dateA = new Date(a.schedule_date);
        const dateB = new Date(b.schedule_date);
        return (sort_by == '5') ? dateA - dateB : dateB - dateA;
      });
    }

    const totalCount = await Schedule.countDocuments(query);
    const totalPages = Math.ceil(totalCount / pageSizeValue);
    let message = (schedules.length > 0) ? "Schedules retrieved successfully" : "No Schedule Available";

    return res.status(200).json({
      success: true,
      message: message,
      schedules: schedules,
      metadata: {
        totalCount: totalCount,
        currentPage: currentPage,
        totalPages: totalPages,
      },
    });
  } catch (error) {
    console.error("Error getting schedules by team or coach:", error);
    return res.status(500).json({ success: false, message: error });
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

exports.exportSchedules = async (req, res) => {
  try {
    // Extract start date and end date from query parameters
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const { clubId } = req.params
    // Validate startDate and endDate format
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, error: "Start date and end date are required." });
    }

    // Convert start date and end date strings to JavaScript Date objects
    const startDateObj = parseDate(startDate);
    const endDateObj = parseDate(endDate);
    // Construct query to find schedules within the date range
    const query = {
      club_id: new ObjectId(clubId),
      schedule_date: {
        $gte: startDate,
        $lte: endDate
      }
    };

    const aggregationPipeline = [
      { $match: query },
      { $lookup: { from: 'teams', localField: 'team_id', foreignField: '_id', as: 'team_id' } },
      { $lookup: { from: 'coaches', localField: 'coach_id', foreignField: '_id', as: 'coach_id' } },
      { $lookup: { from: 'fields', localField: 'field_id', foreignField: '_id', as: 'field_id' } },
      // Unwind arrays
      { $unwind: '$team_id' },
      { $unwind: '$coach_id' },
      { $unwind: '$field_id' },
      // Project fields
      {
        $project: {
          team_name: { $ifNull: ['$team_id.team_name', ''] },
          club_id: { $ifNull: ['$club_id', ''] },
          field_portion: { $ifNull: ['$field_portion', ''] },
          schedule_day: { $ifNull: ['$schedule_day', ''] },
          // schedule_date: { $ifNull: ['$schedule_date', ''] },
          schedule_date: {
            $dateFromString: {
              dateString: '$schedule_date',
              format: '%m/%d/%Y'
            }
          },
          practice_start_time: { $ifNull: ['$practice_start_time', ''] },
          practice_end_time: { $ifNull: ['$practice_end_time', ''] },
          practice_length: { $ifNull: ['practice_length', 0] },
          portion_name: { $ifNull: ['$portion_name', 0] },
          contact_number: { $ifNull: ['$contact_number', ''] },
          permit: { $ifNull: ['$permit', ''] },
          is_active: { $ifNull: ['$is_active', 1] },
          created_at: { $ifNull: ['$created_at', ''] },
          field_id: '$field_id',
          team_id: '$team_id',
          coach_id: '$coach_id',
        }
      },
      // Sort by schedule_date and field_name
      { $sort: { 'schedule_date': 1, 'field_id.field_name': 1 } }
    ];
    // Retrieve schedules within the date range
    const schedules = await Schedule.aggregate(aggregationPipeline)

    if (schedules.length > 0) {
      return res.status(200).json({
        success: true,
        message: "Schedules within the date range retrieved successfully",
        schedules: schedules
      });
    } else {
      return res.status(200).json({
        success: false,
        message: "No schedules found within the date range",
        schedules: schedules
      });
    }
  } catch (error) {
    console.error("Error exporting schedules:", error);
    return res.status(500).json({ success: false, error: "Server Error" });
  }
};

// Function to parse date string "mm/dd/yyyy" to Date object
function parseDate(dateString) {
  const parts = dateString.split('/');
  // Adjust for two-digit year format (assuming 20th century)
  const year = parseInt(parts[2]) + 2000;
  const month = parseInt(parts[0]) - 1; // Month is 0-indexed
  const day = parseInt(parts[1]);
  return new Date(year, month, day);
}
