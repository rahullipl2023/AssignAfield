let express = require('express');
let router = express.Router();
const coachController = require('../controllers/coachController');
const { verifyToken } = require('../middlewares/authMiddleware')
const { uploadCoachProfile, uploadExcelFile } = require('../uploads/upload');

router.post('/create-coach', verifyToken, uploadCoachProfile, coachController.createCoach)
router.put('/update-coach', verifyToken, uploadCoachProfile, coachController.updateCoach)
router.put('/delete-coach/:id', verifyToken, coachController.softDeleteCoach)
router.get('/view-coach/:coachId', verifyToken, coachController.viewCoachById)
router.get('/view-coach-by-club/:club_id', verifyToken, coachController.getCoachesByClubId)
router.post('/import-coach/:club_id', verifyToken, uploadExcelFile, coachController.importCoaches)
router.put('/activate-or-deactivate-coach/:coachId', verifyToken, coachController.activateOrDeactivateCoach)

module.exports = router;
