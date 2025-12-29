// src/routes/shiftRoutes.js

import express from "express";
import {
  getAllShifts,
  getShiftsByCategory,
  getShiftById,
  createShift,
  updateShift,
  deleteShift,
  toggleShiftStatus,
} from "../controllers/shiftController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

// Semua route di-protect dan hanya untuk admin
router.use(protect, adminOnly);

// GET /api/admin/shifts - Get all shifts (dengan pagination & filter)
router.get("/", getAllShifts);

// GET /api/admin/shifts/by-category/:categoryId - Get shifts by category (untuk dropdown)
router.get("/by-category/:categoryId", getShiftsByCategory);

// GET /api/admin/shifts/:id - Get shift by ID
router.get("/:id", getShiftById);

// POST /api/admin/shifts - Create new shift
router.post("/", createShift);

// PUT /api/admin/shifts/:id - Update shift
router.put("/:id", updateShift);

// DELETE /api/admin/shifts/:id - Delete shift
router.delete("/:id", deleteShift);

// PATCH /api/admin/shifts/:id/toggle - Toggle active status
router.patch("/:id/toggle", toggleShiftStatus);

export default router;
