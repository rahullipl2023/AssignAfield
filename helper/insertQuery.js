// src/controllers/userController.js
const bcrypt = require('bcrypt');
// const { QueryTypes } = require('sequelize');
const pool = require('../config/database');

const HelperFunction = {
    createUser: async (username, password) => {
        try {
            // Convert the password to a string if it's not already
            const stringPassword = typeof password === 'number' ? String(password) : password;

            // Check if the username already exists
            const checkQuery = 'SELECT COUNT(*) AS count FROM users WHERE username = ?';
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
                throw new Error('Username already exists');
            }

            const hashedPassword = await bcrypt.hash(stringPassword, 10);

            // Use a query with placeholders to prevent SQL injection
            const insertQuery = 'INSERT INTO users (username, password) VALUES (?, ?)';
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
                throw new Error('Failed to create user');
            }

            console.log('User created:', result);
            return result.insertId;
        } catch (error) {
            console.error('Error creating user:', error.message);
            throw error; // Rethrow the original error for proper handling
        }
    },


    findUserByUsername : async (username) => {
    try {
      const checkQuery = 'SELECT id, username, password FROM users WHERE username = ?';
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
      console.error('Error finding user by username:', error.message);
      throw new Error('Failed to find user');
    }
    }
}
module.exports = HelperFunction;
