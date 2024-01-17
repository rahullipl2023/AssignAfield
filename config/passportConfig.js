// config/passportConfig.js
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const bcrypt = require('bcrypt');
// const User = require('../models/user');
const dotenv = require('dotenv');

dotenv.config();

// Passport Local Strategy
// passport.use(new LocalStrategy(
//   {
//     usernameField: 'username',
//     passwordField: 'password',
//   },
//   async (username, password, done) => {
//     try {
//       const user = await User.findOne({ where: { username } });

//       if (!user) {
//         return done(null, false, { message: 'Incorrect username.' });
//       }

//       const passwordMatch = await bcrypt.compare(password, user.password);

//       if (passwordMatch) {
//         return done(null, user);
//       } else {
//         return done(null, false, { message: 'Incorrect password.' });
//       }
//     } catch (error) {
//       return done(error);
//     }
//   }
// ));

// Passport JWT Strategy
// const jwtOptions = {
//   jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
//   secretOrKey: process.env.JWT_SECRET,
// };

// passport.use(new JwtStrategy(jwtOptions, async (jwtPayload, done) => {
//   try {
//     const user = await User.findByPk(jwtPayload.id);

//     if (user) {
//       return done(null, user);
//     } else {
//       return done(null, false);
//     }
//   } catch (error) {
//     return done(error);
//   }
// }));
