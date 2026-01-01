import express from "express";
import { protect, adminOnly } from "../middleware/authMiddleware.js";
import {
  exportToExcel,
  exportToPDF,
  exportEmployeeExcel,
  exportEmployeePDF,
} from "../controllers/exportController.js";

const router = express.Router();

// General Export
router.get("/excel", protect, adminOnly, exportToExcel);
router.get("/pdf", protect, adminOnly, exportToPDF);

// Employee Specific Export
router.get("/employee/:userId/excel", protect, adminOnly, exportEmployeeExcel);
router.get("/employee/:userId/pdf", protect, adminOnly, exportEmployeePDF);

export default router;
