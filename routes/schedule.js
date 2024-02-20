let express = require('express');
let router = express.Router();
const scheduleController = require('../controllers/scheduleController');
const { verifyToken } = require('../middlewares/authMiddleware')
const { uploadExcelFile } = require('../uploads/upload');

router.get('/view-schedule/:scheduleId', verifyToken, scheduleController.viewScheduleById)
router.get('/view-schedule-by-club/:clubId', verifyToken, scheduleController.getSchedulesByClubId)
router.get('/view-schedule-by-team-coach/:clubId', verifyToken, scheduleController.getSchedulesByTeamOrCoach)


module.exports = router;