let express = require('express');
let router = express.Router();
const teamController = require('../controllers/teamController');
const { uploadExcelFile } = require('../uploads/upload');
const { verifyToken } = require('../middlewares/authMiddleware')

router.post('/create-team', verifyToken, teamController.createTeam)
router.put('/update-team/:teamId', verifyToken, teamController.updateTeam)
router.put('/delete-team/:teamId', verifyToken, teamController.softDeleteTeam)
router.get('/view-team/:teamId', verifyToken, teamController.viewTeamById)
router.get('/view-team-by-club/:club_id', verifyToken, teamController.getTeamsByClubId)
router.get('/view-team-list/:club_id', verifyToken, teamController.getTeamsList)
router.post('/import-team/:club_id',uploadExcelFile, verifyToken, teamController.importTeams)
router.put('/activate-or-deactivate-team/:teamId', verifyToken, teamController.activateOrDeactivateTeam)
router.get('/coach',teamController.teamsByCoach)

module.exports = router;
