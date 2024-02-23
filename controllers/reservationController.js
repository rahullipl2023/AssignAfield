// Import necessary modules and models
const { Field, Reservation } = require("../models/schema");
const ExcelJS = require("exceljs");
const fs = require("fs").promises;
const path = require("path");

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
    const club_id = req.params.clubId;
    const { search, sort, page, pageSize } = req.query;
    let query = { club_id, is_active: true };

    if (search) {
      // Search for fields based on their names
      const [fields] = await Promise.all([
        Field.find({ field_name: { $regex: search, $options: 'i' } })
      ]);

      // Extract IDs of the matched fields
      const fieldIds = fields.map(field => field._id);

      // Construct the query for searching Reservations
      query.$or = [
        { field_id: { $in: fieldIds } }
      ];
    }

    let sortOption;

    if (sort == "1") {
      sortOption = { "field_id.field_name": 1 };
    } else if (sort == "2") {
      sortOption = { "field_id.field_name": -1 };
    } else if (sort == "3") {
      sortOption = { reservation_start_time: 1 };
    } else if (sort == "4") {
      sortOption = { reservation_start_time: -1 };
    } else if (sort == "5") {
      sortOption = { reservation_date: 1 };
    } else if (sort == "6") {
      sortOption = { reservation_date: -1 };
    }

    const currentPage = parseInt(page) || 1;
    const pageSizeValue = parseInt(pageSize) || 10;

    const skip = (currentPage - 1) * pageSizeValue;
    console.log(query, "query")
    const reservations = await Reservation.find(query)
      .populate("field_id")
      .sort(sortOption)
      .skip(skip)
      .limit(pageSizeValue);

    const totalCount = await Reservation.countDocuments(query);
    const totalPages = Math.ceil(totalCount / pageSizeValue);

    return res.status(200).json({
      success: true,
      message: "Reservations retrieved successfully",
      reservations: reservations,
      metadata: {
        totalCount: totalCount,
        currentPage: currentPage,
        totalPages: totalPages,
      },
    });
  } catch (error) {
    console.error("Error getting Reservations by club ID:", error);
    return res.status(500).json({ success: false, error: "Server Error" });
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

// Import Reservation via Excel Sheet
exports.importReservation = async (req, res) => {
  try {
    const club_id = req.params.clubId; // Obtaining club_id from query params
    const { reservation_data } = req.body;
    // Create Reservation without a transaction
    const createReservation = await Promise.all(
      reservation_data.map(async (data) => {
        try {
          data.club_id = club_id
          console.log(data, "data...")
          // Check if the field exists, if not create a new field
          let field = await Field.findOne({ field_name: data.field_name });
          if (!field) {
            field = await Field.create({
              field_name: data.field_name,
              field_open_time: data.reservation_start_time,
              field_close_time: data.reservation_end_time,
              is_active: true
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

          return reservation;
        } catch (error) {
          console.error("Error creating reservation:", error);
          return null;
        }
      })
    );

    return res.status(200).json({
      success: true,
      message: "Reservations imported successfully",
      reservations: createReservation.filter(reservation => reservation !== null),
    });
  } catch (error) {
    console.error("Error importing Reservations:", error);
    return res.status(500).json({ success: false, error: "Server Error" });
  }
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

