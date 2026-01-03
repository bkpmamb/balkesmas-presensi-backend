// src/controllers/shiftController.js

import Shift from "../models/Shift.js";
import Category from "../models/Category.js";
import User from "../models/User.js";
import ShiftSchedule from "../models/ShiftSchedule.js";

// @desc    Get all shifts
// @route   GET /api/admin/shifts
// @access  Private/Admin
export const getAllShifts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const categoryId = req.query.category; // Filter by category
    const skip = (page - 1) * limit;

    // Build filter
    let filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (categoryId) {
      filter.category = categoryId;
    }

    // Query dengan pagination
    const shifts = await Shift.find(filter)
      .populate("category", "name prefix")
      .sort({ category: 1, startTime: 1 })
      .skip(skip)
      .limit(limit);

    const totalShifts = await Shift.countDocuments(filter);
    const totalPages = Math.ceil(totalShifts / limit);

    res.status(200).json({
      success: true,
      message: "Daftar shift berhasil diambil",
      data: shifts,
      pagination: {
        totalData: totalShifts,
        totalPages: totalPages,
        currentPage: page,
        limit: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Gagal mengambil daftar shift",
      error: error.message,
    });
  }
};

// @desc    Get shifts by category (untuk dropdown)
// @route   GET /api/admin/shifts/by-category/:categoryId
// @access  Private/Admin
export const getShiftsByCategory = async (req, res) => {
  try {
    const shifts = await Shift.find({
      category: req.params.categoryId,
      isActive: true,
    })
      .select("_id name startTime endTime")
      .sort({ startTime: 1 });

    res.status(200).json({
      success: true,
      data: shifts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Gagal mengambil daftar shift",
      error: error.message,
    });
  }
};

// @desc    Get shift by ID
// @route   GET /api/admin/shifts/:id
// @access  Private/Admin
export const getShiftById = async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id).populate(
      "category",
      "name prefix"
    );

    if (!shift) {
      return res.status(404).json({
        success: false,
        message: "Shift tidak ditemukan",
      });
    }

    // Hitung jumlah karyawan yang menggunakan shift ini
    const assignedCount = await ShiftSchedule.countDocuments({
      shift: shift._id,
    });

    res.status(200).json({
      success: true,
      data: {
        ...shift.toObject(),
        assignedCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Gagal mengambil detail shift",
      error: error.message,
    });
  }
};

// @desc    Create new shift
// @route   POST /api/admin/shifts
// @access  Private/Admin
export const createShift = async (req, res) => {
  try {
    const {
      name,
      category,
      startTime,
      endTime,
      toleranceMinutes,
      description,
    } = req.body;

    // Validasi input
    if (!name || !category || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: "Nama, kategori, waktu mulai, dan waktu selesai wajib diisi",
      });
    }

    // Validasi category exists
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(404).json({
        success: false,
        message: "Kategori tidak ditemukan",
      });
    }

    // Validasi format waktu (HH:mm)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return res.status(400).json({
        success: false,
        message: "Format waktu harus HH:mm (contoh: 08:00)",
      });
    }

    // Cek duplicate name di category yang sama
    const shiftExists = await Shift.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
      category: category,
    });
    if (shiftExists) {
      return res.status(400).json({
        success: false,
        message: `Shift dengan nama "${name}" sudah ada di kategori ini`,
      });
    }

    // Create shift
    const shift = await Shift.create({
      name: name.trim(),
      category,
      startTime,
      endTime,
      toleranceMinutes: toleranceMinutes || 15,
      description: description?.trim(),
    });

    // Populate category untuk response
    await shift.populate("category", "name prefix");

    res.status(201).json({
      success: true,
      message: "Shift berhasil ditambahkan",
      data: shift,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Gagal menambahkan shift",
      error: error.message,
    });
  }
};

// @desc    Update shift
// @route   PUT /api/admin/shifts/:id
// @access  Private/Admin
export const updateShift = async (req, res) => {
  try {
    const {
      name,
      category,
      startTime,
      endTime,
      toleranceMinutes,
      description,
      isActive,
    } = req.body;

    const shift = await Shift.findById(req.params.id);

    if (!shift) {
      return res.status(404).json({
        success: false,
        message: "Shift tidak ditemukan",
      });
    }

    // Validasi format waktu jika diupdate
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (startTime && !timeRegex.test(startTime)) {
      return res.status(400).json({
        success: false,
        message: "Format waktu mulai harus HH:mm (contoh: 08:00)",
      });
    }
    if (endTime && !timeRegex.test(endTime)) {
      return res.status(400).json({
        success: false,
        message: "Format waktu selesai harus HH:mm (contoh: 16:00)",
      });
    }

    // Jika update category, validasi exists
    if (category && category !== shift.category.toString()) {
      const categoryExists = await Category.findById(category);
      if (!categoryExists) {
        return res.status(404).json({
          success: false,
          message: "Kategori tidak ditemukan",
        });
      }
      shift.category = category;
    }

    // Jika update name, cek duplicate
    if (name && name !== shift.name) {
      const shiftExists = await Shift.findOne({
        name: { $regex: new RegExp(`^${name}$`, "i") },
        category: category || shift.category,
        _id: { $ne: req.params.id },
      });
      if (shiftExists) {
        return res.status(400).json({
          success: false,
          message: `Shift dengan nama "${name}" sudah ada di kategori ini`,
        });
      }
      shift.name = name.trim();
    }

    if (startTime) shift.startTime = startTime;
    if (endTime) shift.endTime = endTime;
    if (toleranceMinutes !== undefined)
      shift.toleranceMinutes = toleranceMinutes;
    if (description !== undefined) shift.description = description?.trim();
    if (isActive !== undefined) shift.isActive = isActive;

    await shift.save();
    await shift.populate("category", "name prefix");

    res.status(200).json({
      success: true,
      message: "Shift berhasil diperbarui",
      data: shift,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Gagal memperbarui shift",
      error: error.message,
    });
  }
};

// @desc    Delete shift
// @route   DELETE /api/admin/shifts/:id
// @access  Private/Admin
export const deleteShift = async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id);

    if (!shift) {
      return res.status(404).json({
        success: false,
        message: "Shift tidak ditemukan",
      });
    }

    // Cek apakah ada schedule yang menggunakan shift ini
    const scheduleCount = await ShiftSchedule.countDocuments({
      shift: shift._id,
    });
    if (scheduleCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Shift tidak dapat dihapus karena masih digunakan oleh ${scheduleCount} jadwal karyawan`,
      });
    }

    await Shift.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: `Shift "${shift.name}" berhasil dihapus`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Gagal menghapus shift",
      error: error.message,
    });
  }
};

// @desc    Toggle shift active status
// @route   PATCH /api/admin/shifts/:id/toggle
// @access  Private/Admin
export const toggleShiftStatus = async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id);

    if (!shift) {
      return res.status(404).json({
        success: false,
        message: "Shift tidak ditemukan",
      });
    }

    shift.isActive = !shift.isActive;
    await shift.save();
    await shift.populate("category", "name prefix");

    res.status(200).json({
      success: true,
      message: `Shift "${shift.name}" ${
        shift.isActive ? "diaktifkan" : "dinonaktifkan"
      }`,
      data: shift,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Gagal mengubah status shift",
      error: error.message,
    });
  }
};
