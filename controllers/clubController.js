const { Club, User } = require("../models/schema");
const bcrypt = require("bcrypt");
const { generateToken } = require("../middlewares/authMiddleware");
const { resetPasswordMail2 } = require("../helper/insertQuery")
const jwt = require('jsonwebtoken');
exports.createClub = async (req, res) => {
  const {
    club_name,
    sub_user,
    number_of_members,
    number_of_teams,
    address,
    state,
    city,
    zipcode,
    contact,
    club_email,
    time_off_start,
    time_off_end,
    first_name,
    last_name,
    email,
    phone,
    password,
    is_admin,
  } = req.body;

  try {
    // Process uploaded files
    let clubProfileFile = req.files["club_profile"]
      ? req.files["club_profile"][0]
      : null;
    let profilePictureFile = req.files["profile_picture"]
      ? req.files["profile_picture"][0]
      : null;

    // Create a new club
    const newClub = new Club({
      club_name,
      sub_user,
      number_of_members,
      number_of_teams,
      address,
      state,
      city,
      zipcode,
      contact,
      club_profile: clubProfileFile ? clubProfileFile.filename : "", // Update club_profile with the file path
      club_email,
      time_off_start,
      time_off_end,
    });

    const savedClub = await newClub.save();

    const encryptedPassword = await bcrypt.hash(password, 10);

    const findUser = await User.find({ email: email });

    if (findUser.length > 0) {
      // User with the given email already exists
      res.status(400).json({
        success: false,
        message: "User email already exists",
      });
    } else {
      // Now that the club is created, use its _id to create the associated user
      const newUser = new User({
        first_name,
        last_name,
        email,
        phone,
        profile_picture: profilePictureFile ? profilePictureFile.filename : "", // Update profile_picture with the file path
        password: encryptedPassword,
        is_admin,
        club_id: savedClub._id,
        role : 'Admin'
      });
      const savedUser = await newUser.save();
      console.log("Club and User created successfully");

      // Optionally, you can send a response back to the client
      res.status(201).json({
        success: true,
        message: "Club and User created successfully",
        club: savedClub,
        user: savedUser,
      });
    }
  } catch (error) {
    console.error("Error creating Club and User:", error);

    // Send an error response to the client
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
    });
  }
};

exports.clubLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const findUser = await User.findOne({ email }).populate('club_id');
    if (!findUser) {
      return res.status(401).json({ success: false, message: "Invalid Email" });
    }

    const isValidPassword = bcrypt.compareSync(password, findUser.password);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: "Invalid Password!" });
    }

    const token = await generateToken(findUser);
    return res.status(200).json({
      success: true,
      message: "Logged in successfully",
      token: token,
      user: findUser,
    });
  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server Error!",
    });
  }
};


// Get all clubs
exports.getAllClubs = async (req, res) => {
  try {
    let clubs = await Club.find();
    clubs = clubs.map((club) => {
      if(club.club_profile == "null"){
        club.club_profile = null
      }
    })
    res.status(200).json({success : true, message : "Club details", clubs});
  } catch (error) {
    res.status(500).json({ success : false, error: "Internal Server Error" });
  }
};

// Get a specific club by ID
exports.getClubById = async (req, res) => {
  try {
    const club = await Club.findById(req.params.id);
    if (!club) {
      return res.status(404).json({ success : false, error: "Club not found" });
    }
    if(club.club_profile == "null"){
        club.club_profile = null
    }
    res.status(200).json({success : true, message : "Club details",club});
  } catch (error) {
    res.status(500).json({ success : false, error: "Internal Server Error" });
  }
};

// Update a specific club by ID
exports.updateClubById = async (req, res) => {
  try {
    let {
      club_name,
      number_of_teams,
      address,
      state,
      city,
      zipcode,
      number_of_members,
      time_off_start,
      time_off_end,
      profile_image,
      contact,
      club_email,
    } = req.body;

    let clubProfileFile = req.files["club_profile"]
      ? req.files["club_profile"][0]
      : null;

    const updatedClub = await Club.findByIdAndUpdate(
      req.params.id,
      {
        club_name,
        number_of_teams,
        address,
        state,
        city,
        zipcode,
        number_of_members,
        time_off_start,
        time_off_end,
        club_profile : clubProfileFile && clubProfileFile?.filename ? clubProfileFile?.filename : profile_image,
        contact,
        club_email,
      },
      {
        new: true,
      }
    );
    if (!updatedClub) {
      return res.status(404).json({ success: false, error: "Club not found" });
    }
    res
      .status(200)
      .json({ success: true, message: "Club updated ", updatedClub });
  } catch (error) {
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

// Delete a specific club by ID
exports.deleteClubById = async (req, res) => {
  try {
    const deletedClub = await Club.findByIdAndDelete(req.params.id);
    if (!deletedClub) {
      return res.status(404).json({ success : false, error: "Club not found" });
    }
    res.status(204).json({success : true, message : "Club deleted ",});
  } catch (error) {
    res.status(500).json({ success : false, error: "Internal Server Error" });
  }
};

exports.getClubWithUser = async (req, res) => {
  try {
    const clubId = req.params.club_id;

    // Find the user by club ID and populate the 'club_id' field
    const clubWithUserDetails = await User.find({ club_id: clubId, deleted_at: { $in: [null, undefined] } });

    if (!clubWithUserDetails || clubWithUserDetails.length === 0) {
      return res.status(404).json({ success : true, error: "No active users found for the club" });
    }

    // Return the user information with club details
    res.status(200).json({
      success: true,
      message: "Club with user data",
      clubWithUserDetails,
    });
  } catch (error) {
    console.error("Error fetching user with club:", error);
    res.status(500).json({ success : true, error: "Internal Server Error" });
  }
};


exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const findUser = await User.findOne({ email });
    if (findUser) {
      const payload = {
        _id: findUser._id,
        email: findUser.email
      };
      const token = await generateToken(payload);
      const link = `${process.env.AUTH_LINK}/createpassword/?token=${token}`;
      await resetPasswordMail2(email, link, `${findUser.first_name} ${findUser.last_name}`);
      return res.status(200).json({
        success: true,
        message: "New link sent to your email address",
      });
    } else {
      return res.status(404).json({
        success: false,
        message: "Email does not exist",
      });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { password } = req.body;
    console.log(password,"password")
     const encryptedPassword = await bcrypt.hash(password, 10);
    const user = await verifyToken(req);
    console.log(user,"user")
    if (user) {
      const updateUser = await User.findByIdAndUpdate(user.userId, { password : encryptedPassword }, { new: true });
      console.log(updateUser,"updateUser")
      if (updateUser) {
        return res.status(200).json({
          success: true,
          message: "Password changed successfully",
        });
      } else {
        return res.status(500).json({
          success: false,
          message: "Failed to update password",
        });
      }
    } else {
      return res.status(401).json({
        success: false,
        message: "Token is invalid",
      });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

async function verifyToken(req) {
  const token = req.headers.authorization;
  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    console.error(error);
    return null;
  }
}