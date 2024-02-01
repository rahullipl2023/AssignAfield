const { Team, Coach, Club } = require("../models/schema");
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
      preferred_timing,
      preferred_field_size,
      preferred_days,
      practice_season,
      rsvp_duration,
      is_travelling,
      travelling_date,
      travelling_start,
      travelling_end,
      region, 
      team_level, 
      gender
    } = req.body;

    let createTeam = await Team.create({
      team_name,
      club_id,
      coach_id,
      age_group,
      practice_length,
      no_of_players,
      preferred_timing,
      preferred_field_size,
      preferred_days,
      practice_season,
      rsvp_duration,
      is_travelling,
      travelling_date,
      travelling_start,
      travelling_end,
      region, 
      team_level, 
      gender
    });
    if (!createTeam) {
      return res
        .status(400)
        .json({ success: false, message: "Error creating the team" });
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
      coach_id,
      age_group,
      practice_length,
      no_of_players,
      preferred_timing,
      preferred_field_size,
      preferred_days,
      practice_season,
      rsvp_duration,
      time_off,
      is_travelling,
      travelling_date,
      travelling_start,
      travelling_end,
      region, 
      team_level, 
      gender
    } = req.body;

    // Find the team by ID and update its details
    const updatedTeam = await Team.findByIdAndUpdate(
      team_id,
      {
        $set: {
          team_name,
          coach_id,
          age_group,
          practice_length,
          no_of_players,
          preferred_timing,
          preferred_field_size,
          preferred_days,
          practice_season,
          rsvp_duration,
          time_off,
          is_travelling,
          travelling_date,
          travelling_start,
          travelling_end,
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
      .populate('coach_id') // Populate the coach details
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


    const teams = await Team.find({club_id:clubId})
      .populate('coach_id') // Populate the coach details

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
    const team = await Team.findById(teamId);

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
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    let { club_id } = req.params;

    const file = req.file;

    // Check if the buffer is a valid Buffer instance
    if (!Buffer.isBuffer(file.buffer)) {
      return res.status(400).json({ success: false, message: "Invalid file buffer" });
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

    const teamsData = [];

    // Use for...of loop to ensure asynchronous operations complete before moving on
   for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);

      // Skip header row
      if (rowNumber !== 1) {
        const [
          ,
          team_name,
          coach_name,
          age_group,
          practice_length,
          no_of_players,
          preferred_timing,
          preferred_field_size,
          preferred_days,
          gender,
          team_level,
          travel_time_start,
          travel_time_end,
          region,
        ] = row.values;

        let coach;

        // Check if coach_name is defined
        if (coach_name) {
          // Split coach_name into first_name and last_name
          const [first_name, last_name] = coach_name.includes(' ')
            ? coach_name.split(' ')
            : [coach_name, coach_name];

          // Create or find the coach based on first_name and last_name
          coach = await Coach.findOneAndUpdate(
            { club_id, first_name, last_name },
            { club_id, first_name, last_name },
            { upsert: true, new: true }
          );
        }

        teamsData.push({
          club_id,
          team_name,
          coach_id: coach ? coach._id : null,
          age_group,
          practice_length : practice_length ? Number(practice_length.split(' ')[0]) : 0,
          no_of_players,
          preferred_timing,
          preferred_field_size,
          preferred_days: preferred_days ? preferred_days.split(',').map(day => day.trim()) : [],
          gender,
          team_level,
          travel_time_start,
          travel_time_end,
          region,
        });
      }
    }

    // Create teams without a transaction
    const createdTeams = await Promise.all(
      teamsData.map(async (teamData) => {
        const createTeam = await Team.create(teamData);
        return createTeam;
      })
    );

    return res.status(201).json({
      success: true,
      message: `Successfully imported teams`,
      teams: createdTeams,
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
    return res.status(500).json({ success : false, message: "Server Error" });
  }
};
