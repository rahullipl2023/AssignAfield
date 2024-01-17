var express = require('express');
var router = express.Router();
const path = require('path');
const usersRouter = require('./users');
const teamsRouter = require('./teams');
const coachRouter = require('./coach');
const fieldRouter = require('./field');
const authRouter = require('./auth');
const clubRoutes = require('./clubRoutes');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.sendFile(path.join(__dirname,'index.html'));
});

router.use('/users', usersRouter);
router.use('/team', teamsRouter);
router.use('/coach', coachRouter);
router.use('/field', fieldRouter);
router.use('/auth', authRouter);
router.use('/api/v1', clubRoutes);

module.exports = router;
