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
      teams_per_field,
      is_light_available,
      field_open_time,
      field_close_time,
      city,
      state,
      zipcode,
      region
    } = req.body;

    const createField = await Field.create({
      club_id,
      field_name,
      address,
      teams_per_field,
      is_light_available,
      field_open_time,
      field_close_time,
      city,
      state,
      zipcode,
      region
    });

    if (!createField) {
      return res.status(400).json({ success : false, message: "Error creating the field" });
    } else {
      return res.status(201).json({
        success : true,
        message: `Successfully created ${field_name}`,
        field: createField,
      });
    }
  } catch (error) {
    console.log("Error in create field:", error);
    return res.status(500).json({ success : false, message: "Server Error" });
  }
};

exports.updateField = async (req, res) => {
  try {
    const fieldId = req.params.fieldId;

    const {
      field_name,
      address,
      city,
      state,
      zipcode,
      region,
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
          city,
          state,
          zipcode,
          region,
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
      return res.status(404).json({ success : false, message: "Field not found" });
    }

    return res.status(200).json({
      success : true,
      message: `Successfully updated ${field_name}`,
      field: updatedField,
    });
  } catch (error) {
    console.error("Error updating field:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
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
      return res.status(404).json({ success : false, msg: "Field not found" });
    }

    return res.status(200).json({
      success : true,
      message: `Successfully soft deleted ${softDeletedField.field_name}`,
      field: softDeletedField,
    });
  } catch (error) {
    console.error("Error soft deleting field:", error);
    return res.status(500).json({ success : false, message: "Server Error" });
  }
};

exports.getFieldsByClubId = async (req, res) => {
  try {
    const clubId = req.params.clubId;
    const { search, sort, page } = req.query;

    // Pagination settings
    const pageSize = 10; // Number of items per page
    const currentPage = parseInt(page) || 1; // Current page, default is 1

    let query = {
      club_id: clubId,
      deleted_at: null,
    };

    // Add search filter if provided
    if (search) {
      query = {
        ...query,
        $or: [
          { field_name: { $regex: new RegExp(search, 'i') } },
          { address: { $regex: new RegExp(search, 'i') } },
          { city: { $regex: new RegExp(search, 'i') } },
          { region: { $regex: new RegExp(search, 'i') } },
          // Add other fields for search as needed
        ],
      };
    }

    let sortOption = {};
    // Add sorting based on the provided value
    switch (parseInt(sort)) {
      case 1:
        sortOption = { field_name: 1 }; // AtoZ
        break;
      case 2:
        sortOption = { field_name: -1 }; // ZtoA
        break;
      case 3:
        sortOption = { teams_per_field: -1 }; // Size (descending order)
        break;
      case 4:
        sortOption = { is_active: -1 }; // Status (active first)
        break;
      case 5:
        sortOption = { created_at: -1 }; // Date (latest first)
        break;
      default:
        // Default sorting, you can change this to your needs
        sortOption = { field_name: 1 };
        break;
    }

    const totalFields = await Field.countDocuments(query);
    const totalPages = Math.ceil(totalFields / pageSize);

    const fields = await Field.find(query)
      .sort(sortOption)
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize);

    if (!fields || fields.length === 0) {
      return res.status(404).json({ success: false, message: "No active fields found for the club" });
    }

    return res.status(200).json({
      success: true,
      message: "Fields list for the club",
      fields: fields,
      pagination: {
        totalItems: totalFields,
        totalPages: totalPages,
        currentPage: currentPage,
      },
    });
  } catch (error) {
    console.error("Error fetching fields by club ID:", error);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

exports.getFieldsList = async (req, res) => {
  try {
    const clubId = req.params.clubId;

    const fields = await Field.find({club_id: clubId})

    if (!fields || fields.length === 0) {
      return res.status(404).json({ success: false, message: "No active fields found " });
    }

    return res.status(200).json({
      success: true,
      message: "Fields list ",
      fields: fields,
    });
  } catch (error) {
    console.error("Error fetching fields by club ID:", error);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

exports.viewFieldById = async (req, res) => {
  try {
    const fieldId = req.params.fieldId;

    const field = await Field.findById(fieldId);

    if (!field) {
      return res.status(404).json({ 
        success : false,
        message: "Field not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Field details",
      field,
    });
  } catch (error) {
    console.error("Error fetching field by field ID:", error);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

exports.importFields = async (req, res) => {
  try {
    const { club_id } = req.params;
    const { field_data } = req.body;

    // Create fields without a transaction
    const createFields = await Promise.all(
      field_data.map(async (fieldData) => {
        fieldData.club_id = club_id
        const findField =  await Field.findOne({ field_name : fieldData.field_name, club_id : club_id})
        if(!findField){
          fieldData.is_light_available = fieldData.is_light_available == 'Yes' ? true : false
          const createField = await Field.create(fieldData);
          return createField;
        }
      })
    );
    return res.status(201).json({
      status: true,
      message: "Successfully imported fields",
      fields: createFields,
    });
  } catch (error) {
    console.error("Error in import fields:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
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
      return res.status(404).json({ success : false, message: 'field not found' });
    }

    let status = is_active == true ? 'activated' : 'deactivated'
    return res.status(200).json({ success : true, message: `Field ${status} successfully`, field: updatedfield });
  } catch (error) {
    console.error('Error in activate/deactivate field:', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Helper function to format date to time string in HH:mm format
function formatDateToString(date) {
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}
