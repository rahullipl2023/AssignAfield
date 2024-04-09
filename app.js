
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
const { generateSchedules } = require('./controllers/scheduleController.js')
const cors = require('cors'); 
const multer = require('multer');
dotenv.config();

// const app = express();
// MongoDB Connection
let connect = mongoose.connect(MONGO_URI);
connect.then((db) => console.log("Connected to DB")).catch((err)=>{
  console.error(err);
})

// Define ANSI escape codes for colors
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m", // Green color
  cyan: "\x1b[36m",   // Cyan color
  red: "\x1b[31m",    // Red color
  yellow: "\x1b[33m", // Yellow color
  blue: "\x1b[34m"    // Blue color
};

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
// Custom middleware function to log API execution time
const logExecutionTime = (req, res, next) => {
  const start = Date.now(); // Record the start time when the middleware is called

  // Define a function to log the execution time after the response is sent
  res.on('finish', () => {
    const end = Date.now(); // Record the end time when the response is sent
    const duration = end - start; // Calculate the execution duration
    // Append execution time to the Morgan logger output
    req._startTime = start; // Set the start time on the request object for use in Morgan logger
    console.log(`-------> ${colors.blue}[${new Date().toLocaleString()}]${colors.reset} ${colors.yellow}API executed in${colors.reset} ${colors.green}${duration}ms${colors.reset} <-------`);
  });

  next(); // Call the next middleware in the chain
};

// Use the Morgan logger with combined format and custom middleware before handling routes
app.use(logger('dev'));
app.use(logExecutionTime);
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
    const scheduleUpdateResult = await generateSchedules('65dd71a28512131eb74484d2');
  } catch (error) {
    console.error("Error updating schedule:", error);
  }
}

// someFunction();



module.exports = app;
