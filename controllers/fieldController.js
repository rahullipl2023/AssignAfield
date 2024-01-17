const { Field } = require("../models/schema");
const ExcelJS = require("exceljs");
const fs = require("fs").promises;
const path = require("path");

exports.createField = async (req, res) => {
  try {
    const {
      club_id,
      field_name,
      address,
      location,
      teams_per_field,
      is_light_available,
      field_open_time,
      field_close_time,
    } = req.body;

    const createField = await Field.create({
      club_id,
      field_name,
      address,
      location,
      teams_per_field,
      is_light_available,
      field_open_time,
      field_close_time,
    });

    if (!createField) {
      return res.status(400).json({ msg: "Error creating the field" });
    } else {
      return res.status(201).json({
        msg: `Successfully created ${field_name}`,
        field: createField,
      });
    }
  } catch (error) {
    console.log("Error in create field:", error);
    return res.status(500).json({ message: "Server Error" });
  }
};

exports.updateField = async (req, res) => {
  try {
    const fieldId = req.params.fieldId;

    const {
      field_name,
      address,
      location,
      teams_per_field,
      is_light_available,
      field_open_time,
      field_close_time,
    } = req.body;

    const updatedField = await Field.findByIdAndUpdate(
      fieldId,
      {
        $set: {
          field_name,
          address,
          location,
          teams_per_field,
          is_light_available,
          field_open_time,
          field_close_time,
          updated_at: new Date(),
        },
      },
      { new: true }
    );

    if (!updatedField) {
      return res.status(404).json({ msg: "Field not found" });
    }

    return res.status(200).json({
      msg: `Successfully updated ${field_name}`,
      field: updatedField,
    });
  } catch (error) {
    console.error("Error updating field:", error);
    return res.status(500).json({ message: "Server Error" });
  }
};

exports.softDeleteField = async (req, res) => {
  try {
    const fieldId = req.params.fieldId;

    const softDeletedField = await Field.findByIdAndUpdate(
      fieldId,
      {
        $set: {
          is_active: false,
          deleted_at: new Date(),
        },
      },
      { new: true }
    );

    if (!softDeletedField) {
      return res.status(404).json({ msg: "Field not found" });
    }

    return res.status(200).json({
      msg: `Successfully soft deleted ${softDeletedField.field_name}`,
      field: softDeletedField,
    });
  } catch (error) {
    console.error("Error soft deleting field:", error);
    return res.status(500).json({ message: "Server Error" });
  }
};

exports.getFieldsByClubId = async (req, res) => {
  try {
    const clubId = req.params.clubId;

    const fields = await Field.find({
      club_id: clubId,
      is_active: true,
      deleted_at: null,
    });

    if (!fields || fields.length === 0) {
      return res.status(404).json({ msg: "No active fields found for the club" });
    }

    return res.status(200).json({
      message: "Fields list for the club",
      fields: fields,
    });
  } catch (error) {
    console.error("Error fetching fields by club ID:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.viewFieldById = async (req, res) => {
  try {
    const fieldId = req.params.fieldId;

    const field = await Field.findById(fieldId);

    if (!field) {
      return res.status(404).json({ msg: "Field not found" });
    }

    return res.status(200).json({
      status: true,
      message: "Field details",
      field,
    });
  } catch (error) {
    console.error("Error fetching field by field ID:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.importFields = async (req, res) => {
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

    const fieldsData = [];

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
          is_travelling,
          travelling_start,
          travelling_end,
        ] = row.values;


          fieldsData.push({
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
          is_travelling,
          travelling_start,
          travelling_end,
        });
      }
    });

    // Create fields without a transaction
    const createFields = await Promise.all(
      fieldsData.map(async (fieldData) => {
        const createField = await Field.create(fieldData);
        return createField;
      })
    );

    return res.status(201).json({
      msg: `Successfully imported fields`,
      fields: createFields,
    });
  } catch (error) {
    console.error("Error in import fields:", error);
    return res.status(500).json({ message: "Server Error" });
  }
};

exports.activateOrDeactivateField = async (req, res) => {
  try {
    const { fieldId } = req.params;
    const { is_active } = req.body;

    // Validate is_active value
    if (is_active === undefined || typeof is_active !== 'boolean') {
      return res.status(400).json({ msg: 'Invalid is_active value' });
    }

    // Update field document
    const updatedfield = await Field.findByIdAndUpdate(
      fieldId,
      { $set: { is_active } },
      { new: true }
    );

    if (!updatedfield) {
      return res.status(404).json({ msg: 'field not found' });
    }

    let status = is_active == true ? 'activated' : 'deactivated'
    return res.status(200).json({ msg: `Field ${status} successfully`, field: updatedfield });
  } catch (error) {
    console.error('Error in activate/deactivate field:', error);
    return res.status(500).json({ msg: 'Server Error' });
  }
};
