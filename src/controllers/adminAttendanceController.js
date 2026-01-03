import Attendance from "../models/Attendance.js";
import User from "../models/User.js";
import Shift from "../models/Shift.js";


/**
 * Get All Attendance(Admin)
 */
export const getAllAttendances = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      userId,
      shiftId,
      startDate,
      endDate,
      clockInStatus, // "ontime" or "late"
      clockOutStatus, // "normal", "early", "ontime"
      search, // Search by employee name
      sortBy = "date", // "date", "name", "clockIn", "clockOut"
      sortOrder = "desc", // "asc" or "desc"
    } = req.query;

    console.log("==========================================");
    console.log("📊 GET ALL ATTENDANCES REQUEST");
    console.log("Filters:", {
      page,
      limit,
      userId,
      shiftId,
      startDate,
      endDate,
      clockInStatus,
      clockOutStatus,
      search,
      sortBy,
      sortOrder,
    });
    // Build query filter
    const filter = {};

    // Filter by user
    if (userId) {
      filter.user = userId;
    }

    // Filter by shift
    if (shiftId) {
      filter.shift = shiftId;
    }

    // Filter by date range
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) {
        filter.date.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // End of day
        filter.date.$lte = end;
      }
    }

    // Filter by clock in status
    if (clockInStatus) {
      filter.clockInStatus = clockInStatus;
    }

    // Filter by clock out status
    if (clockOutStatus) {
      filter.clockOutStatus = clockOutStatus;
    }

    console.log("Filter object:", JSON.stringify(filter, null, 2));

    // Search by employee name (if provided)
    let userIds = [];
    if (search) {
      const users = await User.find({
        role: "employee",
        $or: [
          { name: { $regex: search, $options: "i" } },
          { employeeId: { $regex: search, $options: "i" } },
        ],
      }).select("_id");

      userIds = users.map((u) => u._id);
      console.log("Found users matching search:", userIds.length);

      if (userIds.length > 0) {
        filter.user = { $in: userIds };
      } else {
        // No users found, return empty result
        return res.status(200).json({
          success: true,
          message: "Tidak ada data presensi ditemukan",
          data: [],
          pagination: {
            totalData: 0,
            totalPages: 0,
            currentPage: parseInt(page),
            limit: parseInt(limit),
            hasNextPage: false,
            hasPrevPage: false,
          },
          summary: {
            totalAttendances: 0,
            totalOnTime: 0,
            totalLate: 0,
            totalEarlyClockOut: 0,
            totalNormalClockOut: 0,
            totalNotClockedOut: 0,
          },
        });
      }
    }

    // Build sort object
    let sortObject = {};
    switch (sortBy) {
      case "name":
        sortObject = { "user.name": sortOrder === "asc" ? 1 : -1 };
        break;
      case "clockIn":
        sortObject = { clockIn: sortOrder === "asc" ? 1 : -1 };
        break;
      case "clockOut":
        sortObject = { clockOut: sortOrder === "asc" ? 1 : -1 };
        break;
      case "date":
      default:
        sortObject = { date: sortOrder === "asc" ? 1 : -1 };
        break;
    }

    console.log("Sort object:", sortObject);

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get attendances with population
    const attendances = await Attendance.find(filter)
      .populate("user", "name employeeId category")
      .populate({
        path: "user",
        populate: {
          path: "category",
          select: "name prefix",
        },
      })
      .populate("shift", "name startTime endTime")
      .sort(sortObject)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count
    const totalData = await Attendance.countDocuments(filter);
    const totalPages = Math.ceil(totalData / parseInt(limit));

    // Calculate summary statistics
    const allAttendances = await Attendance.find(filter).lean();

    const summary = {
      totalAttendances: allAttendances.length,
      totalOnTime: allAttendances.filter((a) => a.clockInStatus === "ontime")
        .length,
      totalLate: allAttendances.filter((a) => a.clockInStatus === "late")
        .length,
      totalEarlyClockOut: allAttendances.filter(
        (a) => a.clockOutStatus === "early"
      ).length,
      totalNormalClockOut: allAttendances.filter(
        (a) => a.clockOutStatus === "normal"
      ).length,
      totalNotClockedOut: allAttendances.filter((a) => !a.clockOut).length,
      averageWorkMinutes:
        allAttendances.length > 0
          ? Math.round(
              allAttendances.reduce((sum, a) => sum + (a.workMinutes || 0), 0) /
                allAttendances.length
            )
          : 0,
    };

    console.log("Results:", attendances.length, "attendances");
    console.log("Summary:", summary);
    console.log("==========================================");

    res.status(200).json({
      success: true,
      message: "Data presensi berhasil diambil",
      data: attendances,
      pagination: {
        totalData,
        totalPages,
        currentPage: parseInt(page),
        limit: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
      },
      summary,
    });
  } catch (error) {
    console.error("❌ Get All Attendances Error:", error);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil data presensi",
      error: error.message,
    });
  }
};

