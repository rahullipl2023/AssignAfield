var express = require('express');
var router = express.Router();
const path = require('path');
const usersRouter = require('./users');
const teamsRouter = require('./teams');
const coachRouter = require('./coach');
const fieldRouter = require('./field');
const authRouter = require('./auth');
const clubRoutes = require('./clubRoutes');
const dashboardRoutes = require('./dashboard')
const scheduleRoutes = require('./schedule')
const reservationRoutes = require('./reservation')

/* GET home page. */
router.get('/', function(req, res, next) {
  res.sendFile(path.join(__dirname,'index.html'));
});

router.use('/users', usersRouter);
router.use('/team', teamsRouter);
router.use('/coach', coachRouter);
router.use('/field', fieldRouter);
router.use('/schedule', scheduleRoutes);
router.use('/reservation', reservationRoutes);
router.use('/auth', authRouter);
router.use('/api/v1', clubRoutes);
router.use('/dashboard', dashboardRoutes);

module.exports = router;
