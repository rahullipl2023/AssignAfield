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

    const schedules = await Schedule.find({ club_id: clubId })
      .sort({ created_at: 1 }) // Sort in descending order based on creation time
      .limit(5) // Limit the result to the latest 5 schedules
      .populate("team_id") // Assuming 'team_name' is the field to be populated from the Team model
      .populate("field_id") // Assuming 'field_name' is the field to be populated from the Field model
      .populate("coach_id"); // Assuming 'first_name' and 'last_name' are the fields to be populated from the Coach model

    // Combine club and user details
    const combinedDetails = {
      club: clubDetails || {},
      user: userDetails || {},
      schedules : schedules || [],
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
