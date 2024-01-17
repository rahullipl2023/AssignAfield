const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');

// Multer storage configuration
const storage = (destination) => multer.diskStorage({
  destination: (req, file, cb) => {
    // Determine the destination folder based on the field name
    const folder = file.fieldname === 'club_profile' ? 'club' : 
                   file.fieldname === 'profile_picture' || 'user_profile' ? 'user/profile' :
                   file.fieldname === 'coach_profile' ? 'coach' :
                   file.fieldname === 'coach_file' ? 'files' :
                   'default';
    const dest = path.join(destination, folder);
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const fileName = `${Date.now()}${path.extname(file.originalname)}`;
    cb(null, fileName);
  },
});

const upload = (destination, fields) => multer({
  storage: storage(destination),
  fileFilter: (req, file, cb) => {
    if (fields.includes(file.fieldname)) {
      cb(null, true);
    } else {
      cb(new Error('Unexpected field'));
    }
  },
});

const uploadClubProfileAndUserProfile = upload('public/images', ['club_profile', 'profile_picture']).fields([
  { name: 'club_profile', maxCount: 1 },
  { name: 'profile_picture', maxCount: 1 },
]);

const uploadCoachProfile = upload('public/images', ['coach_profile']).fields([{ name: 'coach_profile', maxCount: 1 }]);
const uploadSubUserProfile = upload('public/images', ['user_profile']).fields([{ name: 'user_profile', maxCount: 1 }]);

// const uploadCoachFile = upload('public', ['coach_file']).fields([{ name: 'coach_file', maxCount: 1 }]);


const storage1 = multer.memoryStorage(); // Use memory storage instead of disk storage

const uploadExcelFile = (req, res, next) => {
  console.log('Middleware executed');

  multer({
    storage: storage1,
    fileFilter: (req, file, cb) => {
      if (file.fieldname == 'file') {
        cb(null, true);
      } else {
        cb(new Error('Unexpected field'));
      }
    },
  }).single('coach_file')(req, res, next);
};



module.exports = { uploadClubProfileAndUserProfile, uploadCoachProfile, uploadExcelFile, uploadSubUserProfile };

