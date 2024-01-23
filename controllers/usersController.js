const { User } = require("../models/schema");
const bcrypt = require("bcrypt");

exports.createSubUser = async (req, res) => {
  try {
    let { club_id, first_name, last_name, email, phone, password, is_admin } =
      req.body;

    let userProfileFile = req.files["user_profile"]
      ? req.files["user_profile"][0]
      : null;
    is_admin = is_admin == "true" ? true : false;
    // Check if user already exists in the database by checking their email address
    const existingUser = await User.findOne({ email });
    console.log(existingUser, "existing user");
    if (!existingUser) {
      // If no user with that email was found, create a new user and save them to the database.
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      const newUser = await User.create({
        first_name,
        last_name,
        email,
        phone,
        profile_picture: userProfileFile ? userProfileFile.filename : "",
        password: hashedPassword,
        is_admin,
        club_id,
      });

      return res.status(201).json({
        success: true,
        message: "Successfully created sub-user.",
        user: newUser,
      });
    } else {
      // If a user with this email address already exists, return a conflict response.
      return res.status(409).json({
        success: false,
        message: "A user with this email address already exists.",
      });
    }
  } catch (error) {
    console.error("Error creating sub-user:", error.message);
    return res.status(500).json({ success: false, error: "Server Error" });
  }
};

exports.updateSubUser = async (req, res) => {
  try {
    let { first_name, last_name, profile_picture, phone, address, user_id } =
      req.body;
    // Find the user that we want to update
    const userToUpdate = await User.findByIdAndUpdate(
      user_id,
      {
        $set: {
          first_name,
          last_name,
          profile_picture,
          phone,
          address,
        },
      },
      { new: true }
    );

    if (!userToUpdate) {
      return res
        .status(404)
        .json({ success: false, message: "User not Found!" });
    }

    // Continue with the response for a successful update
    return res.status(200).json({
      success: true,
      message: "User information updated successfully.",
      updatedUser: userToUpdate,
    });
  } catch (error) {
    console.error("Error updating sub-user:", error.message);
    return res.status(500).json({ success: false, error: "Server Error" });
  }
};

exports.softDeleteSubUser = async (req, res) => {
  try {
    const userId = req.params.id;

    // Find the user that you want to soft delete
    const userToDelete = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          deleted_at: new Date(),
        },
      },
      { new: true }
    );

    if (!userToDelete) {
      return res
        .status(404)
        .json({ success: false, message: "User not Found!" });
    }

    // Continue with the response for a successful soft deletion
    return res.status(200).json({
      success: true,
      message: "User soft deleted successfully.",
      deletedUser: userToDelete,
    });
  } catch (error) {
    console.error("Error soft deleting sub-user:", error.message);
    return res.status(500).json({ success : false, error: "Server Error" });
  }
};

exports.viewSubUserProfile = async (req, res) => {
  try {
    const { userId, clubId } = req.query;

    // Find the subuser by user ID and club ID
    const subuser = await User.findOne({ _id: userId, club_id: clubId });

    if (!subuser) {
      return res.status(404).json({ success : false, message: "Subuser not found" });
    }

    return res.status(200).json({
      success : true,
      message: "Subuser profile",
      subUser: subuser,
    });
  } catch (error) {
    console.error("Error fetching subuser profile:", error.message);
    return res.status(500).json({ success : false, error: "Server Error" });
  }
};

exports.activateOrDeactivateSubUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { is_active } = req.body;

    // Validate is_active value
    if (is_active === undefined || typeof is_active !== "boolean") {
      return res.status(400).json({ success : false, message: "Invalid is_active value" });
    }

    // Fetch the user
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success : false, message: "User not found" });
    }

    // Check if the user is an admin
    if (user.is_admin) {
      return res.status(400).json({ success : false, message: "Cannot deactivate an admin user" });
    }

    // Update User document
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { is_active } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ success : false, message: "User not found" });
    }

    let status = is_active == true ? "activated" : "deactivated";
    return res
      .status(200)
      .json({ success : true, message: `User ${status} successfully`, user: updatedUser });
  } catch (error) {
    console.error("Error in activate/deactivate User:", error);
    return res.status(500).json({ success : false, message: "Server Error" });
  }
};
