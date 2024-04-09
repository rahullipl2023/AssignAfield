let express = require('express');
let router = express.Router();
const reservationController = require('../controllers/reservationController');
const { verifyToken } = require('../middlewares/authMiddleware')
const { uploadExcelFile } = require('../uploads/upload');

router.post('/create-reservation', verifyToken, reservationController.createReservation)
router.put('/update-reservation/:reservationId', verifyToken, reservationController.updateReservation)
router.get('/view-reservation/:reservationId', verifyToken, reservationController.viewReservationById)
router.get('/view-reservation-by-club/:clubId', verifyToken, reservationController.getReservationsByClubId)
router.post('/import-reservation/:clubId', verifyToken, uploadExcelFile, reservationController.importReservation)
router.get('/export-reservation-by-date-range/:clubId', verifyToken, reservationController.exportReservations)

module.exports = router;