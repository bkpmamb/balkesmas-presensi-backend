// src/routes/settingsRoutes.js

import express from "express";
import {
  getSettings,
  updateSettings,
  testLocation,
} from "../controllers/settingsController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

// Semua route di-protect dan hanya untuk admin
router.use(protect, adminOnly);

// GET /api/admin/settings - Get current settings
router.get("/", getSettings);

// PUT /api/admin/settings - Update settings
router.put("/", updateSettings);

// POST /api/admin/settings/test-location - Test location (cek jarak)
router.post("/test-location", testLocation);

export default router;
