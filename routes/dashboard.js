let express = require('express');
let router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { verifyToken } = require('../middlewares/authMiddleware')


router.get('/dashboard-details/:club_id', verifyToken, dashboardController.dashboardDetailsByClubId);

module.exports = router;