/**
 * Get Attendance by ID (Admin)
 */
export const getAttendanceById = async (req, res) => {
  try {
    const { id } = req.params;

    const attendance = await Attendance.findById(id)
      .populate("user", "name employeeId category phone")
      .populate({
        path: "user",
        populate: {
          path: "category",
          select: "name prefix",
        },
      })
      .populate("shift", "name startTime endTime toleranceMinutes")
      .lean();

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Data presensi tidak ditemukan",
      });
    }

    res.status(200).json({
      success: true,
      data: attendance,
    });
  } catch (error) {
    console.error("Get Attendance by ID Error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "ID presensi tidak valid",
      });
    }

    res.status(500).json({
      success: false,
      message: "Gagal mengambil data presensi",
      error: error.message,
    });
  }
};

/**
 * Get Attendances by Employee (Admin)
 */
export const getAttendancesByEmployee = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, startDate, endDate } = req.query;

    // Check if user exists
    const user = await User.findById(userId).populate(
      "category",
      "name prefix"
    );
    if (!user || user.role !== "employee") {
      return res.status(404).json({
        success: false,
        message: "Karyawan tidak ditemukan",
      });
    }

    // Build filter
    const filter = { user: userId };

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) {
        filter.date.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const attendances = await Attendance.find(filter)
      .populate("shift", "name startTime endTime")
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const totalData = await Attendance.countDocuments(filter);
    const totalPages = Math.ceil(totalData / parseInt(limit));

    // Calculate employee summary
    const allAttendances = await Attendance.find(filter).lean();
    const summary = {
      employeeName: user.name,
      employeeId: user.employeeId,
      category: user.category.name,
      totalAttendances: allAttendances.length,
      totalOnTime: allAttendances.filter((a) => a.clockInStatus === "ontime")
        .length,
      totalLate: allAttendances.filter((a) => a.clockInStatus === "late")
        .length,
      totalLateMinutes: allAttendances.reduce(
        (sum, a) => sum + (a.lateMinutes || 0),
        0
      ),
      totalWorkMinutes: allAttendances.reduce(
        (sum, a) => sum + (a.workMinutes || 0),
        0
      ),
      averageWorkHours:
        allAttendances.length > 0
          ? Math.round(
              (allAttendances.reduce(
                (sum, a) => sum + (a.workMinutes || 0),
                0
              ) /
                allAttendances.length /
                60) *
                10
            ) / 10
          : 0,
    };

    res.status(200).json({
      success: true,
      message: `Data presensi ${user.name} berhasil diambil`,
      data: attendances,
      pagination: {
        totalData,
        totalPages,
        currentPage: parseInt(page),
        limit: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
      },
      summary,
    });
  } catch (error) {
    console.error("Get Attendances by Employee Error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "ID karyawan tidak valid",
      });
    }

    res.status(500).json({
      success: false,
      message: "Gagal mengambil data presensi karyawan",
      error: error.message,
    });
  }
};

/**
 * Create Manual Attendance Entry (Admin)
 */
