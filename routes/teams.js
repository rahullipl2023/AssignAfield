let express = require('express');
let router = express.Router();
const teamController = require('../controllers/teamController');
const { uploadExcelFile } = require('../uploads/upload');
const { verifyToken } = require('../middlewares/authMiddleware')

router.post('/create-team', verifyToken, teamController.createTeam)
router.put('/update-team', verifyToken, teamController.updateTeam)
router.put('/delete-team/:id', verifyToken, teamController.softDeleteTeam)
router.get('/view-team/:id', verifyToken, teamController.viewTeamById)
router.get('/view-team-by-club/:club_id', verifyToken, teamController.getTeamsByClubId)
router.post('/import-team/:club_id',uploadExcelFile, verifyToken, teamController.importTeams)
router.put('/activate-or-deactivate-team/:teamId', verifyToken, teamController.activateOrDeactivateTeam)


module.exports = router;
