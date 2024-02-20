let express = require('express');
let router = express.Router();
const fieldController = require('../controllers/fieldController');
const { verifyToken } = require('../middlewares/authMiddleware')
const { uploadExcelFile } = require('../uploads/upload');


router.post('/create-field', verifyToken, fieldController.createField);
router.put('/update-field/:fieldId', verifyToken, fieldController.updateField);
router.put('/delete-field/:fieldId', verifyToken, fieldController.softDeleteField);
router.get('/view-field/:fieldId', verifyToken, fieldController.viewFieldById);
router.get('/view-field-by-club/:clubId', verifyToken, fieldController.getFieldsByClubId);
router.get('/view-field-list/:clubId', verifyToken, fieldController.getFieldsList);
router.post('/import-field/:club_id',verifyToken, fieldController.importFields)
router.put('/activate-or-deactivate-field/:fieldId', verifyToken, fieldController.activateOrDeactivateField)

module.exports = router;
