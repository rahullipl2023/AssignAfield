// Import necessary modules and models
const { Field, Reservation } = require("../models/schema");
const eventEmitter = require('./events');
const ObjectId = require('mongoose').Types.ObjectId;

// Create Reservation
exports.createReservation = async (req, res) => {
  try {
    const {
      club_id,
      field_id,
      reservation_date,
      reservation_day,
      reservation_start_time,
      reservation_end_time,
      contact_number,
      permit,
    } = req.body;
    const createReservation = await Reservation.create({
      field_id,
      club_id,
      reservation_date,
      reservation_day,
      reservation_start_time,
      reservation_end_time,
      contact_number,
      permit,
    });
    if (!createReservation) {
      return res
        .status(400)
        .json({ success: false, message: "Error creating the Reservation" });
    }

    return res.status(201).json({
      success: true,
      message: "Successfully created Reservation",
      Reservation: createReservation,
    });
  } catch (error) {
    console.error("Error in create Reservation:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

// Update Reservation
exports.updateReservation = async (req, res) => {
  try {
    const reservationId = req.params.reservationId;

    const {
      club_id,
      field_id,
      reservation_date,
      reservation_day,
      reservation_start_time,
      reservation_end_time,
      contact_number,
      permit,
    } = req.body;

    const updatedReservation = await Reservation.findByIdAndUpdate(
      reservationId,
      {
        $set: {
          club_id,
          field_id,
          reservation_date,
          reservation_day,
          reservation_start_time,
          reservation_end_time,
          contact_number,
          permit,
        },
      },
      { new: true }
    );

    if (!updatedReservation) {
      return res
        .status(404)
        .json({ success: false, message: "Reservation not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Successfully updated Reservation",
      Reservation: updatedReservation,
    });
  } catch (error) {
    console.error("Error updating Reservation:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

// Get Reservation By Club Id with Sort, Pagination, and Response Metadata
exports.getReservationsByClubId = async (req, res) => {
  try {
    const clubId = req.params.clubId;
    const { search, sort, page, pageSize } = req.query;

    // Construct base query
    const query = { club_id: new ObjectId(clubId) };

    // Add search criteria if provided
    if (search) {
      const fields = await Field.find({ field_name: { $regex: search, $options: 'i' } });
      const fieldIds = fields.map(field => field._id);
      query.$or = [{ field_id: { $in: fieldIds } }];
    }

    // Construct sort option
    const sortOption = {};
    switch (sort) {
      case '1':
        sortOption.field_name = 1;
        break;
      case '2':
        sortOption.field_name = -1;
        break;
      case '3':
        sortOption.reservation_start_time = 1;
        break;
      case '4':
        sortOption.reservation_start_time = -1;
        break;
      case '5':
        sortOption.reservation_date = 1;
        break;
      case '6':
        sortOption.reservation_date = -1;
        break;
      default:
        // Handle default sorting here if needed
        sortOption.created_at = -1;
        break;
    }

    // Parse pagination parameters
    const currentPage = parseInt(page, 10) || 1;
    const pageSizeValue = parseInt(pageSize, 10) || 10;
    const skip = (currentPage - 1) * pageSizeValue;

    // Aggregate reservations
    const reservations = await Reservation.aggregate([
      { $match: query },
      { $lookup: { from: 'fields', localField: 'field_id', foreignField: '_id', as: 'field_id' } },
      { $unwind: '$field_id' },
      {
        $project: {
          field_name: { $ifNull: ['$field_id.field_name', ''] },
          club_id: { $ifNull: ['$club_id', ''] },
          field_id: { $ifNull: ['$field_id', ''] },
          reservation_date: { $ifNull: ['$reservation_date', ''] },
          reservation_day: { $ifNull: ['$reservation_day', ''] },
          reservation_start_time: { $ifNull: ['$reservation_start_time', ''] },
          reservation_end_time: { $ifNull: ['$reservation_end_time', ''] },
          contact_number: { $ifNull: ['$contact_number', ''] },
          permit: { $ifNull: ['$permit', ''] },
          is_active: { $ifNull: ['$is_active', 1] },
          created_at : { $ifNull: ['$created_at', ''] },
          field_id: '$field_id'
        }
      },
      { $sort: sortOption },
      { $skip: skip },
      { $limit: pageSizeValue }
    ]);

    // Get total count and calculate total pages
    const totalCount = await Reservation.countDocuments(query);
    const totalPages = Math.ceil(totalCount / pageSizeValue);

    // Send response
    res.status(200).json({
      success: true,
      message: 'Reservations retrieved successfully',
      reservations,
      metadata: { totalCount, currentPage, totalPages }
    });
  } catch (error) {
    console.error('Error getting Reservations by club ID:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

exports.viewReservationById = async (req, res) => {
  try {
    const reservationId = req.params.reservationId;

    const reservation = await Reservation.findById(reservationId)
      .populate("field_id")

    if (!reservation) {
      return res
        .status(404)
        .json({ success: false, message: "Reservation not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Reservation details",
      reservation,
    });
  } catch (error) {
    console.error("Error fetching reservation by ID:", error);
    return res.status(500).json({ success: false, error: "Server Error" });
  }
};

exports.importReservation = async (req, res) => {
  try {
    const club_id = req.params.clubId; // Obtaining club_id from query params
    const { reservation_data } = req.body;

    const createReservation = [];
    const reservationsWithError = [];

    for (const data of reservation_data) {
      try {
        // Check for missing or blank keys
        const missingKeys = await validateReservationData(data);
        if (missingKeys.length > 0) {
          const error = `Missing or empty values for required keys: ${missingKeys.join(', ')}`;
          data.error = error;
          reservationsWithError.push(data);
          continue; // Skip processing this data if missing or empty keys found
        }

        data.club_id = club_id;
        // Check if the field exists
        let field = await Field.findOne({ field_name: data.field_name, club_id: club_id });
        if (!field) {
          // Field does not exist, create it
          field = await Field.create({
            field_name: data.field_name,
            is_active: true,
            club_id: club_id
          });
        }
        // Use the IDs of the created or existing field to create the reservation
        const reservation = await Reservation.create({
          club_id: data.club_id,
          field_id: field._id,
          reservation_date: data.reservation_date,
          reservation_start_time: data.reservation_start_time,
          reservation_end_time: data.reservation_end_time,
          contact_number: data.contact_number,
          permit: data.permit,
        });
        createReservation.push(reservation);
      } catch (error) {
        console.error("Error creating reservation:", error);
        // Push null if an error occurs during reservation creation
        createReservation.push(null);
      }
    }

    // Emit an event after sending the response
    eventEmitter.emit('reservationImported', club_id);

    return res.status(200).json({
      success: true,
      message: "Reservations imported successfully",
      reservations: createReservation.filter(reservation => reservation !== null),
      reservationsWithError
    });
  } catch (error) {
    console.error("Error importing Reservations:", error);
    return res.status(500).json({ success: false, error: "Server Error" });
  }
};

// Function to validate reservation data
const validateReservationData = async (data) => {
  const requiredKeys = ['field_name', 'reservation_start_time', 'reservation_end_time', 'reservation_date'];
  return requiredKeys.filter(key => {
    const value = data[key];
    return typeof value !== 'string' || value.trim() === '';
  });
};

const formatDateToString1 = (date) => {
  // Check if the input is a valid Date object
  if (!(date instanceof Date)) {
    return ''; // Return empty string or handle the error appropriately
  }

  // Get hours and minutes in UTC timezone
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();

  // Pad single digit hours and minutes with leading zeros
  const formattedHours = hours.toString().padStart(2, '0');
  const formattedMinutes = minutes.toString().padStart(2, '0');

  // Concatenate hours and minutes with a colon to get HH:mm format
  return `${formattedHours}:${formattedMinutes}`;
};

