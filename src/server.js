// src/server.js

import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";

// Import routes
import authRoutes from "./routes/authRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import shiftRoutes from "./routes/shiftRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import shiftScheduleRoutes from "./routes/shiftScheduleRoutes.js";

dotenv.config();
const app = express();

const PORT = process.env.PORT || 5001;

// ===== IMPROVED DATABASE CONNECTION =====
const connectDB = async (retries = 5, delay = 3000) => {
  // Jika sudah connected, skip
  if (mongoose.connection.readyState === 1) {
    console.log("✅ Database already connected");
    return true;
  }

  // Jika sedang connecting, tunggu
  if (mongoose.connection.readyState === 2) {
    console.log("⏳ Database connection in progress...");
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return mongoose.connection.readyState === 1;
  }

  for (let i = 0; i < retries; i++) {
    try {
      console.log(`🔌 Attempting database connection (${i + 1}/${retries})...`);

      await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 30000, // 30 detik (lebih panjang)
        socketTimeoutMS: 45000,
        family: 4, // Force IPv4
        maxPoolSize: 10,
        minPoolSize: 2,
      });

      console.log("✅ MongoDB Connected Successfully");
      console.log("📊 Database:", mongoose.connection.name);
      console.log("🖥️  Host:", mongoose.connection.host);
      return true;
    } catch (error) {
      console.error(`❌ Connection attempt ${i + 1} failed:`, error.message);

      if (i < retries - 1) {
        console.log(`⏳ Retrying in ${delay / 1000} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error(
          "💥 Failed to connect to database after",
          retries,
          "attempts"
        );
        console.error("🔍 Troubleshooting tips:");
        console.error("   1. Check your internet connection");
        console.error("   2. Verify MongoDB Atlas is accessible");
        console.error("   3. Check IP whitelist in MongoDB Atlas");
        console.error("   4. Try: sudo dscacheutil -flushcache");
        throw error;
      }
    }
  }
};

// ===== HANDLE MONGOOSE EVENTS =====
mongoose.connection.on("connected", () => {
  console.log("🟢 Mongoose connected to MongoDB");
});

mongoose.connection.on("error", (err) => {
  console.error("🔴 Mongoose connection error:", err.message);
});

mongoose.connection.on("disconnected", () => {
  console.log("🟡 Mongoose disconnected from MongoDB");
});

// ===== GRACEFUL SHUTDOWN =====
process.on("SIGINT", async () => {
  await mongoose.connection.close();
  console.log("⚠️  MongoDB connection closed through app termination");
  process.exit(0);
});

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ===== MIDDLEWARE: Ensure DB Connected Before Each Request =====
app.use(async (req, res, next) => {
  try {
    const isConnected = await connectDB();
    if (!isConnected) {
      return res.status(503).json({
        success: false,
        message: "Database connection unavailable. Please try again.",
      });
    }
    next();
  } catch (error) {
    return res.status(503).json({
      success: false,
      message: "Database connection failed",
      error: error.message,
    });
  }
});

// ===== ROUTES =====
app.use("/api/auth", authRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/categories", categoryRoutes);
app.use("/api/admin/shifts", shiftRoutes);
app.use("/api/admin/settings", settingsRoutes);
app.use("/api/admin/shift-schedules", shiftScheduleRoutes);

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Balkesmas API is running",
    status: "OK",
    database:
      mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
    timestamp: new Date().toISOString(),
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    database:
      mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
    uptime: process.uptime(),
  });
});

// ===== ERROR HANDLING =====
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.message);
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    success: false,
    message: err.message,
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// ===== START SERVER =====
const startServer = async () => {
  try {
    // Connect ke database dulu sebelum start server
    await connectDB();

    app.listen(PORT, () => {
      console.log("\n🚀 ================================");
      console.log(
        `   Server running in ${process.env.NODE_ENV || "development"} mode`
      );
      console.log(`   Port: ${PORT}`);
      console.log(`   URL: http://localhost:${PORT}`);
      console.log("🚀 ================================\n");
    });
  } catch (error) {
    console.error("💥 Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();

export default app;
