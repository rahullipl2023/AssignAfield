let express = require('express');
let router = express.Router();
const scheduleController = require('../controllers/scheduleController');
const { verifyToken } = require('../middlewares/authMiddleware')
const { uploadExcelFile } = require('../uploads/upload');

router.post('/create-schedule', verifyToken, scheduleController.createSchedule)
router.put('/update-schedule/:id', verifyToken, scheduleController.updateSchedule)
router.get('/view-schedule/:scheduleId', verifyToken, scheduleController.viewScheduleById)
router.get('/view-schedule-by-club/:clubId', verifyToken, scheduleController.getSchedulesByClubId)
router.get('/view-schedule-by-team-coach/:clubId', verifyToken, scheduleController.getSchedulesByTeamOrCoach)
router.get('/export-schedule-by-date-range/:clubId', verifyToken, scheduleController.exportSchedules)


module.exports = router;