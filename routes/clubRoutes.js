const express = require('express');
const clubController = require('../controllers/clubController');
const { uploadClubProfileAndUserProfile,uploadClubProfile } = require('../uploads/upload');
const { verifyToken } = require('../middlewares/authMiddleware')
const router = express.Router();

router.post('/register-club', uploadClubProfileAndUserProfile, clubController.createClub);
router.post('/club-login', clubController.clubLogin);
router.get('/clubs', clubController.getAllClubs);
router.get('/clubs/:id',verifyToken, clubController.getClubById);
router.put('/update-clubs/:id', verifyToken,uploadClubProfile, clubController.updateClubById);
router.delete('/clubs/:id', verifyToken, clubController.deleteClubById);
router.get('/getClubWithUser/:club_id',verifyToken, clubController.getClubWithUser);
router.post('/forget-password', clubController.forgotPassword);
router.post('/reset-password', clubController.resetPassword);
router.get('/regions/:clubId', verifyToken, clubController.getRegionByClubId)
router.post('/create-region', verifyToken, clubController.createRegion)

module.exports = router;
 