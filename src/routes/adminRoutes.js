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

router.get("/all-attendance", protect, adminOnly, getAllAttendance);
router.get("/stats", protect, adminOnly, getAdminStats);
router.get("/employees", protect, adminOnly, getAllEmployees);
router.post("/employees", protect, adminOnly, createEmployee);
router.put("/employees/:id", protect, adminOnly, updateEmployee);
router.delete("/employees/:id", protect, adminOnly, deleteEmployee);
router.put("/employees/:id/reset-password", protect, adminOnly, resetPassword);
router.get("/report", protect, adminOnly, getAttendanceReport);
router.get("/export", protect, adminOnly, exportAttendance);
router.get("/attendance/today", protect, adminOnly, getTodayAttendance);

export default router;
