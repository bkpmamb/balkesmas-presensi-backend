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
  deleteAttendance,
} from "../controllers/adminController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";
import { getTodayAttendance } from "../controllers/attendanceController.js";
import {
  getAllAttendances,
  getAttendanceById,
  getAttendancesByEmployee,
  createManualEntry,
  updateAttendanceManually,
  getManualEntries,
} from "../controllers/adminAttendanceController.js";

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

router.delete("/attendance/:id", protect, adminOnly, deleteAttendance);

// Attendance Management
router.get("/attendances", protect, adminOnly, getAllAttendances);
router.get("/attendances/:id", protect, adminOnly, getAttendanceById);
router.get(
  "/attendances/employee/:userId",
  protect,
  adminOnly,
  getAttendancesByEmployee
);
router.delete("/attendance/:id", protect, adminOnly, deleteAttendance);

// Manual Entry
router.post("/attendance/manual-entry", protect, adminOnly, createManualEntry);
router.put(
  "/attendance/:id/manual-update",
  protect,
  adminOnly,
  updateAttendanceManually
);
router.get("/attendance/manual-entries", protect, adminOnly, getManualEntries);

export default router;
