const { Club, User } = require("../models/schema");
const bcrypt = require("bcrypt");
const { generateToken } = require("../middlewares/authMiddleware");

exports.createClub = async (req, res) => {
  const {
    club_name,
    sub_user,
    number_of_teams,
    address,
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
    let clubProfileFile = req.files['club_profile'] ? req.files['club_profile'][0] : null;
    let profilePictureFile = req.files['profile_picture'] ? req.files['profile_picture'][0] : null;

  
    // Create a new club
    const newClub = new Club({
      club_name,
      sub_user,
      number_of_teams,
      address,
      contact,
      club_profile: clubProfileFile?clubProfileFile.filename:'',  // Update club_profile with the file path
      club_email,
      time_off_start,
      time_off_end,
    });

    const savedClub = await newClub.save();

    const encryptedPassword = await bcrypt.hash(password, 10);

    // Now that the club is created, use its _id to create the associated user
    const newUser = new User({
      first_name,
      last_name,
      email,
      phone,
      profile_picture: profilePictureFile?profilePictureFile.filename:'',  // Update profile_picture with the file path
      password: encryptedPassword,
      is_admin,
      club_id: savedClub._id,
    });
    const savedUser = await newUser.save();
    console.log("Club and User created successfully");

    // Optionally, you can send a response back to the client
    res.status(201).json({
      message: "Club and User created successfully",
      club: savedClub,
      user: savedUser,
    });
  } catch (error) {
    console.error("Error creating Club and User:", error);

    // Send an error response to the client
    res.status(500).json({
      error: "Internal Server Error",
    });
  }
};

exports.clubLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const findUser = await User.findOne({ email });
    if (!findUser) {
      return res.status(401).json({ message: "Invalid Email" });
    }

    const isValidPassword = bcrypt.compareSync(password, findUser.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid Password!" });
    }

    const token = await generateToken(findUser);
    console.log(token)
    return res.status(200).json({
      token: token,
      user: findUser,
    });
  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({
      message: "Server Error!",
    });
  }
};

// Get all clubs
exports.getAllClubs = async (req, res) => {
  try {
    const clubs = await Club.find();
    res.status(200).json(clubs);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get a specific club by ID
exports.getClubById = async (req, res) => {
  try {
    const club = await Club.findById(req.params.id);
    if (!club) {
      return res.status(404).json({ error: "Club not found" });
    }
    res.status(200).json(club);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Update a specific club by ID
exports.updateClubById = async (req, res) => {
  try {
    const updatedClub = await Club.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!updatedClub) {
      return res.status(404).json({ error: "Club not found" });
    }
    res.status(200).json(updatedClub);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Delete a specific club by ID
exports.deleteClubById = async (req, res) => {
  try {
    const deletedClub = await Club.findByIdAndDelete(req.params.id);
    if (!deletedClub) {
      return res.status(404).json({ error: "Club not found" });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.getClubWithUser = async (req, res) => {
  try {
    const clubId = req.params.club_id;

    // Find the user by club ID and populate the 'club_id' field
    const clubWithUserDetails = await User.find({ club_id: clubId, deleted_at: { $in: [null, undefined] } });

    if (!clubWithUserDetails || clubWithUserDetails.length === 0) {
      return res.status(404).json({ error: "No active users found for the club" });
    }

    // Return the user information with club details
    res.status(200).json({
      status: true,
      message: "Club with user data",
      clubWithUserDetails,
    });
  } catch (error) {
    console.error("Error fetching user with club:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
