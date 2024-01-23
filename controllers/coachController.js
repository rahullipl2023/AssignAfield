const { Coach } = require("../models/schema");
const ExcelJS = require("exceljs");
const fs = require("fs").promises;
const path = require("path");

exports.createCoach = async (req, res) => {
  try {
    let {
      club_id,
      first_name,
      last_name,
      email,
      coaching_licence,
      contact,
      address,
      preferred_time,
      multiple_teams_availability,
    } = req.body;

    let coachProfileFile = req.files["coach_profile"]
      ? req.files["coach_profile"][0]
      : null;

    multiple_teams_availability = multiple_teams_availability == 'true' ? true : false

    const createCoach = await Coach.create({
      club_id,
      first_name,
      last_name,
      email,
      coaching_licence,
      contact,
      address,
      coach_profile: coachProfileFile ? coachProfileFile.filename : "",
      preferred_time,
      multiple_teams_availability,
    });

    if (!createCoach) {
      return res.status(400).json({ success : false, msg: "Error creating the coach" });
    } else {
      return res.status(201).json({
        success : true,
        message: `Successfully created ${first_name}`,
        coach: createCoach,
      });
    }
  } catch (error) {
    console.log("Error in create coach:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.updateCoach = async (req, res) => {
  try {
    const coachId = req.params.coachId;

    const {
      first_name,
      last_name,
      email,
      contact,
      address,
      coach_profile,
      preferred_time,
      multiple_teams_availability,
    } = req.body;

    const updatedCoach = await Coach.findByIdAndUpdate(
      coachId,
      {
        $set: {
          first_name,
          last_name,
          email,
          contact,
          address,
          coach_profile,
          preferred_time,
          multiple_teams_availability,
          updated_at: new Date(),
        },
      },
      { new: true }
    );

    if (!updatedCoach) {
      return res.status(404).json({ success : false, msg: "Coach not found" });
    }

    return res.status(200).json({
      success : true,
      msg: `Successfully updated ${first_name}`,
      coach: updatedCoach,
    });
  } catch (error) {
    console.error("Error updating coach:", error);
    return res.status(500).json({ success: false,  message: "Server Error" });
  }
};

exports.softDeleteCoach = async (req, res) => {
  try {
    const coachId = req.params.coachId;

    const softDeletedCoach = await Coach.findByIdAndUpdate(
      coachId,
      {
        $set: {
          is_active: false,
          deleted_at: new Date(),
        },
      },
      { new: true }
    );

    if (!softDeletedCoach) {
      return res.status(404).json({ success : false, msg: "Coach not found" });
    }

    return res.status(200).json({
      success : true,
      msg: `Successfully soft deleted ${softDeletedCoach.first_name}`,
      coach: softDeletedCoach,
    });
  } catch (error) {
    console.error("Error soft deleting coach:", error);
    return res.status(500).json({ success : true, message: "Server Error" });
  }
};

exports.getCoachesByClubId = async (req, res) => {
  try {
    const clubId = req.params.club_id;

    const coaches = await Coach.find({
      club_id: clubId,
      is_active: true,
      deleted_at: null,
    });

    if (!coaches || coaches.length === 0) {
      return res
        .status(404)
        .json({ success : false, msg: "No active coaches found for the club" });
    }

    return res.status(200).json({
      success : true,
      message: "Coaches list for the club",
      coaches: coaches,
    });
  } catch (error) {
    console.error("Error fetching coaches by club ID:", error);
    return res.status(500).json({ success : false, error: "Internal Server Error" });
  }
};

exports.viewCoachById = async (req, res) => {
  try {
    const coachId = req.params.coachId;

    const coach = await Coach.findById(coachId);

    if (!coach) {
      return res.status(404).json({ success : false, msg: "Coach not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Coach details",
      coach,
    });
  } catch (error) {
    console.error("Error fetching coach by coach ID:", error);
    return res.status(500).json({ success : false,  error: "Internal Server Error" });
  }
};

exports.importCoaches = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success : false, msg: "No file uploaded" });
    }

    let { club_id } = req.params;

    const file = req.file;

    // Check if the buffer is a valid Buffer instance
    if (!Buffer.isBuffer(file.buffer)) {
      return res.status(400).json({ success: false, msg: "Invalid file buffer" });
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

    const coachesData = [];

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber !== 1) {
        // Skip header row
        const [
          ,
          first_name,
          last_name,
          email,
          coaching_licence,
          contact,
          address,
          preferred_time,
          multiple_teams_availability,
        ] = row.values;

        const validMultipleTeamsAvailability =
          multiple_teams_availability == true ||
          multiple_teams_availability.toLowerCase() === "true";

        coachesData.push({
          club_id,
          first_name,
          last_name,
          email,
          coaching_licence,
          contact,
          address,
          preferred_time,
          multiple_teams_availability: validMultipleTeamsAvailability,
        });
      }
    });

    // Create coaches without a transaction
    const createdCoaches = await Promise.all(
      coachesData.map(async (coachData) => {
        const createCoach = await Coach.create(coachData);
        return createCoach;
      })
    );

    return res.status(201).json({
      success : true,
      message: `Successfully imported coaches`,
      coaches: createdCoaches,
    });
  } catch (error) {
    console.error("Error in import coaches:", error);
    return res.status(500).json({ success : false,  message: "Server Error" });
  }
};

exports.activateOrDeactivateCoach = async (req, res) => {
  try {
    const { coachId } = req.params;
    const { is_active } = req.body;

    // Validate is_active value
    if (is_active === undefined || typeof is_active !== 'boolean') {
      return res.status(400).json({ success : false, msg: 'Invalid is_active value' });
    }

    // Update Coach document
    const updatedCoach = await Coach.findByIdAndUpdate(
      coachId,
      { $set: { is_active } },
      { new: true }
    );

    if (!updatedCoach) {
      return res.status(404).json({ success : false, message: 'Coach not found' });
    }
    let status = is_active == true ? 'activated' : 'deactivated'
    return res.status(200).json({ success : true, message: `Coach ${status} successfully`, coach: updatedCoach });
  } catch (error) {
    console.error('Error in activateCoach:', error);
    return res.status(500).json({ success : false , message: 'Server Error' });
  }
};