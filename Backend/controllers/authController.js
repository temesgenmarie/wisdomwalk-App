const User = require("../models/User")
const { generateToken, generateJWT, formatUserResponse } = require("../utils/helpers")
const { sendVerificationEmail, sendPasswordResetEmail, sendAdminNotificationEmail } = require("../utils/emailService")
const { saveVerificationDocument } = require("../utils/storageHelper")
 

const register = async (req, res) => {
  console.log("🟢 Starting registration...");

  try {
    const {
      email,
      password,
      firstName,
      lastName,
      dateOfBirth,
      phoneNumber,
      location,
      bio,
    } = req.body;

    console.log("📩 Incoming registration for:", email);

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    console.log("✅ Checked existing user.");

    if (existingUser) {
      console.warn("⚠️ User already exists:", email);
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    // Check for required files
    if (!req.files?.livePhoto || !req.files?.nationalId) {
      console.warn("⚠️ Missing files for:", email);
      return res.status(400).json({
        success: false,
        message: "Live photo and national ID are required for registration",
      });
    }

    // Sanitize email for folder naming
    const sanitizedEmail = email.replace(/[^a-zA-Z0-9]/g, "_");
    console.log("📁 Sanitized email:", sanitizedEmail);

    // Upload Live Photo
    let livePhotoResult;
    try {
      console.log("⬆️ Uploading live photo...");
      livePhotoResult = await saveVerificationDocument(
        req.files.livePhoto[0].buffer,
        sanitizedEmail,
        "live_photo",
        req.files.livePhoto[0].originalname
      );
      console.log("✅ Live photo uploaded:", livePhotoResult.url);
    } catch (err) {
      console.error("❌ Live photo upload failed:", err.message);
      return res.status(500).json({
        success: false,
        message: "Failed to upload live photo",
        error: err.message,
      });
    }

    // Upload National ID
    let nationalIdResult;
    try {
      console.log("⬆️ Uploading national ID...");
      nationalIdResult = await saveVerificationDocument(
        req.files.nationalId[0].buffer,
        sanitizedEmail,
        "national_id",
        req.files.nationalId[0].originalname
      );
      console.log("✅ National ID uploaded:", nationalIdResult.url);
    } catch (err) {
      console.error("❌ National ID upload failed:", err.message);
      return res.status(500).json({
        success: false,
        message: "Failed to upload national ID",
        error: err.message,
      });
    }

    // Generate email verification code
    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
    const emailVerificationExpires = new Date(Date.now() + 5 * 60 * 1000);
    console.log("🔐 Generated verification code:", verificationCode);

    // Create new user
    const user = new User({
      email,
      password,
      firstName,
      lastName,
      dateOfBirth,
      phoneNumber,
      location,
      bio,
      livePhoto: {
        url: livePhotoResult.url,
        publicId: livePhotoResult.publicId,
      },
      nationalId: {
        url: nationalIdResult.url,
        publicId: nationalIdResult.publicId,
      },
      verificationCode,
      emailVerificationExpires,
    });

    try {
      await user.save();
      console.log("💾 User saved to database:", user._id);
    } catch (err) {
      console.error("❌ Error saving user:", err.message);
      return res.status(500).json({
        success: false,
        message: "Database save failed",
        error: err.message,
      });
    }

    // Send verification email
    try {
      console.log("📧 Sending verification email...");
      await sendVerificationEmail(email, firstName, verificationCode);
      console.log("✅ Verification email sent to:", email);
    } catch (err) {
      console.error("❌ Email sending failed:", err.message);
      // Continue anyway (user still registered)
    }

    // Notify admin (non-blocking)
    try {
      console.log("📨 Sending admin notification...");
      await sendAdminNotificationEmail(
        "tommr2323@gmail.com",
        "New User Registration Pending Verification",
        "A new user has registered and is pending admin verification.",
        user
      );
      console.log("✅ Admin notified.");
    } catch (err) {
      console.warn("⚠️ Admin email failed:", err.message);
    }

    // Success response
    console.log("🎉 Registration complete for:", email);
    res.status(201).json({
      success: true,
      message: "Registration successful! Please check your email to verify your account.",
      data: {
        userId: user._id,
        email: user.email,
        emailVerificationSent: true,
        adminVerificationPending: true,
        verificationCode,
      },
    });
  } catch (error) {
    console.error("🔥 Registration error (outer catch):", error);
    res.status(500).json({
      success: false,
      message: "Registration failed",
      error: error.message,
    });
  }
};

 


// Verify email
const verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: "Email and code are required",
      })
    }

    const user = await User.findOne({
      email,
      verificationCode: code,
      emailVerificationExpires: { $gt: Date.now() },
    })

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification code",
      })
    }

    user.isEmailVerified = true
    user.verificationCode = undefined
    user.emailVerificationExpires = undefined

    await user.save()

    res.json({
      success: true,
      message: "Email verified successfully! Your account is now pending admin verification.",
      data: {
        emailVerified: true,
        adminVerificationPending: !user.isAdminVerified,
      },
    })
  } catch (error) {
    console.error("Email verification error:", error)
    res.status(500).json({
      success: false,
      message: "Email verification failed",
      error: error.message,
    })
  }
}


