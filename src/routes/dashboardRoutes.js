// src/routes/dashboardRoutes.js

import express from "express";
import { protect, adminOnly } from "../middleware/authMiddleware.js";
import {
  getDashboardStats,
  getTodaySummary,
  getMonthlyStats,
} from "../controllers/dashboardController.js";

const router = express.Router();

// Dashboard Statistics
router.get("/stats", protect, adminOnly, getDashboardStats);
router.get("/today", protect, adminOnly, getTodaySummary);
router.get("/monthly", protect, adminOnly, getMonthlyStats);

export default router;
