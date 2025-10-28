/**
 * WisdomWalk Backend Server
 * Express + Socket.io + MongoDB + Security Middleware
 */

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const cookieParser = require("cookie-parser");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

// ===== Import Routes =====
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const postRoutes = require("./routes/postRoutes");
const chatRoutes = require("./routes/chatRoutes");
const adminRoutes = require("./routes/adminRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const reportRoutes = require("./routes/reportRoutes");
const movementRoutes = require("./routes/movementRoute");
const bookingRoutes = require("./routes/bookingRoute");
const eventRoutes = require("./routes/eventRoutes");
const groupRoutes = require("./routes/group");

// ===== Initialize App & Server =====
const app = express();
const server = http.createServer(app);

// ===== Middleware =====

// CORS Configuration (adjust origin for production)
app.use(
  cors({
    origin: "*", // Replace with your frontend URL in production
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Security headers
app.use(helmet());

// Body parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Cookies
app.use(cookieParser());

// Static file serving
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "Uploads")));

// ===== Socket.IO Setup =====
const io = new Server(server, {
  cors: {
    origin: "*", // Replace with frontend URL
    credentials: true,
    methods: ["GET", "POST"],
  },
});
app.set("io", io);
require("./socket/socket")(io);

// ===== Rate Limiting =====
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 200, // max requests per window per IP
  standardHeaders: "draft-7",
  legacyHeaders: false,
});
app.use(limiter);

// ===== Routes =====
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/movements", movementRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/events", eventRoutes);

// ===== Health Check Route =====
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "WisdomWalk API is running",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ===== Error Handling =====
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.message);
  res.status(500).json({
    success: false,
    message: "Something went wrong!",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// ===== 404 Fallback =====
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// ===== MongoDB Connection =====
mongoose
  .connect(process.env.MONGO_URI || "mongodb+srv://tom:1234tom2394@wisdomwalk.db2qsqm.mongodb.net/?retryWrites=true&w=majority&appName=wisdomwalk" , {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`📁 Public: ${path.join(__dirname, "public")}`);
      console.log(`📁 Uploads: ${path.join(__dirname, "Uploads")}`);
    });
  })
  .catch((err) => console.error("❌ MongoDB connection error:", err));

module.exports = app;
