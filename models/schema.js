const mongoose = require('mongoose');

// Mongoose Schema Definitions

// Schema for clubs_details
const clubSchema = new mongoose.Schema({
  club_name: { type: String, required: true },
  sub_user: String,
  number_of_teams: Number,
  address: String,
  contact: String,
  club_profile: String,
  time_off_start : Date,
  time_off_end : Date,
  club_email: { type: String, required: true },
  is_active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  deleted_at: Date,
});

// Schema for coaches
const coachSchema = new mongoose.Schema({
  club_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', required: true },
  first_name: { type: String, required: true },
  last_name: { type: String, required: true },
  email: { type: String, required: true },
  coaching_licence: String,
  contact: String,
  address: String,
  coach_profile: String,
  preferred_time: String,
  multiple_teams_availability: { type: Boolean, default: true },
  is_active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  deleted_at: Date,
});

// Schema for fields
const fieldSchema = new mongoose.Schema({
  club_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', required: true },
  field_name: { type: String, required: true },
  address: String,
  location: String,
  teams_per_field: Number,
  is_light_available: { type: Boolean, default: false },
  field_open_time: String,
  field_close_time: String,
  is_active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  deleted_at: Date,
});

// Schema for schedules
const scheduleSchema = new mongoose.Schema({
  team_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  club_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Club' },
  coach_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Coach' },
  field_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Field' },
  field_section: String,
  practice_start_time: Date,
  practice_end_time: Date,
  practice_length: Number,
  is_active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  deleted_at: Date,
});

// Schema for teams
const teamSchema = new mongoose.Schema({
  team_name: { type: String, required: true },
  club_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Club' },
  coach_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Coach' },
  age_group: String,
  practice_length: Number,
  no_of_players: Number,
  preferred_timing: String,
  preferred_field_size: String,
  preferred_days: String,
  practice_season: String,
  rsvp_duration: String,
  is_travelling : { type: Boolean, default: false },
  travelling_start: Date,
  travelling_end: Date,
  is_active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  deleted_at: Date,
});

// Schema for users
const userSchema = new mongoose.Schema({
  first_name: { type: String, required: true },
  last_name: { type: String, required: true },
  email: { type: String, required: true },
  phone: String,
  profile_picture: String,
  password: { type: String, required: true },
  is_admin: { type: Boolean, default: false },
  is_active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  deleted_at: Date,
  club_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Club' },
});

// Model Definitions
const Club = mongoose.model('Club', clubSchema);
const Coach = mongoose.model('Coach', coachSchema);
const Field = mongoose.model('Field', fieldSchema);
const Schedule = mongoose.model('Schedule', scheduleSchema);
const Team = mongoose.model('Team', teamSchema);
const User = mongoose.model('User', userSchema);

module.exports = { Club, Coach, Field, Schedule, Team, User };
