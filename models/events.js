
const express = require('express');
const router = express.Router();
const eventsController = require('../controllers/eventsController');
const authMiddleware = require('../middlewares/authMiddleware');
const { uploadimage1andimage2 } = require('../uploads/upload');


router.post('/create-group-events', uploadimage1andimage2, eventsController.createGroupEvents);
router.put('/update-group-events/:eventId', uploadimage1andimage2, eventsController.updateEventById);
router.get('/event-details/:eventId', eventsController.getEventDetailsById);
router.get('/all-event', eventsController.allEventList);
router.get('/all-club-event/:clubId', eventsController.eventListByClubId);
router.get('/all-group-event/:groupId', eventsController.eventListByGroupId);
router.post('/add-event-file/:eventId',uploadimage1andimage2, eventsController.addEventFilesById);
router.delete('/delete-event-file/:eventId', eventsController.deleteEventFileById);
router.post('/add-event-user/:eventId', eventsController.registerUserToEvent);
router.delete('/delete-event-user/:eventId', eventsController.deleteUserFromEvent);
// router.get('/map-responce-list', mapsController.mapList);


module.exports = router;

