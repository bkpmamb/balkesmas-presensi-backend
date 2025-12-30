// src/routes/attendanceRoutes.js

import express from "express";
import {
  clockIn,
  clockOut,
  getAttendanceHistory,
  getTodayAttendance,
} from "../controllers/attendanceController.js";
import { protect } from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

// Endpoint: POST /api/attendance/clock-in
// Menggunakan 'protect' agar hanya yang login bisa absen
// Menggunakan 'upload.single("image")' untuk menangkap foto
router.post("/clock-in", protect, upload.single("image"), clockIn);
router.post("/clock-out", protect, upload.single("image"), clockOut);
router.get("/my-history", protect, getAttendanceHistory);
router.get("/today", protect, getTodayAttendance);

export default router;
