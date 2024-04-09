const { Coach, Team, Field, Club, User, Schedule } = require("../models/schema");

exports.dashboardDetailsByClubId = async (req, res) => {
  try {
    const clubId = req.params.club_id;
    const userId = req.user.userId;

    // Fetch club details and user details
    const clubDetails = await Club.findOne({ _id: clubId });

    if(clubDetails && clubDetails.club_profile == "null"){
      clubDetails.club_profile = null
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

    let schedules = await Schedule.find({ club_id: clubId })
      .sort({ schedule_date: 1 }) // Sort in descending order based on creation time
      .limit(5) // Limit the result to the latest 5 schedules
      .populate("team_id") // Assuming 'team_name' is the field to be populated from the Team model
      .populate("field_id") // Assuming 'field_name' is the field to be populated from the Field model
      .populate("coach_id"); // Assuming 'first_name' and 'last_name' are the fields to be populated from the Coach model
    
    // Map through each schedule and modify the portion_name field
    const modifiedSchedules = schedules.map(schedule => {
      switch (schedule.portion_name) {
        case "A":
          schedule.portion_name = 1;
          break;
        case "B":
          schedule.portion_name = 2;
          break;
        case "C":
          schedule.portion_name = 3;
          break;
        case "D":
          schedule.portion_name = 4;
          break;
        case "E":
          schedule.portion_name = 5;
          break;
        case "F":
          schedule.portion_name = 6;
          break;
        case "G":
          schedule.portion_name = 7;
          break;
        case "H":
          schedule.portion_name = 8;
          break;
        // Add more cases for other letters as needed
        default:
          schedule.portion_name = 0
      }
      schedule.portion_name = Number(schedule.portion_name)
      return schedule;
    });

    // Combine club and user details
    const combinedDetails = {
      club: clubDetails || {},
      user: userDetails || {},
      schedules : modifiedSchedules || [],
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
    return res
      .status(500)
      .json({ auccess: false, error: "Internal Server Error" });
  }
};
