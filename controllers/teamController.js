const { Team } = require("../models/schema");
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
      travelling_start,
      travelling_end,
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
      travelling_start,
      travelling_end,
    });
    if (!createTeam) {
      return res.status(400).json({ msg: "Error creating the team" });
    } else {
      return res.status(201).json({
        msg: `Successfully created ${team_name}`,
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
    const {
      team_id,
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
      travelling_start,
      travelling_end,
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
          travelling_start,
          travelling_end,
        },
      },
      { new: true } // Return the updated team
    );

    if (!updatedTeam) {
      return res.status(404).json({ msg: "Team not found" });
    }

    return res.status(200).json({
      msg: `Successfully updated ${team_name}`,
      team: updatedTeam,
    });
  } catch (error) {
    console.error("Error updating team:", error);
    return res.status(500).json({ message: "Server Error" });
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
      return res.status(404).json({ msg: "Team not found" });
    }

    return res.status(200).json({
      msg: `Successfully soft deleted ${softDeletedTeam.team_name}`,
      team: softDeletedTeam,
    });
  } catch (error) {
    console.error("Error soft deleting team:", error);
    return res.status(500).json({ message: "Server Error" });
  }
};

exports.getTeamsByClubId = async (req, res) => {
  try {
    const clubId = req.params.club_id;

    // Find teams by club ID where deleted_at is either null or undefined
    const teams = await Team.find({
      club_id: clubId,
      deleted_at: { $in: [null, undefined] },
    });

    if (!teams || teams.length === 0) {
      return res
        .status(404)
        .json({ msg: "No active teams found for the club" });
    }

    return res.status(200).json({
      message: "Teams list for the club",
      teams: teams,
    });
  } catch (error) {
    console.error("Error fetching teams by club ID:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.viewTeamById = async (req, res) => {
  try {
    const teamId = req.params.teamId;

    // Find the team by team ID
    const team = await Team.findById(teamId);

    if (!team) {
      return res.status(404).json({ msg: "Team not found" });
    }

    return res.status(200).json({
      status: true,
      message: "Team details",
      team,
    });
  } catch (error) {
    console.error("Error fetching team by team ID:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.importTeams = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: "No file uploaded" });
    }

    let { club_id } = req.params;

    const file = req.file;

    // Check if the buffer is a valid Buffer instance
    if (!Buffer.isBuffer(file.buffer)) {
      return res.status(400).json({ msg: "Invalid file buffer" });
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

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber !== 1) {
        // Skip header row
        const [
          ,
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
        ] = row.values;


        teamsData.push({
          club_id,
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
        });
      }
    });

    // Create teams without a transaction
    const createdTeams = await Promise.all(
      teamsData.map(async (teamData) => {
        const createTeam = await Team.create(teamData);
        return createTeam;
      })
    );

    return res.status(201).json({
      msg: `Successfully imported teams`,
      teams: createdTeams,
    });
  } catch (error) {
    console.error("Error in import teams:", error);
    return res.status(500).json({ message: "Server Error" });
  }
};

exports.activateOrDeactivateTeam = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { is_active } = req.body;

    // Validate is_active value
    if (is_active === undefined || typeof is_active !== 'boolean') {
      return res.status(400).json({ msg: 'Invalid is_active value' });
    }

    // Update team document
    const updatedTeam = await Team.findByIdAndUpdate(
      teamId,
      { $set: { is_active } },
      { new: true }
    );

    if (!updatedTeam) {
      return res.status(404).json({ msg: 'team not found' });
    }

    let status = is_active == true ? 'activated' : 'deactivated'
    return res.status(200).json({ msg: `Team ${status} successfully`, team: updatedTeam });
  } catch (error) {
    console.error('Error in activate/deactivate Team:', error);
    return res.status(500).json({ msg: 'Server Error' });
  }
};
