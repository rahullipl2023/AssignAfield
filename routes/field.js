let express = require('express');
let router = express.Router();
const fieldController = require('../controllers/fieldController');
const { verifyToken } = require('../middlewares/authMiddleware')

router.post('/create-field', verifyToken, fieldController.createField);
router.put('/update-field/:fieldId', verifyToken, fieldController.updateField);
router.put('/delete-field/:fieldId', verifyToken, fieldController.softDeleteField);
router.get('/view-field/:fieldId', verifyToken, fieldController.viewFieldById);
router.get('/view-field-by-club/:clubId', verifyToken, fieldController.getFieldsByClubId);
router.put('/activate-or-deactivate-field/:fieldId', verifyToken, fieldController.activateOrDeactivateField)

module.exports = router;
