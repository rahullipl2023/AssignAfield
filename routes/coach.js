let express = require('express');
let router = express.Router();
const coachController = require('../controllers/coachController');
const { verifyToken } = require('../middlewares/authMiddleware')
const { uploadCoachProfile, uploadExcelFile } = require('../uploads/upload');

router.post('/create-coach', verifyToken, uploadCoachProfile, coachController.createCoach)
router.put('/update-coach/:coachId', verifyToken, uploadCoachProfile, coachController.updateCoach)
router.put('/delete-coach/:coachId', verifyToken, coachController.softDeleteCoach)
router.get('/view-coach/:coachId', verifyToken, coachController.viewCoachById)
router.get('/view-coach-by-club/:club_id', verifyToken, coachController.getCoachesByClubId)
router.get('/view-coach-list/:club_id', verifyToken, coachController.getCoachesList)
router.post('/import-coach/:club_id', verifyToken, coachController.importCoaches)
router.put('/activate-or-deactivate-coach/:coachId', verifyToken, coachController.activateOrDeactivateCoach)

module.exports = router;
