import Attendace from "../models/Attendance.js";
import User from "../models/User.js";
import Shift from "../models/Shift.js";

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
