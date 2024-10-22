// Import necessary modules and models
const { Field, Reservation, Slots, Schedule, IsSchedulesCreating } = require("../models/schema");
const eventEmitter = require('./events');
const ObjectId = require('mongoose').Types.ObjectId;
const { formatDate } = require('../helper/insertQuery')
const { generateSchedules } = require('./PracticeScheduler')
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

    await deleteSlotsAndSchedules(club_id, [reservation_date]);

    // Emit an event after sending the response
    if (Array.isArray(createReservation)) {
      // Call the function with await
      await processReservation(club_id, createReservation);
    } else {
      // Call the function with await
      await processReservation(club_id, [createReservation]);
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
        sortOption.reservation_date_iso = 1;
        break;
      case '6':
        sortOption.reservation_date_iso = -1;
        break;
      default:
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
        $addFields: {
          reservation_date_iso: {
            $dateFromString: {
              dateString: '$reservation_date',
              format: '%m/%d/%Y',
            },
          },
        },
      },
      {
        $project: {
          field_name: { $ifNull: ['$field_id.field_name', ''] },
          club_id: { $ifNull: ['$club_id', ''] },
          field_id: { $ifNull: ['$field_id', ''] },
          reservation_date: { $ifNull: ['$reservation_date', ''] },
          reservation_date_iso: 1,
          reservation_day: { $ifNull: ['$reservation_day', ''] },
          reservation_start_time: { $ifNull: ['$reservation_start_time', ''] },
          reservation_end_time: { $ifNull: ['$reservation_end_time', ''] },
          contact_number: { $ifNull: ['$contact_number', ''] },
          permit: { $ifNull: ['$permit', ''] },
          is_active: { $ifNull: ['$is_active', 1] },
          created_at: { $ifNull: ['$created_at', ''] },
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

exports.exportReservations = async (req, res) => {
  try {
    // Extract start date and end date from query parameters
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const { clubId } = req.params
    // Validate startDate and endDate format
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, error: "Start date and end date are required." });
    }

    // Construct query to find reservations within the date range
    const query = {
      club_id: clubId,
      reservation_date: {
        $gte: startDate,
        $lte: endDate
      }
    };
    // Retrieve reservations within the date range
    const reservations = await Reservation.find(query)
      .populate("field_id")
    if (reservations.length > 0) {
      return res.status(200).json({
        success: true,
        message: "Reservations within the date range retrieved successfully",
        reservations: reservations
      });
    } else {
      return res.status(200).json({
        success: false,
        message: "No reservations found within the date range",
        reservations: reservations
      });
    }
  } catch (error) {
    console.error("Error exporting reservations:", error);
    return res.status(500).json({ success: false, error: "Server Error" });
  }
};

exports.importReservation = async (req, res) => {
  console.log("--------------------")
  try {
    const club_id = req.params.clubId; // Obtaining club_id from query params
    const { reservation_data } = req.body;

    const createReservation = [];
    const reservationExistsArr = []
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

        let reservationDate = await formatDate(data.reservation_date)

        if (reservationDate == 'Invalid date format'){
          const error = `Invalid date format. Please provide a valid date in MM/DD/YYYY format.`;
          data.error = error;
          reservationsWithError.push(data);
          continue; // Skip processing this data if missing or empty keys found
        }
        const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

        if (!timePattern.test(data.reservation_start_time) || !timePattern.test(data.reservation_end_time)) {
          const error = `Invalid time format. Please provide a valid time in HH:mm format.`;
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

        const reservationExits = await Reservation.findOne({
          club_id: data.club_id,
          field_id: field._id,
          reservation_date: reservationDate
        });

        if (!reservationExits) {
          // Use the IDs of the created or existing field to create the reservation
          const reservation = await Reservation.create({
            club_id: data.club_id,
            field_id: field._id,
            reservation_date: reservationDate,
            reservation_start_time: data.reservation_start_time,
            reservation_end_time: data.reservation_end_time,
            contact_number: data.contact_number,
            permit: data.permit,
          });
          createReservation.push(reservation);
        } else {
          reservationExistsArr.push(reservationExits);
        }
      } catch (error) {
        console.error("Error creating reservation:", error);
        // Push null if an error occurs during reservation creation
        createReservation.push(null);
      }
    }

    const newReservation = [...createReservation, ...reservationExistsArr];
    const reservationDates = newReservation.map(reservation => reservation.reservation_date);
    const deletionResult = await deleteSlotsAndSchedules(club_id, reservationDates);
    if (deletionResult) {
      res.status(200).json({
        success: true,
        message: "Reservations imported successfully",
        reservations: createReservation.filter(reservation => reservation !== null),
        reservationsWithError
      });

      console.log('generateSchedules triggered after reservation import');

      let findScheduleCreating = await IsSchedulesCreating.findOne({ club_id: club_id });

      if (!findScheduleCreating) {
        await IsSchedulesCreating.create({ club_id: club_id, is_schedules_creating: true });
      } else {
        await IsSchedulesCreating.findOneAndUpdate(
          { club_id: club_id },
          { $set: { is_schedules_creating: true } }
        );
      }
      await generateSchedules(club_id, newReservation);
      await IsSchedulesCreating.findOneAndUpdate(
        { club_id: club_id },
        { $set: { is_schedules_creating: false } }
      );
    } else {
      return res.status(500).json({
        success: false,
        message: "Error overriding slots and schedules"
      });
    }
  } catch (error) {
    console.error("Error importing Reservations:", error);
    return res.status(500).json({ success: false, error: `Server Error :- ${error}` });
  }
};

// Function to delete slots and schedules based on the newReservation array
async function deleteSlotsAndSchedules(club_id, reservationDates) {
  try {
    const clubObjectId = new ObjectId(club_id);

    // Delete slots
    const slotDeleteResult = await Slots.deleteMany({
      club_id: clubObjectId,
      reservation_date: { $in: reservationDates }
    });
    console.log('Slots deleted:', slotDeleteResult.deletedCount);

    // Delete schedules
    const scheduleDeleteResult = await Schedule.deleteMany({
      club_id: clubObjectId,
      schedule_date: { $in: reservationDates }
    });
    console.log('Schedules deleted:', scheduleDeleteResult.deletedCount);

    return true; // Ensure the function resolves with true
  } catch (error) {
    console.error('Error deleting slots and schedules:', error);
    return false; // Ensure the function resolves with false in case of error
  }
}

async function processReservation(club_id, newReservation) {
  // Emit an event after sending the response
  console.log("creating schedules after deletion");
  eventEmitter.emit('reservationImported', club_id, newReservation);
}


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

