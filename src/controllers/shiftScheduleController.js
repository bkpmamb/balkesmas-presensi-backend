// src/controllers/shiftScheduleController.js

import ShiftSchedule from "../models/ShiftSchedule.js";
import User from "../models/User.js";
import Shift from "../models/Shift.js";

// @desc    Get shift schedule for a user
// @route   GET /api/admin/shift-schedules/user/:userId
// @access  Private/Admin
export const getUserShiftSchedule = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validasi user exists
    const user = await User.findById(userId).populate(
      "category",
      "name prefix"
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Karyawan tidak ditemukan",
      });
    }

    // Get schedules untuk 7 hari (0-6)
    const schedules = await ShiftSchedule.find({ user: userId })
      .populate("shift", "name startTime endTime toleranceMinutes")
      .sort({ dayOfWeek: 1 });

    // Format response dengan nama hari
    const dayNames = [
      "Minggu",
      "Senin",
      "Selasa",
      "Rabu",
      "Kamis",
      "Jumat",
      "Sabtu",
    ];

    const scheduleMap = schedules.reduce((acc, schedule) => {
      acc[schedule.dayOfWeek] = schedule;
      return acc;
    }, {});

    const formattedSchedules = Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i,
      dayName: dayNames[i],
      schedule: scheduleMap[i] || null,
    }));

    res.status(200).json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          employeeId: user.employeeId,
          category: user.category,
        },
        schedules: formattedSchedules,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Gagal mengambil jadwal shift",
      error: error.message,
    });
  }
};

// @desc    Set shift schedule for a user (single day)
// @route   POST /api/admin/shift-schedules
// @access  Private/Admin
export const setShiftSchedule = async (req, res) => {
  try {
    const { userId, dayOfWeek, shiftId } = req.body;

    // Validasi input
    if (!userId || dayOfWeek === undefined || !shiftId) {
      return res.status(400).json({
        success: false,
        message: "User, hari, dan shift wajib diisi",
      });
    }

    if (dayOfWeek < 0 || dayOfWeek > 6) {
      return res.status(400).json({
        success: false,
        message: "Hari harus antara 0 (Minggu) sampai 6 (Sabtu)",
      });
    }

    // Validasi user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Karyawan tidak ditemukan",
      });
    }

    // Validasi shift exists dan sesuai kategori user
    const shift = await Shift.findById(shiftId);
    if (!shift) {
      return res.status(404).json({
        success: false,
        message: "Shift tidak ditemukan",
      });
    }

    if (shift.category.toString() !== user.category.toString()) {
      return res.status(400).json({
        success: false,
        message: "Shift tidak sesuai dengan kategori karyawan",
      });
    }

    // Update or Create schedule
    const schedule = await ShiftSchedule.findOneAndUpdate(
      { user: userId, dayOfWeek },
      { shift: shiftId, isActive: true },
      { upsert: true, new: true }
    ).populate("shift", "name startTime endTime");

    const dayNames = [
      "Minggu",
      "Senin",
      "Selasa",
      "Rabu",
      "Kamis",
      "Jumat",
      "Sabtu",
    ];

    res.status(200).json({
      success: true,
      message: `Jadwal shift untuk hari ${dayNames[dayOfWeek]} berhasil diatur`,
      data: schedule,
    });
  } catch (error) {
    // Handle unique constraint error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Jadwal untuk hari ini sudah ada",
      });
    }

    res.status(500).json({
      success: false,
      message: "Gagal mengatur jadwal shift",
      error: error.message,
    });
  }
};

