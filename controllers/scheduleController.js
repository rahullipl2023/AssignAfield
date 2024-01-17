const mongoose = require('mongoose');
const {Schedule, Coach, Team, Field} = require('../models/schema');

// Function to update the schedule based on coach, field, and team data
async function updateSchedule() {
  try {
    // Fetch all active coaches
    const coaches = await Coach.find({ is_active: true });

    // Fetch all active teams
    const teams = await Team.find({ is_active: true });

    // Fetch all active fields
    const fields = await Field.find({ is_active: true });

    // Clear existing schedule data
    await Schedule.deleteMany({});

    // Your scheduling logic goes here
    // This is a placeholder; you need to implement your scheduling algorithm based on the given INPUT FIELDS and RESTRICTIONS

    // For example, you can iterate through coaches, teams, and fields to generate practice schedules
    for (const coach of coaches) { 
      for (const team of teams) {
        for (const field of fields) {
          // Implement your logic to generate practice schedule entries and save them to the Schedule collection
          const scheduleEntry = new Schedule({
            team_id: team._id,
            club_id: team.club_id,
            coach_id: coach._id,
            field_id: field._id,
            // Add other relevant fields as needed
            // ...
          });
          await scheduleEntry.save();
        }
      }
    }

    console.log('Schedule updated successfully');
  } catch (error) {
    console.error('Error updating schedule:', error);
  }
}

// You can call this function whenever there is a change in coach, field, or team data
// For example, you can call this function in the route handlers where you handle updates or creations
// of coaches, teams, or fields
// updateSchedule();

module.exports = { updateSchedule };
