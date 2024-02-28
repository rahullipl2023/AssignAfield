// routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/register', authController.register);
router.post('/login', authController.login);

// Apply token authentication middleware to secure routes
router.get('/profile', authMiddleware.checkToken, (req, res) => {
  // This route is now secure and requires a valid token
  res.json({ message: 'Profile Accessed' });
});

module.exports = router;