export const createManualEntry = async (req, res) => {
  try {
    const {
      userId,
      shiftId,
      date,
      clockIn,
      clockOut,
      latitude,
      longitude,
      notes,
    } = req.body;

    console.log("==========================================");
    console.log("✍️ CREATE MANUAL ATTENDANCE ENTRY");
    console.log("User ID:", userId);
    console.log("Shift ID:", shiftId);
    console.log("Date:", date);
    console.log("Admin:", req.user.name);

    // 1. Validate required fields
    if (!userId || !shiftId || !date || !clockIn) {
      return res.status(400).json({
        success: false,
        message: "User, shift, date, dan clock in wajib diisi",
      });
    }

    // 2. Validate user exists and is employee
    const user = await User.findById(userId);
    if (!user || user.role !== "employee") {
      return res.status(404).json({
        success: false,
        message: "Karyawan tidak ditemukan",
      });
    }

    // 3. Validate shift exists
    const shift = await Shift.findById(shiftId);
    if (!shift) {
      return res.status(404).json({
        success: false,
        message: "Shift tidak ditemukan",
      });
    }

    // 4. Parse dates
    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

    const clockInTime = new Date(clockIn);
    const clockOutTime = clockOut ? new Date(clockOut) : null;

    console.log("Attendance Date:", attendanceDate);
    console.log("Clock In:", clockInTime);
    console.log("Clock Out:", clockOutTime);

    // 5. Check if attendance already exists for this date
    const existingAttendance = await Attendance.findOne({
      user: userId,
      date: attendanceDate,
    });

    if (existingAttendance) {
      return res.status(400).json({
        success: false,
        message:
          "Presensi untuk tanggal ini sudah ada. Gunakan update jika ingin mengubah.",
        existingData: existingAttendance,
      });
    }

    // 6. Calculate clock in status
    const [startHour, startMinute] = shift.startTime.split(":").map(Number);
    const scheduleTime = new Date(clockInTime);
    scheduleTime.setHours(startHour, startMinute, 0, 0);

    const toleranceTime = new Date(scheduleTime);
    toleranceTime.setMinutes(
      scheduleTime.getMinutes() + (shift.toleranceMinutes || 0)
    );

    let clockInStatus = "ontime";
    let lateMinutes = 0;

    if (clockInTime > toleranceTime) {
      clockInStatus = "late";
      lateMinutes = Math.floor((clockInTime - scheduleTime) / (1000 * 60));
    }

    // 7. Calculate clock out status and work duration
    let clockOutStatus = "normal";
    let workMinutes = 0;

    if (clockOutTime) {
      const [endHour, endMinute] = shift.endTime.split(":").map(Number);
      const scheduleEndTime = new Date(clockOutTime);
      scheduleEndTime.setHours(endHour, endMinute, 0, 0);

      if (clockOutTime < scheduleEndTime) {
        clockOutStatus = "early";
      }

      workMinutes = Math.floor((clockOutTime - clockInTime) / (1000 * 60));
    }

    // 8. Create location object (if provided)
    const clockInLocation =
      latitude && longitude
        ? {
            type: "Point",
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
          }
        : undefined;

    const clockOutLocation =
      clockOutTime && latitude && longitude
        ? {
            type: "Point",
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
          }
        : undefined;

    // 9. Create manual attendance entry
    const manualEntry = await Attendance.create({
      user: userId,
      shift: shiftId,
      date: attendanceDate,
      clockIn: clockInTime,
      clockOut: clockOutTime,
      clockInLocation,
      clockOutLocation,
      clockInStatus,
      clockOutStatus,
      lateMinutes,
      workMinutes,
      isManualEntry: true, // ✅ Mark as manual entry
      manualEntryNote: notes || "Entri manual oleh admin",
      manualEntryBy: req.user._id, // ✅ Track who created it
      photoUrl:
        "https://nos.wjv-1.neo.id/balkesmas-attendance/photos/manual/placeholder.jpg", // Placeholder
      photoOutUrl: clockOutTime
        ? "https://nos.wjv-1.neo.id/balkesmas-attendance/photos/manual/placeholder.jpg"
        : undefined,
    });

    await manualEntry.populate("user", "name employeeId category");
    await manualEntry.populate("shift", "name startTime endTime");
    await manualEntry.populate("manualEntryBy", "name");

    console.log("✅ Manual entry created successfully");
    console.log("Entry ID:", manualEntry._id);
    console.log("==========================================");

    res.status(201).json({
      success: true,
      message: "Presensi manual berhasil ditambahkan",
      data: manualEntry,
    });
  } catch (error) {
    console.error("❌ Create Manual Entry Error:", error);

    // Handle validation errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Data tidak valid",
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Gagal menambahkan presensi manual",
      error: error.message,
    });
  }
};

