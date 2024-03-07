const { Team, Club, Coach } = require("../models/schema");
const ExcelJS = require("exceljs");
const fs = require("fs").promises;
const path = require("path");

exports.createTeam = async (req, res) => {
  try {
    let {
      team_name,
      club_id,
      coach_id,
      age_group,
      practice_length,
      no_of_players,
      practice_start_time,
      practice_end_time,
      preferred_field_size,
      preferred_days,
      is_travelling,
      travelling_date,
      region,
      team_level,
      gender
    } = req.body;

    // Check if a coach_id is provided
    let coachCount = 0;
    let maxTeamsPerCoach = Infinity; // Default to no limit
    if (coach_id) {
      // Count how many teams the coach is currently coaching
      coachCount = await Team.countDocuments({ coach_id });
      // Get the coach details
      const coach = await Coach.findById(coach_id);
      if (coach) {
        maxTeamsPerCoach = coach.max_team_you_coach;
      }
    }

    // Check if the coach has reached the maximum limit
    if (coachCount >= maxTeamsPerCoach) {
      return res.status(400).json({ success: false, message: "Coach has reached maximum number of teams. Update number of teams under Coach." });
    }

    // Create the team
    let createTeam = await Team.create({
      team_name,
      club_id,
      age_group,
      coach_id,
      practice_length,
      no_of_players,
      practice_start_time,
      practice_end_time,
      preferred_field_size,
      preferred_days,
      is_travelling,
      travelling_date,
      region,
      team_level,
      gender
    });
    if (!createTeam) {
      return res.status(400).json({ success: false, message: "Error creating the team" });
    } else {
      return res.status(201).json({
        success: true,
        message: `Successfully created ${team_name}`,
        team: createTeam,
      });
    }
  } catch (error) {
    console.log("error in create team :- ", error);
    return res.status(500).json({ message: "Server Error" });
  }
};

