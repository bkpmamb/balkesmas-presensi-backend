// src/server.js

import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

dotenv.config();
const app = express();

// 1. Koneksi Database (Optimasi untuk Serverless)
const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) return; // Jika sudah konek, lewati
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB Connected");
  } catch (error) {
    console.error(`Error: ${error.message}`);
    // Jangan gunakan process.exit(1) di serverless agar tidak mematikan instance
  }
};

// Middleware untuk memastikan DB terkoneksi di setiap request (opsional tapi aman di Vercel)
app.use(async (req, res, next) => {
  await connectDB();
  next();
});

// Middleware Standar
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/admin", adminRoutes);

app.get("/", (req, res) => {
  res.send("Balkesmas API is running ...");
});

// Error Handling
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    message: err.message,
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
});

export default app;
