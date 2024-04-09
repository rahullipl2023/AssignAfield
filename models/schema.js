const mongoose = require('mongoose');

// Mongoose Schema Definitions

// Schema for clubs_details
const clubSchema = new mongoose.Schema({
  club_name: { type: String },
  sub_user: String,
  number_of_teams: Number,
  number_of_members: Number,
  address: String,
  state : String,
  city : String,
  zipcode : String,
  contact: String,
  club_profile: String,
  time_off_start: Date,
  time_off_end: Date,
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
  coach_profile: String,
  coaching_start_time: String,
  coaching_end_time: String,
  preferred_days: Array,
  max_team_you_coach: { type: Number, default: 1 },
  is_active: { type: Boolean, default: true },
  is_excel: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  deleted_at: Date,
});

// Schema for fields
const fieldSchema = new mongoose.Schema({
  club_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Club' },
  field_name: { type: String },
  address: String,
  city: String,
  state: String,
  zipcode: String,
  region: String,
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

// Schema for Regions
const regionSchema = new mongoose.Schema({
  region: { type: String },
  club_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Club' },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  deleted_at: Date,
});

// Schema for reservations
const reservationSchema = new mongoose.Schema({
  club_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Club' },
  field_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Field' },
  reservation_date: String,
  reservation_day: String,
  reservation_start_time: { type: String },
  reservation_end_time: { type: String },
  contact_number: String,
  permit: String,
  is_active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  deleted_at: Date,
  updated_start_time: String,
  updated_end_time: String,
  remaining_portion: String
});

//schema for schedules
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
  portion_name: String,
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
  coach_id : { type: mongoose.Schema.Types.ObjectId, ref: 'Coach' , default: null},
  age_group: String,
  practice_length: Number,
  no_of_players: Number,
  practice_start_time: String,
  practice_end_time: String,
  preferred_field_size: String,
  preferred_days: Array,
  is_travelling: { type: Boolean, default: false },
  travelling_date: Array,
  region: String,
  team_level: String,
  gender: String,
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
  role: String,
  address: String,
  city: String,
  state: String,
  zipcode: String,
  password: { type: String },
  is_admin: { type: Boolean, default: false },
  is_active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  deleted_at: Date,
  club_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Club' },
});

// Schema for booked slots
const slotSchema = new mongoose.Schema({
  club_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Club' },
  reservation_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Reservation' },
  reservation_date: String,
  field_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Field' },
  coach_available: { type: Boolean, default: true },
  reservation_time_portion: Array, // [{start_time : "", end_time : "", remainning_portion: ""}] 
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  deleted_at: Date,
})

// Model Definitions
const Club = mongoose.model('Club', clubSchema);
const Coach = mongoose.model('Coach', coachSchema);
const Field = mongoose.model('Field', fieldSchema);
const Schedule = mongoose.model('Schedule', scheduleSchema);
const Team = mongoose.model('Team', teamSchema);
const User = mongoose.model('User', userSchema);
const Reservation = mongoose.model('Reservation', reservationSchema);
const Slots = mongoose.model('Slots', slotSchema);
const Regions = mongoose.model('Regions', regionSchema);


module.exports = { Club, Coach, Field, Schedule, Team, User, Reservation, Slots, Regions };
