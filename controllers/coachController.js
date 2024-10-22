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
      coaching_start_time,
      coaching_end_time,
      preferred_days,
      max_team_you_coach,
    } = req.body;
    preferred_days = preferred_days.split(",")
    let coachProfileFile = req.files["coach_profile"]? req.files["coach_profile"][0]: null;

    const createCoach = await Coach.create({
      club_id,
      first_name,
      last_name,
      email,
      coaching_licence,
      contact,
      coach_profile: coachProfileFile ? coachProfileFile.filename : "",
      coaching_start_time,
      coaching_end_time,
      preferred_days,
      max_team_you_coach,
    });

    if (!createCoach) {
      return res.status(400).json({ success : false, msg: "Error creating the coach" });
    } else {
      return res.status(201).json({
        success : true,
        message: `Successfully created coach ${first_name}`,
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
    let coachProfileFile = req.files["coach_profile"] ? req.files["coach_profile"][0] : null;
    let {
      first_name,
      last_name,
      email,
      contact,
      coaching_licence,
      profile_picture,
      coaching_start_time,
      coaching_end_time,
      preferred_days,
      max_team_you_coach,
    } = req.body;
    preferred_days = preferred_days.split(',')
    // Fetch the coach data
    const coachData = await Coach.findById(coachId);
    // Check if is_excel is true in the current coach data
    const isExcelTrue = coachData.is_excel;

    const updatedCoach = await Coach.findByIdAndUpdate(
      coachId,
      {
        $set: {
          first_name,
          last_name,
          email,
          contact,
          coach_profile : coachProfileFile && coachProfileFile?.filename ? coachProfileFile?.filename : profile_picture,
          coaching_start_time,
          coaching_end_time,
          preferred_days,
          max_team_you_coach,
          coaching_licence,
          updated_at: new Date(),
          is_excel : isExcelTrue ? false : false
        },
      },
      { new: true }
    );

    if (!updatedCoach) {
      return res.status(404).json({ success : false, msg: "Coach not found" });
    }

    return res.status(200).json({
      success : true,
      msg: `Successfully updated coach ${first_name}`,
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
      msg: `Successfully deleted coach ${softDeletedCoach.first_name}`,
      coach: softDeletedCoach,
    });
  } catch (error) {
    console.error("Error deleting coach:", error);
    return res.status(500).json({ success : true, message: "Server Error" });
  }
};

exports.getCoachesByClubId = async (req, res) => {
  try {
    const clubId = req.params.club_id;
    let { search, sort, page } = req.query;
    search = search.trim()
    // Pagination settings
    const pageSize = 10; // Number of items per page
    const currentPage = parseInt(page) || 1; // Current page, default is 1

    let query = {
      club_id: clubId,
      deleted_at: null,
    };

    // Add search filter if provided
    if (search) {
      let searchQuery;
      const fullNameRegex = new RegExp(search, 'i');

      // Check if the search input matches the full name directly
      const fullNameMatch = await Coach.findOne(
        { 
          $expr: { 
            $regexMatch: { 
              input: { 
                $concat: ["$first_name", " ", "$last_name"] 
              }, 
              regex: fullNameRegex 
            } 
          } 
        });
      
      if (fullNameMatch) {
        searchQuery = {
          ...query,
          $or: [
            { full_name: fullNameRegex },
            { $expr: { $regexMatch: { input: { $concat: ["$first_name", " ", "$last_name"] }, regex: fullNameRegex } } }
          ]
        };
      } else {
        // If no direct full name match, search by individual fields
        searchQuery = {
          ...query,
          $or: [
            { first_name: { $regex: new RegExp(search, 'i') } },
            { last_name: { $regex: new RegExp(search, 'i') } },
            { email: { $regex: new RegExp(search, 'i') } },
            // Add other fields for search as needed
          ],
        };
      }

      query = searchQuery;
    }

    let sortOption = {};
    // Add sorting based on the provided value
    switch (parseInt(sort)) {
      case 1:
        sortOption = { first_name: 1 }; // AtoZ
        break;
      case 2:
        sortOption = { first_name: -1 }; // ZtoA
        break;
      case 3:
        sortOption = { is_active: -1 }; // Status (active first)
        break;
      case 4:
        sortOption = { created_at: -1 }; // Date (latest first)
        break;
      default:
        // Default sorting, you can change this to your needs
        sortOption = { first_name: 1 };
        break;
    }

    const totalCoaches = await Coach.countDocuments(query);
    const totalPages = Math.ceil(totalCoaches / pageSize);

    const coaches = await Coach.find(query)
      .sort(sortOption)
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize);

    if (!coaches || coaches.length === 0) {
      return res.status(404).json({ success: false, msg: "No active coaches found for the club" });
    }

    return res.status(200).json({
      success: true,
      message: "Coaches list for the club",
      coaches: coaches,
      pagination: {
        totalItems: totalCoaches,
        totalPages: totalPages,
        currentPage: currentPage,
      },
    });
  } catch (error) {
    console.error("Error fetching coaches by club ID:", error);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

exports.getCoachesList = async (req, res) => {
  try {
    const clubId = req.params.club_id;

    const coaches = await Coach.find({ club_id: clubId, deleted_at: null, is_active : true }).sort({ first_name: 1, last_name: 1 });

    return res.status(200).json({
      success: true,
      message: "Coaches list for the club",
      coaches: coaches,
    });
    
  } catch (error) {
    console.error("Error fetching coaches by club ID:", error);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
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
    // Extracting club_id from request parameters and coach_data from request body
    const { club_id } = req.params;
    const { coach_data } = req.body;

    // Arrays to store created coaches and coaches with exceeded coach limits
    let coachCreated = [];
    let coachWithExceededCoachLimit = [];

    // Create coaches without a transaction
    await Promise.all(
      coach_data.map(async (coachData) => {
        // Check for required keys and validate coach data
        const missingKeys = await validateCoachData(coachData);

        // If any required key is missing or empty, add coach data to coachWithExceededCoachLimit
        if (missingKeys.length > 0) {
          coachData.error = `Missing or empty values for required keys: ${missingKeys.join(', ')}`;
          coachWithExceededCoachLimit.push(coachData);
          return;
        }

        // Assign club_id to coach data
        coachData.club_id = club_id;
        coachData.is_excel = true;

        // Check if coach with the same email and club ID already exists
        const existingCoach = await Coach.findOne({ email: coachData.email, first_name: coachData.first_name.trim(), last_name: coachData.last_name.trim(), club_id, is_active: true, deleted_at: null });

        if (!existingCoach) {
          // Create coach if it doesn't exist
          const createdCoach = await Coach.create(coachData);
          coachCreated.push(createdCoach);
        } else {
          // Add coach data to coachWithExceededCoachLimit if coach already exists
          coachData.error = "Coach already exists.";
          coachWithExceededCoachLimit.push(coachData);
        }
      })
    );

    // Return success response with created coaches and coaches with exceeded coach limits
    return res.status(201).json({
      success: true,
      message: `Successfully imported coaches`,
      coachCreated,
      coachWithExceededCoachLimit
    });
  } catch (error) {
    // Return server error response if an error occurs
    console.error("Error in import coaches:", error);
    return res.status(500).json({ success: false, message: `Server Error: ${error.message}` });
  }
};

// Function to validate coach data
const validateCoachData = async (coachData) => {
  const requiredKeys = ['first_name', 'last_name', 'email', 'coaching_start_time', 'coaching_end_time', 'max_team_you_coach'];
  return requiredKeys.filter(key => {
    const value = coachData[key];
    if (key === 'max_team_you_coach') {
      return typeof value !== 'number';
    } else if (Array.isArray(value)) {
      return value.length === 0;
    } else {
      return typeof value !== 'string' || value.trim() === '';
    }
  });
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