/**
 * Update Attendance Manually (Admin)
 */
export const updateAttendanceManually = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      clockIn,
      clockOut,
      clockInStatus,
      clockOutStatus,
      lateMinutes,
      notes,
    } = req.body;

    console.log("==========================================");
    console.log("✏️ UPDATE ATTENDANCE MANUALLY");
    console.log("Attendance ID:", id);
    console.log("Admin:", req.user.name);

    // 1. Find attendance
    const attendance = await Attendance.findById(id)
      .populate("user", "name employeeId")
      .populate("shift", "name startTime endTime");

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Data presensi tidak ditemukan",
      });
    }

    console.log("Current attendance:", {
      user: attendance.user.name,
      date: attendance.date,
      clockIn: attendance.clockIn,
      clockOut: attendance.clockOut,
    });

    // 2. Update fields if provided
    if (clockIn) {
      attendance.clockIn = new Date(clockIn);
      console.log("Updated clock in:", attendance.clockIn);
    }

    if (clockOut) {
      attendance.clockOut = new Date(clockOut);
      console.log("Updated clock out:", attendance.clockOut);
    }

    if (clockInStatus) {
      attendance.clockInStatus = clockInStatus;
    }

    if (clockOutStatus) {
      attendance.clockOutStatus = clockOutStatus;
    }

    if (typeof lateMinutes !== "undefined") {
      attendance.lateMinutes = lateMinutes;
    }

    // 3. Recalculate work duration if both clockIn and clockOut exist
    if (attendance.clockIn && attendance.clockOut) {
      const workDurationMs = attendance.clockOut - attendance.clockIn;
      attendance.workMinutes = Math.floor(workDurationMs / (1000 * 60));
      console.log("Recalculated work minutes:", attendance.workMinutes);
    }

    // 4. Mark as manually edited
    attendance.isManualEntry = true;
    attendance.manualEntryNote =
      notes || attendance.manualEntryNote || "Diubah manual oleh admin";
    attendance.manualEntryBy = req.user._id;

    // 5. Save changes
    await attendance.save();

    console.log("✅ Attendance updated successfully");
    console.log("==========================================");

    res.status(200).json({
      success: true,
      message: "Presensi berhasil diperbarui",
      data: attendance,
    });
  } catch (error) {
    console.error("❌ Update Attendance Manually Error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "ID presensi tidak valid",
      });
    }

    res.status(500).json({
      success: false,
      message: "Gagal memperbarui presensi",
      error: error.message,
    });
  }
};

/**
 * Get All Manual Entries (Admin)
 */
export const getManualEntries = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    console.log("==========================================");
    console.log("📋 GET ALL MANUAL ENTRIES");

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const manualEntries = await Attendance.find({
      isManualEntry: true,
    })
      .populate("user", "name employeeId category")
      .populate({
        path: "user",
        populate: {
          path: "category",
          select: "name prefix",
        },
      })
      .populate("shift", "name startTime endTime")
      .populate("manualEntryBy", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const totalData = await Attendance.countDocuments({
      isManualEntry: true,
    });

    const totalPages = Math.ceil(totalData / parseInt(limit));

    console.log("Found manual entries:", manualEntries.length);
    console.log("==========================================");

    res.status(200).json({
      success: true,
      message: "Data entri manual berhasil diambil",
      data: manualEntries,
      pagination: {
        totalData,
        totalPages,
        currentPage: parseInt(page),
        limit: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
      },
    });
  } catch (error) {
    console.error("❌ Get Manual Entries Error:", error);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil data entri manual",
      error: error.message,
    });
  }
};
