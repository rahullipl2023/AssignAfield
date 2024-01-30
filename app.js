
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const session = require('express-session');
const passport = require('passport');
// const sequelize = require('./config/database.js');
const authMiddleware = require('./middlewares/authMiddleware');
const dotenv = require('dotenv');
const { MONGO_URI, PORT } = require('./config/database.js');
const mongoose = require('mongoose');
const { updateSchedule } = require('./controllers/scheduleController.js')
const cors = require('cors'); 
const multer = require('multer');
dotenv.config();

// const app = express();
// MongoDB Connection
let connect = mongoose.connect(MONGO_URI);
connect.then((db) => console.log("Connected to DB")).catch((err)=>{
  console.error(err);
})


const indexRouter = require('./routes/index');


// Load passport configuration
require('./config/passportConfig');

const app = express();
app.use(cors()); 
// Sequelize Sync (Create tables if they don't exist)
// sequelize.sync();

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: true,
  saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);

// app.use('/secure', authMiddleware.checkToken, require('./routes/secureRoute'));
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res, next) => {
  res.status(404).send('Not Found');
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // A Multer error occurred when uploading.
    return res.status(400).json({ success: false, message: 'Multer error', error: err.message });
  } else if (err) {
    // An unknown error occurred.
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
  next();
});

async function someFunction() {
  try {
    const scheduleUpdateResult = await updateSchedule();
    console.log(scheduleUpdateResult); // Log the result returned by updateSchedule
  } catch (error) {
    console.error("Error updating schedule:", error);
  }
}

// someFunction();



module.exports = app;
