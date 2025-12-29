// src/routes/categoryRoutes.js

import express from "express";
import {
  getAllCategories,
  getCategoriesList,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus,
} from "../controllers/categoryController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

// Semua route di-protect dan hanya untuk admin
router.use(protect, adminOnly);

// GET /api/admin/categories - Get all categories (dengan pagination)
router.get("/", getAllCategories);

// GET /api/admin/categories/list - Get simple list (untuk dropdown, no pagination)
router.get("/list", getCategoriesList);

// GET /api/admin/categories/:id - Get category by ID
router.get("/:id", getCategoryById);

// POST /api/admin/categories - Create new category
router.post("/", createCategory);

// PUT /api/admin/categories/:id - Update category
router.put("/:id", updateCategory);

// DELETE /api/admin/categories/:id - Delete category
router.delete("/:id", deleteCategory);

// PATCH /api/admin/categories/:id/toggle - Toggle active status
router.patch("/:id/toggle", toggleCategoryStatus);

export default router;
