// controllers/authController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { createUser, findUserByUsername } = require('../helper/insertQuery')
const { generateToken } = require('../middlewares/authMiddleware')



const authController = {

  register: async (req, res) => {
    try {
      const { username, password } = req.body;

      // Use the createUser function from userController
      const userId = await createUser(username, password);

      res.status(201).json({ message: 'User registered successfully', userId });
    } catch (error) {
      console.error('Registration error:', error.message);

      // Respond with appropriate status code and error message
      if (error.message === 'Username already exists') {
        res.status(400).json({ error: 'Username already exists' });
      } else {
        res.status(500).json({ error: 'Failed to register user' });
      }
    }
  },

  login: async (req, res) => {
    try {
      const { username, password } = req.body;

      // Find the user by username
      const user = await findUserByUsername(username);

      if (!user) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }
      const stringPassword = typeof password === 'number' ? String(password) : password;
      // Continue with password validation and token generation
      const passwordMatch = await bcrypt.compare(stringPassword, user.password);
      if (passwordMatch) {
        const token = await generateToken(user);
        res.json({ token: token, message: "User Login seccessfull", playload: user });
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
};

module.exports = authController;
