let express = require('express');
let router = express.Router();
const userController = require('../controllers/usersController');
const { verifyToken } = require('../middlewares/authMiddleware')
const { uploadSubUserProfile } = require('../uploads/upload');


router.post('/create-sub-user', verifyToken, uploadSubUserProfile, userController.createSubUser)
router.put('/update-sub-user', verifyToken, uploadSubUserProfile,  userController.updateSubUser)
router.put('/delete-sub-user/:id', verifyToken, userController.softDeleteSubUser)
router.get('/view-sub-user', verifyToken, userController.viewSubUserProfile)
router.put('/activate-or-deactivate-user/:userId', verifyToken, userController.activateOrDeactivateSubUser)


module.exports = router;
