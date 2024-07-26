const { Coach, Team, Field, Club, User, Schedule, IsSchedulesCreating } = require("../models/schema");
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;

exports.dashboardDetailsByClubId = async (req, res) => {
  try {
    const clubId = req.params.club_id;
    const userId = req.user.userId;

    // Fetch club details and user details
    const clubDetails = await Club.findOne({ _id: clubId });

    if (clubDetails && clubDetails.club_profile == "null") {
      clubDetails.club_profile = null;
    }
    const userDetails = await User.findOne({ _id: userId });

    // Fetch counts for active coaches, teams, and fields
    const activeCoachesCount = await Coach.countDocuments({
      club_id: clubId,
      is_active: true,
      deleted_at: { $in: [null, undefined, ''] }
    });

    const activeTeamsCount = await Team.countDocuments({
      club_id: clubId,
      is_active: true,
      deleted_at: { $in: [null, undefined, ''] }
    });

    const activeFieldsCount = await Field.countDocuments({
      club_id: clubId,
      is_active: true,
      deleted_at: { $in: [null, undefined, ''] }
    });

    let IsSchedules = await IsSchedulesCreating.findOne({ club_id: clubId });

    // Fetch schedules with upcoming dates
    let schedules = await Schedule.aggregate([
      {
        $addFields: {
          schedule_date_iso: {
            $dateFromString: {
              dateString: '$schedule_date',
              format: '%m/%d/%Y',
            },
          },
        },
      },
      {
        $match: {
          club_id: new ObjectId(clubId),
          schedule_date_iso: { $gte: new Date() } // Filter for upcoming dates
        }
      },
      { $sort: { schedule_date_iso: 1 } },
      { $limit: 5 },
    ])
      .lookup({
        from: 'teams',
        localField: 'team_id',
        foreignField: '_id',
        as: 'team_id',
      })
      .lookup({
        from: 'fields',
        localField: 'field_id',
        foreignField: '_id',
        as: 'field_id',
      })
      .lookup({
        from: 'coaches',
        localField: 'coach_id',
        foreignField: '_id',
        as: 'coach_id',
      })
      .unwind('$team_id')
      .unwind('$field_id')
      .unwind('$coach_id');

    schedules = schedules.map(schedule => {
      schedule.team_name = schedule.team_id.team_name;
      schedule.field_name = schedule.field_id.field_name;
      schedule.coach_name = `${schedule.coach_id.first_name} ${schedule.coach_id.last_name}`;
      return schedule;
    });

    // Combine club and user details
    const combinedDetails = {
      club: clubDetails || {},
      user: userDetails || {},
      schedules: (IsSchedules && IsSchedules.is_schedules_creating) ? [] : schedules,
      counts: {
        coach: activeCoachesCount || 0,
        team: activeTeamsCount || 0,
        field: activeFieldsCount || 0,
      },
    };

    // Return the response with dashboard details
    return res.status(200).json({
      success: true,
      message: "Dashboard Details",
      dashboardDetails: combinedDetails,
    });
  } catch (error) {
    console.error("Error fetching Dashboard Details:", error);
    // Log detailed error information or provide specific error messages
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};


