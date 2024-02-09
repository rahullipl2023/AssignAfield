const mongoose = require('mongoose');

// Mongoose Schema Definitions

// Schema for clubs_details
const clubSchema = new mongoose.Schema({
  club_name: { type: String },
  sub_user: String,
  number_of_teams: Number,
  number_of_members : Number,
  address: String,
  contact: String,
  club_profile: String,
  time_off_start : Date,
  time_off_end : Date,
  club_email: { type: String },
  is_active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  deleted_at: Date,
});

// Schema for coaches
const coachSchema = new mongoose.Schema({
  club_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Club' },
  first_name: { type: String },
  last_name: { type: String },
  email: { type: String },
  coaching_licence: String,
  contact: String,
  address: String,
  coach_profile: String,
  preferred_time: String,
  preferred_days: Array,
  multiple_teams_availability: { type: Boolean, default: true },
  is_active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  deleted_at: Date,
});

// Schema for fields
const fieldSchema = new mongoose.Schema({
  club_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Club' },
  field_name: { type: String },
  address: String,
  city : String,
  state : String,
  zipcode : String,
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

const scheduleSchema = new mongoose.Schema({
  team_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  club_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Club' },
  coach_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Coach' },
  field_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Field' }, // Adjust to reference the "Field" model
  field_portion: String,
  schedule_day: String,
  schedule_date: String,
  practice_start_time: { type: String },
  practice_end_time: { type: String },
  practice_length: Number,
  contact_number: String,
  permit: String,
  is_active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  deleted_at: Date,
});


// Schema for teams
const teamSchema = new mongoose.Schema({
  team_name: { type: String },
  club_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Club' },
  coach_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Coach' },
  age_group: String,
  practice_length: Number,
  no_of_players: Number,
  preferred_timing: String,
  preferred_field_size: String,
  preferred_days: Array,
  practice_season: String,
  rsvp_duration: String,
  is_travelling : { type: Boolean, default: false },
  travelling_date : Array,
  travelling_start: Date,
  travelling_end: Date,
  region : String, 
  team_level : String, 
  gender : String,
  is_active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  deleted_at: Date,
});

// Schema for users
const userSchema = new mongoose.Schema({
  first_name: { type: String },
  last_name: { type: String },
  email: { type: String },
  phone: String,
  profile_picture: String,
  role : Number,
  address : String,
  password: { type: String },
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
