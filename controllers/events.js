const EventEmitter = require('events');
const eventEmitter = new EventEmitter();
const { generateSchedules } = require('./PracticeScheduler')
const { IsSchedulesCreating } = require("../models/schema");

eventEmitter.once('reservationImported', async (club_id, createReservation) => {
  try {
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
    console.log("schedules generation started")
    await generateSchedules(club_id, createReservation);
    console.log('generateSchedules Completed');

    await IsSchedulesCreating.findOneAndUpdate(
      { club_id: club_id },
      { $set: { is_schedules_creating: false } }
    );

  } catch (error) {
    console.error("Error calling generateSchedules:", error);
    // Update is_schedules_creating even in case of an error
    await IsSchedulesCreating.findOneAndUpdate(
      { club_id: club_id },
      { $set: { is_schedules_creating: false } }
    );
  }
});

module.exports = eventEmitter;









