// src/controllers/userController.js
const bcrypt = require("bcrypt");
// const { QueryTypes } = require('sequelize');
const pool = require("../config/database");
const nodemailer = require('nodemailer');

const HelperFunction = {
  createUser: async (username, password) => {
    try {
      // Convert the password to a string if it's not already
      const stringPassword =
        typeof password === "number" ? String(password) : password;

      // Check if the username already exists
      const checkQuery =
        "SELECT COUNT(*) AS count FROM users WHERE username = ?";
      const checkValues = [username];

      const checkResult = await new Promise((resolve, reject) => {
        pool.query(checkQuery, checkValues, function (err, result) {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });

      if (checkResult[0].count > 0) {
        throw new Error("Username already exists");
      }

      const hashedPassword = await bcrypt.hash(stringPassword, 10);

      // Use a query with placeholders to prevent SQL injection
      const insertQuery =
        "INSERT INTO users (username, password) VALUES (?, ?)";
      const insertValues = [username, hashedPassword];

      // Execute the insert query
      const result = await new Promise((resolve, reject) => {
        pool.query(insertQuery, insertValues, function (err, result) {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });

      if (!result || !result.insertId) {
        throw new Error("Failed to create user");
      }

      console.log("User created:", result);
      return result.insertId;
    } catch (error) {
      console.error("Error creating user:", error.message);
      throw error; // Rethrow the original error for proper handling
    }
  },

  findUserByUsername: async (username) => {
    try {
      const checkQuery =
        "SELECT id, username, password FROM users WHERE username = ?";
      const checkValues = [username];

      const user = await new Promise((resolve, reject) => {
        pool.query(checkQuery, checkValues, function (err, result) {
          if (err) {
            reject(err);
          } else {
            resolve(result[0]); // Assuming you expect only one user or null
          }
        });
      });

      return user;
    } catch (error) {
      console.error("Error finding user by username:", error.message);
      throw new Error("Failed to find user");
    }
  },
};

// Helper functions to generate random start and end times within the given range
function getRandomStartTime(openTime, closeTime, preferredTimings, hasLights) {
  // Filter preferred timings between the field's open and close time
  const filteredTimings = preferredTimings.filter(
    (timing) =>
      compareTimings(openTime, timing) <= 0 &&
      compareTimings(timing, closeTime) <= 0
  );

  // If the field has lights or the team doesn't prefer evening, consider the entire time range
  const availableTimings =
    hasLights || !preferredTimings.includes("evening") ? filteredTimings : [];

  // Choose a random preferred timing
  const randomPreferredTiming =
    availableTimings[Math.floor(Math.random() * availableTimings.length)];

  return randomPreferredTiming || openTime;
}

function getRandomEndTime(openTime, closeTime, preferredTimings, hasLights) {
  // Filter preferred timings between the field's open and close time
  const filteredTimings = preferredTimings.filter(
    (timing) =>
      compareTimings(openTime, timing) <= 0 &&
      compareTimings(timing, closeTime) <= 0
  );

  // If the field has lights or the team doesn't prefer evening, consider the entire time range
  const availableTimings =
    hasLights || !preferredTimings.includes("evening") ? filteredTimings : [];

  // Choose a random preferred timing
  const randomPreferredTiming =
    availableTimings[Math.floor(Math.random() * availableTimings.length)];

  // Ensure that the end time is at least 1 hour after the start time and within the valid range
  const maxPracticeLength = 90; // Maximum practice length in minutes
  const endTime = addMinutes(
    randomPreferredTiming || openTime,
    maxPracticeLength
  );

  return compareTimings(endTime, closeTime) <= 0 ? endTime : closeTime;
}

// Helper function to compare two timings in HH:mm format
function compareTimings(timing1, timing2) {
  const [hour1, minute1] = timing1.split(":").map((part) => parseInt(part));
  const [hour2, minute2] = timing2.split(":").map((part) => parseInt(part));

  if (hour1 !== hour2) {
    return hour1 - hour2;
  } else {
    return minute1 - minute2;
  }
}

// Helper function to add minutes to a timing in HH:mm format
function addMinutes(timing, minutes) {
  const [hour, minute] = timing.split(":").map((part) => parseInt(part));
  const totalMinutes = hour * 60 + minute + minutes;

  const newHour = Math.floor(totalMinutes / 60);
  const newMinute = totalMinutes % 60;

  return `${newHour < 10 ? "0" : ""}${newHour}:${
    newMinute < 10 ? "0" : ""
  }${newMinute}`;
}

// Helper function to determine compatible field based on team's preferred timing
function getCompatibleField(team, fields, preferredFieldSize) {
  const preferredTimings = team.preferred_timing.split(" to ");
  const [teamFromTime, teamToTime] = preferredTimings;

  return fields.find((field) => {
    const portionNeeded = preferredFieldSize / field.field_size;
    const isEvening =
      compareTimings(field.field_open_time, teamFromTime) >= 0 &&
      compareTimings(field.field_close_time, teamToTime) <= 0;

    return (
      field.teams_per_field >= Math.ceil(1 / portionNeeded) &&
      (field.is_light_available || !isEvening)
    );
  });
}

async function resetPasswordMail2(email, link, userName) {
  // Configuration for nodemailer
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false, // Change to true if using port 465 with SSL
    auth: {
      user: process.env.SMTP_USERNAME,
      pass: process.env.SMTP_PASSWORD
    }
  });

  // Email content
  const mailOptions = {
    from: process.env.SMTP_USERNAME,
    to: email,
    subject: "Reset Password",
    html: resetPasswordTemplate(link, userName)
  };

  // Send email
  await transporter.sendMail(mailOptions);
}

function resetPasswordTemplate(link, userName) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Password Reset</title>
    </head>
    <body>
      <h1>Hello ${userName},</h1>
      <p>Someone requested a password reset for your account. If this was not you, please ignore this email.</p>
      <p>To reset your password, click the following link:</p>
      <a href="${link}">Reset Password</a>
    </body>
    </html>
  `;
}
module.exports = HelperFunction;
module.exports = { getRandomStartTime, getRandomEndTime, compareTimings, addMinutes, getCompatibleField, resetPasswordMail2 }