exports.updateTeam = async (req, res) => {
  try {
    const team_id = req.params.teamId;

    const {
      team_name,
      age_group,
      coach_id,
      practice_length,
      no_of_players,
      practice_start_time,
      practice_end_time,
      preferred_field_size,
      preferred_days,
      is_travelling,
      travelling_date,
      region,
      team_level,
      gender
    } = req.body;

    // Get the current team details
    const currentTeam = await Team.findById(team_id);

    // Check if the coach is being updated
    if (coach_id && coach_id !== currentTeam.coach_id) {
      // Check the number of preexisting teams the new coach is associated with
      const coachTeamsCount = await Team.countDocuments({ coach_id });

      // Get coach details
      const coach = await Coach.findById(coach_id);

      // Check if the new coach is allowed to coach another team
      if (coach && coach.max_team_you_coach <= coachTeamsCount) {
        return res.status(400).json({
          success: false,
          message: "Coach has reached maximum number of teams. Update number of teams under Coach.",
        });
      }
    }

    // Update the team's details without checking coach's limit
    const updatedTeam = await Team.findByIdAndUpdate(
      team_id,
      {
        $set: {
          team_name,
          age_group,
          coach_id,
          practice_length,
          no_of_players,
          practice_start_time,
          practice_end_time,
          preferred_field_size,
          preferred_days,
          is_travelling,
          travelling_date,
          region,
          team_level,
          gender
        },
      },
      { new: true } // Return the updated team
    );

    if (!updatedTeam) {
      return res
        .status(404)
        .json({ success: false, message: "Team not found" });
    }

    return res.status(200).json({
      success: true,
      message: `Successfully updated ${team_name}`,
      team: updatedTeam,
    });
  } catch (error) {
    console.error("Error updating team:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.softDeleteTeam = async (req, res) => {
  try {
    const teamId = req.params.teamId;

    // Find the team by ID and update the 'deleted_at' field
    const softDeletedTeam = await Team.findByIdAndUpdate(
      teamId,
      {
        $set: {
          deleted_at: new Date(),
        },
      },
      { new: true } // Return the updated team
    );

    if (!softDeletedTeam) {
      return res
        .status(404)
        .json({ success: false, message: "Team not found" });
    }

    return res.status(200).json({
      success: true,
      message: `Successfully soft deleted ${softDeletedTeam.team_name}`,
      team: softDeletedTeam,
    });
  } catch (error) {
    console.error("Error soft deleting team:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.getTeamsByClubId = async (req, res) => {
  try {
    const clubId = req.params.club_id;
    const { search, sort, page } = req.query;

    // Pagination settings
    const pageSize = 10; // Number of items per page
    const currentPage = parseInt(page) || 1; // Current page, default is 1

    let query = {
      club_id: clubId,
      deleted_at: { $in: [null, undefined] },
    };

    // Add search filter if provided
    if (search) {
      query = {
        ...query,
        $or: [
          { team_name: { $regex: new RegExp(search, 'i') } },
          { age_group: { $regex: new RegExp(search, 'i') } },
          { gender: { $regex: new RegExp(search, 'i') } },
          // Add other fields for search as needed
        ],
      };
    }

    let sortOption = {};
    // Add sorting based on the provided value
    switch (parseInt(sort)) {
      case 1:
        sortOption = { team_name: 1 }; // AtoZ
        break;
      case 2:
        sortOption = { team_name: -1 }; // ZtoA
        break;
      case 3:
        sortOption = { gender: 1 }; // Gender (ascending order)
        break;
      case 4:
        sortOption = { age_group: 1 }; // Age (ascending order)
        break;
      case 5:
        sortOption = { is_active: -1 }; // Status (active first)
        break;
      case 6:
        sortOption = { created_at: -1 }; // Date (latest first)
        break;
      default:
        // Default sorting, you can change this to your needs
        sortOption = { team_name: 1 };
        break;
    }

    const totalTeams = await Team.countDocuments(query);
    const totalPages = Math.ceil(totalTeams / pageSize);

    const teams = await Team.find(query)
      .populate("coach_id")
      .sort(sortOption)
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize);

    if (!teams || teams.length === 0) {
      return res.status(404).json({ success: false, message: "No active teams found for the club" });
    }

    return res.status(200).json({
      success: true,
      message: "Teams list for the club",
      teams: teams,
      pagination: {
        totalItems: totalTeams,
        totalPages: totalPages,
        currentPage: currentPage,
      },
    });
  } catch (error) {
    console.error("Error fetching teams by club ID:", error);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

exports.getTeamsList = async (req, res) => {
  try {
    const clubId = req.params.club_id;


    const teams = await Team.find({ club_id: clubId })

    if (!teams || teams.length == 0) {
      return res.status(404).json({ success: false, message: "No active teams found " });
    }

    return res.status(200).json({
      success: true,
      message: "Teams list ",
      teams: teams,
    });
  } catch (error) {
    console.error("Error fetching teams by club ID:", error);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

exports.viewTeamById = async (req, res) => {
  try {
    const teamId = req.params.teamId;

    // Find the team by team ID
    const team = await Team.findById(teamId).populate("coach_id");

    if (!team) {
      return res
        .status(404)
        .json({ success: false, message: "Team not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Team details",
      team,
    });
  } catch (error) {
    console.error("Error fetching team by team ID:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};

exports.importTeams = async (req, res) => {
  try {
    let { club_id } = req.params;
    const { team_data } = req.body;

    let teamsCreated = [];
    let teamsWithExceededCoachLimit = [];

    await Promise.all(
      team_data.map(async (teamData) => {
        teamData.club_id = club_id;

        // Check for required keys
        const requiredKeys = ['team_name', 'no_of_players', 'age_group', 'team_level', 'practice_start_time', 'practice_end_time', 'preferred_field_size', 'preferred_days'];
        const missingKeys = requiredKeys.filter(key => {
          const value = teamData[key];
          if (Array.isArray(value)) {
            return value.length == 0;
          } else {
            return typeof value != 'string' || value.trim() == '';
          }
        });

        if (missingKeys.length > 0) {
          teamData.error = `Missing or empty values for required keys: ${missingKeys.join(', ')}`;
          teamsWithExceededCoachLimit.push(teamData);
          return;
        }

        // Check if coachName is provided
        if (teamData.coachName) {
          // Convert coachName to lowercase and extract first_name and last_name
          let firstName, lastName;

          const coachNameParts = teamData.coachName.toLowerCase().split(' ');
          if (coachNameParts.length === 1) {
            firstName = coachNameParts[0];
            lastName = null //''
          } else {
            [firstName, lastName] = coachNameParts;
          }
          console.log(firstName, lastName)
          // Check if coach exists (with both first_name and last_name in lowercase)
          let coachId;
          let query = { first_name: { $regex: new RegExp(firstName, "i") } };

          // If last name is not null, include it in the query
          if (lastName) {
            query.last_name = { $regex: new RegExp(lastName, "i") };
          }

          const existingCoach = await Coach.findOne(query);
          if (existingCoach) {
            coachId = existingCoach._id;
          } else {
            // If coach doesn't exist, create new coach
            const newCoach = await Coach.create({ first_name: firstName, last_name: lastName });
            coachId = newCoach._id;
          }
          // Assign coach_id to teamData and remove coachName
          teamData.coach_id = coachId;
          // Check if coach has reached the maximum limit
          const coachCount = await Team.countDocuments({ coach_id: coachId });
          const coach = await Coach.findById(coachId);
          if (coachCount >= coach.max_team_you_coach) {
            delete teamData.coach_id;
            teamData.error = "Coach has reached maximum number of teams. Update number of teams under Coach."
            teamsWithExceededCoachLimit.push(teamData);
            return;
          }
        }

        const findTeam = await Team.findOne({ team_name: teamData.team_name, club_id: club_id, deleted_at: null });

        if (!findTeam) {
          delete teamData.coachName;
          const createTeam = await Team.create(teamData);
          teamsCreated.push(createTeam);
        } else {
          teamData.error = "Team Already exists."
          teamsWithExceededCoachLimit.push(teamData);
        }
      })
    );
    return res.status(201).json({
      success: true,
      message: `Successfully imported teams`,
      teamsCreated,
      teamsWithExceededCoachLimit,
    });
  } catch (error) {
    console.error("Error in import teams:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};


exports.activateOrDeactivateTeam = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { is_active } = req.body;

    // Validate is_active value
    if (is_active === undefined || typeof is_active !== "boolean") {
      return res
        .status(400)
        .json({ success: false, message: "Invalid is_active value" });
    }

    // Update team document
    const updatedTeam = await Team.findByIdAndUpdate(
      teamId,
      { $set: { is_active } },
      { new: true }
    );

    if (!updatedTeam) {
      return res
        .status(404)
        .json({ success: false, message: "team not found" });
    }

    let status = is_active == true ? "activated" : "deactivated";
    return res
      .status(200)
      .json({
        success: true,
        message: `Team ${status} successfully`,
        team: updatedTeam,
      });
  } catch (error) {
    console.error("Error in activate/deactivate Team:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};
