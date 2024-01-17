
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
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
});

module.exports = app;
