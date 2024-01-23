const { Coach, Team, Field, Club, User } = require("../models/schema");

exports.dashboardDetailsByClubId = async (req, res) => {
  try {
    const clubId = req.params.club_id;
    const userId = req.user.userId;

    // Fetch club details and user details
    const clubDetails = await Club.findOne({ _id: clubId });
    const userDetails = await User.findOne({ _id: userId });

    // Fetch counts for active coaches, teams, and fields
    const activeCoachesCount = await Coach.countDocuments({
      club_id: clubId,
      is_active: true,
    });

    const activeTeamsCount = await Team.countDocuments({
      club_id: clubId,
      is_active: true,
    });

    const activeFieldsCount = await Field.countDocuments({
      club_id: clubId,
      is_active: true,
    });

    // Combine club and user details
    const combinedDetails = {
      club: clubDetails || {},
      user: userDetails || {},
      counts: {
        coach: activeCoachesCount || 0,
        team: activeTeamsCount || 0,
        field: activeFieldsCount || 0,
      },
    };

    // Return the response with dashboard details
    return res.status(200).json({
      success : true, 
      message: "Dashboard Details",
      dashboardDetails: combinedDetails,
    });
  } catch (error) {
    console.error("Error fetching Dashboard Details:", error);
    // Log detailed error information or provide specific error messages
    return res.status(500).json({ auccess : false, error: "Internal Server Error" });
  }
};
