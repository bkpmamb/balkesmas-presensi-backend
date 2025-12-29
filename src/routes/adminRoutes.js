// src/routes/adminRoutes.js

import express from "express";
import {
  getAllAttendance,
  getAdminStats,
  getAllEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  resetPassword,
  getAttendanceReport,
  exportAttendance,
} from "../controllers/adminController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";
import { getTodayAttendance } from "../controllers/attendanceController.js";

const router = express.Router();

// Apply middleware ke semua route
router.use(protect, adminOnly);

// ===== ATTENDANCE ROUTES =====
router.get("/all-attendance", getAllAttendance);
router.get("/attendance/today", getTodayAttendance);
router.get("/report", getAttendanceReport);
router.get("/export", exportAttendance);

// ===== STATS & DASHBOARD =====
router.get("/stats", getAdminStats);

// ===== EMPLOYEE MANAGEMENT =====
router.get("/employees", getAllEmployees);
router.post("/employees", createEmployee);
router.put("/employees/:id", updateEmployee);
router.delete("/employees/:id", deleteEmployee);
router.put("/employees/:id/reset-password", resetPassword);

export default router;
