const EventEmitter = require('events');
const eventEmitter = new EventEmitter();
const { generateSchedules } = require('./scheduleController')

eventEmitter.on('reservationImported', async (club_id) => {
  try {
    console.log('generateSchedules triggered after reservation import')
    await generateSchedules(club_id);
    console.log('generateSchedules Completed');
  } catch (error) {
    console.error("Error calling generateSchedules:", error);
  }
});

module.exports = eventEmitter;
