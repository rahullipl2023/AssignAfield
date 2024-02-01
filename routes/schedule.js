let express = require('express');
let router = express.Router();
const scheduleController = require('../controllers/scheduleController');
const { verifyToken } = require('../middlewares/authMiddleware')
const { uploadExcelFile } = require('../uploads/upload');

router.post('/create-schedule', verifyToken, scheduleController.createSchedule)
router.put('/update-schedule/:scheduleId', verifyToken, scheduleController.updateSchedule)
router.put('/delete-schedule/:scheduleId', verifyToken, scheduleController.softDeleteScheduleById)
router.get('/view-schedule/:scheduleId', verifyToken, scheduleController.viewScheduleById)
router.get('/view-schedule-by-club/:club_id', verifyToken, scheduleController.getSchedulesByClubId)
router.get('/view-schedule-by-team-coach/:club_id', verifyToken, scheduleController.getSchedulesByTeamOrCoach)
router.post('/import-schedule/:club_id', verifyToken, uploadExcelFile, scheduleController.importSchedule)


module.exports = router;