// @desc    Bulk set shift schedule for a user (all days at once)
// @route   POST /api/admin/shift-schedules/bulk
// @access  Private/Admin
export const bulkSetShiftSchedule = async (req, res) => {
  try {
    const { userId, schedules } = req.body;
    // schedules format: [{ dayOfWeek: 0, shiftId: "..." }, { dayOfWeek: 1, shiftId: "..." }, ...]

    if (!userId || !Array.isArray(schedules)) {
      return res.status(400).json({
        success: false,
        message: "User dan array schedules wajib diisi",
      });
    }

    // Validasi user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Karyawan tidak ditemukan",
      });
    }

    const results = [];
    const errors = [];

    for (const item of schedules) {
      try {
        const { dayOfWeek, shiftId } = item;

        if (dayOfWeek < 0 || dayOfWeek > 6) {
          errors.push({
            dayOfWeek,
            error: "Hari harus antara 0-6",
          });
          continue;
        }

        if (!shiftId) {
          // Jika shiftId null/kosong, hapus schedule untuk hari ini
          await ShiftSchedule.findOneAndDelete({ user: userId, dayOfWeek });
          results.push({ dayOfWeek, action: "removed" });
          continue;
        }

        // Validasi shift exists dan sesuai kategori
        const shift = await Shift.findById(shiftId);
        if (!shift) {
          errors.push({
            dayOfWeek,
            shiftId,
            error: "Shift tidak ditemukan",
          });
          continue;
        }

        if (shift.category.toString() !== user.category.toString()) {
          errors.push({
            dayOfWeek,
            shiftId,
            error: "Shift tidak sesuai kategori karyawan",
          });
          continue;
        }

        // Update or create
        const schedule = await ShiftSchedule.findOneAndUpdate(
          { user: userId, dayOfWeek },
          { shift: shiftId, isActive: true },
          { upsert: true, new: true }
        );

        results.push({
          dayOfWeek,
          scheduleId: schedule._id,
          action: "set",
        });
      } catch (err) {
        errors.push({
          dayOfWeek: item.dayOfWeek,
          error: err.message,
        });
      }
    }

    res.status(200).json({
      success: errors.length === 0,
      message:
        errors.length === 0
          ? "Semua jadwal shift berhasil diatur"
          : `${results.length} jadwal berhasil, ${errors.length} gagal`,
      data: {
        successful: results,
        failed: errors,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Gagal mengatur jadwal shift",
      error: error.message,
    });
  }
};

// @desc    Delete shift schedule (remove schedule for specific day)
// @route   DELETE /api/admin/shift-schedules/:scheduleId
// @access  Private/Admin
export const deleteShiftSchedule = async (req, res) => {
  try {
    const schedule = await ShiftSchedule.findById(req.params.scheduleId);

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Jadwal tidak ditemukan",
      });
    }

    const dayNames = [
      "Minggu",
      "Senin",
      "Selasa",
      "Rabu",
      "Kamis",
      "Jumat",
      "Sabtu",
    ];

    await ShiftSchedule.findByIdAndDelete(req.params.scheduleId);

    res.status(200).json({
      success: true,
      message: `Jadwal shift untuk hari ${
        dayNames[schedule.dayOfWeek]
      } berhasil dihapus`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Gagal menghapus jadwal shift",
      error: error.message,
    });
  }
};

// @desc    Get all users with their shift schedules (overview)
// @route   GET /api/admin/shift-schedules/overview
// @access  Private/Admin
export const getShiftSchedulesOverview = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const users = await User.find({ role: "employee" })
      .select("name employeeId category")
      .populate("category", "name prefix")
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit);

    const totalUsers = await User.countDocuments({ role: "employee" });
    const totalPages = Math.ceil(totalUsers / limit);

    // Get schedules untuk semua users
    const usersWithSchedules = await Promise.all(
      users.map(async (user) => {
        const scheduleCount = await ShiftSchedule.countDocuments({
          user: user._id,
        });

        return {
          ...user.toObject(),
          scheduledDays: scheduleCount,
          hasFullSchedule: scheduleCount === 7,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: usersWithSchedules,
      pagination: {
        totalData: totalUsers,
        totalPages,
        currentPage: page,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Gagal mengambil overview jadwal shift",
      error: error.message,
    });
  }
};