// Login user
const login = async (req, res) => {
  try {
    const { email, password } = req.body

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select("+password")

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      })
    }
    console.log("User found:", user.canAccess());
       console.log("User details:", {
  isEmailVerified: user.isEmailVerified,
  status: user.status,
  blockedUntil: user.blockedUntil
});
    // Check if user can access the app
    if (!user.canAccess()) {
      const statusMessages = {
        emailNotVerified: "Please verify your email address before logging in.",
         blocked: `Your account is temporarily blocked until ${user.blockedUntil?.toLocaleDateString()}.`,
        banned: "Your account has been permanently banned. Please contact support for more information.",
      }

      let message = "Account access restricted." 
      if (!user.isEmailVerified) message = statusMessages.emailNotVerified
      else if (user.status === "blocked") message = statusMessages.blocked
      else if (user.status === "banned") message = statusMessages.banned

      return res.status(403).json({
        success: false,
        message,
        details: {
          emailVerified: user.isEmailVerified,
          adminVerified: user.isAdminVerified,
          status: user.status,
          blockedUntil: user.blockedUntil,
        },
      })
    }

    // Update last active
    user.lastActive = new Date()
    await user.save()

    // Generate JWT token
const token = generateJWT({
      userId: user._id,
      isAdminVerified: user.isAdminVerified,
      isGlobalAdmin: user.isGlobalAdmin,
      isAdmin: user.isAdmin,
    });
   

    res.cookie('token', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'Strict',
  maxAge: 24 * 60 * 60 * 1000, // 1 day
  
});
 res.json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user: formatUserResponse(user),
      },
    })
  } catch (error) {
    console.error("Login error:", error)
    res.status(500).json({
      success: false,
      message: "Login failed",
      error: error.message,
    })
  }
}

// Request password reset
// Request password reset using verificationCode field
const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.json({
        success: true,
        message: "If an account with that email exists, a password reset code has been sent.",
      });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: "Email is not verified. Please verify your email before resetting your password.",
      });
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store in shared fields
    await User.updateOne(
      { email },
      {
        $set: {
          verificationCode: resetCode,
          emailVerificationExpires: expires,
        },
      }
    );

    await sendPasswordResetEmail(email, resetCode, user.firstName);

    return res.json({
      success: true,
      message: "If an account with that email exists, a password reset code has been sent.",
    });
  } catch (error) {
    console.error("Password reset request error:", error);
    return res.status(500).json({
      success: false,
      message: "Password reset request failed",
      error: error.message,
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    const user = await User.findOne({
      email,
      verificationCode: code,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset code",
      });
    }

    user.password = newPassword;
    user.verificationCode = undefined;
    user.emailVerificationExpires = undefined;

    await user.save();

    return res.json({
      success: true,
      message: "Password reset successful. You can now login with your new password.",
    });
  } catch (error) {
    console.error("Password reset error:", error);
    return res.status(500).json({
      success: false,
      message: "Password reset failed",
      error: error.message,
    });
  }
};



// Resend verification email using updateOne
const resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified",
      });
    }

const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
    const emailVerificationExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await User.updateOne(
      { email },
      {
        verificationCode,
        emailVerificationExpires,
      }
    );

    await sendVerificationEmail(email, user.firstName, verificationCode);

    res.json({
      success: true,
      message: "Verification code resent successfully",
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to resend verification code",
      error: error.message,
    });
  }
};
const logout = async (req, res) => {
  try {
    await res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
    });

    res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Logout failed",
      error: error.message,
    });
  }
};
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user._id;

    // Validate input more thoroughly
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Both current and new password are required",
        field: "missing_fields"
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
        field: "newPassword"
      });
    }

    const user = await User.findById(userId).select("+password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
        code: "user_not_found"
      });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
        field: "currentPassword"
      });
    }

    // Check if new password is different
    if (await user.comparePassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message: "New password must be different",
        field: "newPassword"
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Return success
    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
      code: "password_changed"
    });

  } catch (error) {
    console.error("Change password error:", error);
    
    // More specific error handling
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: "validation_error"
      });
    }
    
    if (error.name === 'MongoError') {
      return res.status(503).json({
        success: false,
        message: "Database error occurred",
        code: "database_error"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "server_error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};



module.exports = {
  register,
  verifyEmail,
  login,
  requestPasswordReset,
  resetPassword,
  resendVerificationEmail,
  changePassword,
  logout
}
