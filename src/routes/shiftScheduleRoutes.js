// src/routes/shiftScheduleRoutes.js

import express from "express";
import {
  getUserShiftSchedule,
  setShiftSchedule,
  bulkSetShiftSchedule,
  deleteShiftSchedule,
  getShiftSchedulesOverview,
} from "../controllers/shiftScheduleController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

// Semua route di-protect dan hanya untuk admin
router.use(protect, adminOnly);

// GET /api/admin/shift-schedules/overview - Get all users with schedule status
router.get("/overview", getShiftSchedulesOverview);

// GET /api/admin/shift-schedules/user/:userId - Get schedule for specific user
router.get("/user/:userId", getUserShiftSchedule);

// POST /api/admin/shift-schedules - Set single day schedule
router.post("/", setShiftSchedule);

// POST /api/admin/shift-schedules/bulk - Bulk set schedule (all days)
router.post("/bulk", bulkSetShiftSchedule);

// DELETE /api/admin/shift-schedules/:scheduleId - Delete schedule
router.delete("/:scheduleId", deleteShiftSchedule);

export default router;
