let express = require('express');
let router = express.Router();
const coachController = require('../controllers/coachController');

router.post('/create-coach', coachController.createcoach)
router.put('/update-coach', coachController.updateCoach)
router.put('/delete-coach/:id', coachController.softDeleteCoach)
router.get('/view-coach/:id', coachController.viewCoachById)
router.get('/view-coach-by-club/:id', coachController.getCoachesByClubId)

module.exports = router;
