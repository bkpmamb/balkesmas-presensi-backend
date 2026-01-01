// src/controllers/dashboardController.js

import Attendance from "../models/Attendance.js";
import User from "../models/User.js";
import Shift from "../models/Shift.js";
import ShiftSchedule from "../models/ShiftSchedule.js";

/**
 * Get Overall Dashboard Statistics
 */
export const getDashboardStats = async (req, res) => {
  try {
    console.log("==========================================");
    console.log("📊 GET DASHBOARD STATS");

    // 1. Total Employees
    const totalEmployees = await User.countDocuments({
      role: "employee",
      isActive: true,
    });
    const totalInactiveEmployees = await User.countDocuments({
      role: "employee",
      isActive: false,
    });

    // 2. Total Shifts
    const totalShifts = await Shift.countDocuments();

    // 3. Total Attendances (All Time)
    const totalAttendances = await Attendance.countDocuments();

    // 4. Today's date (WIB)
    const WIB_OFFSET = 7 * 60 * 60 * 1000;
    const nowUTC = new Date();
    const nowWIB = new Date(nowUTC.getTime() + WIB_OFFSET);
    const todayWIB = new Date(nowWIB);
    todayWIB.setHours(0, 0, 0, 0);

    const tomorrowWIB = new Date(todayWIB);
    tomorrowWIB.setDate(tomorrowWIB.getDate() + 1);

    // 5. Today's Attendance Count
    const todayAttendanceCount = await Attendance.countDocuments({
      date: todayWIB,
    });

    // 6. Today's Late Count
    const todayLateCount = await Attendance.countDocuments({
      date: todayWIB,
      clockInStatus: "late",
    });

    // 7. Today's On Time Count
    const todayOnTimeCount = await Attendance.countDocuments({
      date: todayWIB,
      clockInStatus: "ontime",
    });

    // 8. Today's Not Clocked Out Yet
    const todayNotClockedOut = await Attendance.countDocuments({
      date: todayWIB,
      clockOut: null,
    });

    // 9. Today's Scheduled Employees
    const dayOfWeek = nowWIB.getDay();
    const todayScheduledCount = await ShiftSchedule.countDocuments({
      dayOfWeek: dayOfWeek,
      isActive: true,
    });

    // 10. Today's Absent Employees (Scheduled but not clocked in)
    const todayAbsentCount = todayScheduledCount - todayAttendanceCount;

    // 11. This Month Statistics
    const firstDayOfMonth = new Date(
      nowWIB.getFullYear(),
      nowWIB.getMonth(),
      1
    );
    firstDayOfMonth.setHours(0, 0, 0, 0);

    const monthlyAttendances = await Attendance.countDocuments({
      date: { $gte: firstDayOfMonth },
    });

    const monthlyLate = await Attendance.countDocuments({
      date: { $gte: firstDayOfMonth },
      clockInStatus: "late",
    });

    const monthlyOnTime = await Attendance.countDocuments({
      date: { $gte: firstDayOfMonth },
      clockInStatus: "ontime",
    });

    // 12. Average Work Hours (This Month)
    const monthlyAttendancesData = await Attendance.find({
      date: { $gte: firstDayOfMonth },
      workMinutes: { $gt: 0 },
    }).select("workMinutes");

    const avgWorkMinutes =
      monthlyAttendancesData.length > 0
        ? Math.round(
            monthlyAttendancesData.reduce((sum, a) => sum + a.workMinutes, 0) /
              monthlyAttendancesData.length
          )
        : 0;

    const avgWorkHours = (avgWorkMinutes / 60).toFixed(1);

    // 13. Employees by Category
    const employeesByCategory = await User.aggregate([
      { $match: { role: "employee", isActive: true } },
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "categoryData",
        },
      },
      { $unwind: "$categoryData" },
      {
        $group: {
          _id: "$categoryData.name",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    console.log("Stats calculated successfully");
    console.log("==========================================");

    res.status(200).json({
      success: true,
      message: "Statistik dashboard berhasil diambil",
      data: {
        employees: {
          total: totalEmployees,
          active: totalEmployees,
          inactive: totalInactiveEmployees,
          byCategory: employeesByCategory,
        },
        shifts: {
          total: totalShifts,
        },
        attendances: {
          allTime: totalAttendances,
          thisMonth: monthlyAttendances,
          today: todayAttendanceCount,
        },
        today: {
          date: todayWIB,
          scheduled: todayScheduledCount,
          present: todayAttendanceCount,
          absent: todayAbsentCount,
          onTime: todayOnTimeCount,
          late: todayLateCount,
          notClockedOut: todayNotClockedOut,
          attendanceRate:
            todayScheduledCount > 0
              ? Math.round((todayAttendanceCount / todayScheduledCount) * 100)
              : 0,
        },
        thisMonth: {
          totalAttendances: monthlyAttendances,
          onTime: monthlyOnTime,
          late: monthlyLate,
          averageWorkHours: parseFloat(avgWorkHours),
          punctualityRate:
            monthlyAttendances > 0
              ? Math.round((monthlyOnTime / monthlyAttendances) * 100)
              : 0,
        },
      },
    });
  } catch (error) {
    console.error("❌ Get Dashboard Stats Error:", error);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil statistik dashboard",
      error: error.message,
    });
  }
};

/**
 * Get Today's Detailed Summary
 */
export const getTodaySummary = async (req, res) => {
  try {
    console.log("==========================================");
    console.log("📅 GET TODAY'S SUMMARY");

    // Get today's date (WIB)
    const WIB_OFFSET = 7 * 60 * 60 * 1000;
    const nowUTC = new Date();
    const nowWIB = new Date(nowUTC.getTime() + WIB_OFFSET);
    const todayWIB = new Date(nowWIB);
    todayWIB.setHours(0, 0, 0, 0);

    const dayOfWeek = nowWIB.getDay();
    const dayNames = [
      "Minggu",
      "Senin",
      "Selasa",
      "Rabu",
      "Kamis",
      "Jumat",
      "Sabtu",
    ];

    // 1. Today's Attendances
    const todayAttendances = await Attendance.find({
      date: todayWIB,
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
      .sort({ clockIn: -1 })
      .lean();

    // 2. Scheduled Employees Today
    const scheduledToday = await ShiftSchedule.find({
      dayOfWeek: dayOfWeek,
      isActive: true,
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
      .lean();

    // 3. Find Absent Employees (Scheduled but not clocked in)
    const attendedUserIds = todayAttendances.map((a) => a.user._id.toString());
    const absentEmployees = scheduledToday.filter(
      (schedule) => !attendedUserIds.includes(schedule.user._id.toString())
    );

    // 4. Late Employees Today
    const lateToday = todayAttendances.filter(
      (a) => a.clockInStatus === "late"
    );

    // 5. On Time Employees Today
    const onTimeToday = todayAttendances.filter(
      (a) => a.clockInStatus === "ontime"
    );

    // 6. Not Clocked Out Yet
    const notClockedOut = todayAttendances.filter((a) => !a.clockOut);

    // 7. Early Clock Out
    const earlyClockOut = todayAttendances.filter(
      (a) => a.clockOutStatus === "early"
    );

    console.log("Today's summary calculated");
    console.log("==========================================");

    res.status(200).json({
      success: true,
      message: "Ringkasan hari ini berhasil diambil",
      data: {
        date: todayWIB,
        dayName: dayNames[dayOfWeek],
        summary: {
          scheduled: scheduledToday.length,
          present: todayAttendances.length,
          absent: absentEmployees.length,
          onTime: onTimeToday.length,
          late: lateToday.length,
          notClockedOut: notClockedOut.length,
          earlyClockOut: earlyClockOut.length,
        },
        attendances: todayAttendances,
        absentEmployees: absentEmployees.map((s) => ({
          user: s.user,
          shift: s.shift,
        })),
        lateEmployees: lateToday.map((a) => ({
          user: a.user,
          shift: a.shift,
          clockIn: a.clockIn,
          lateMinutes: a.lateMinutes,
        })),
        earlyClockOutEmployees: earlyClockOut.map((a) => ({
          user: a.user,
          shift: a.shift,
          clockOut: a.clockOut,
          clockOutStatus: a.clockOutStatus,
        })),
      },
    });
  } catch (error) {
    console.error("❌ Get Today Summary Error:", error);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil ringkasan hari ini",
      error: error.message,
    });
  }
};

/**
 * Get Monthly Statistics
 */
export const getMonthlyStats = async (req, res) => {
  try {
    const { year, month } = req.query;

    console.log("==========================================");
    console.log("📈 GET MONTHLY STATS");
    console.log("Year:", year);
    console.log("Month:", month);

    // Default to current month if not provided
    const WIB_OFFSET = 7 * 60 * 60 * 1000;
    const nowUTC = new Date();
    const nowWIB = new Date(nowUTC.getTime() + WIB_OFFSET);

    const targetYear = year ? parseInt(year) : nowWIB.getFullYear();
    const targetMonth = month ? parseInt(month) - 1 : nowWIB.getMonth(); // 0-indexed

    // First and last day of the month
    const firstDay = new Date(targetYear, targetMonth, 1);
    firstDay.setHours(0, 0, 0, 0);

    const lastDay = new Date(targetYear, targetMonth + 1, 0);
    lastDay.setHours(23, 59, 59, 999);

    console.log("Date range:", firstDay, "to", lastDay);

    // 1. Total Attendances This Month
    const monthlyAttendances = await Attendance.find({
      date: { $gte: firstDay, $lte: lastDay },
    })
      .populate("user", "name employeeId")
      .populate("shift", "name")
      .lean();

    // 2. Statistics
    const totalAttendances = monthlyAttendances.length;
    const totalOnTime = monthlyAttendances.filter(
      (a) => a.clockInStatus === "ontime"
    ).length;
    const totalLate = monthlyAttendances.filter(
      (a) => a.clockInStatus === "late"
    ).length;
    const totalLateMinutes = monthlyAttendances.reduce(
      (sum, a) => sum + (a.lateMinutes || 0),
      0
    );
    const totalWorkMinutes = monthlyAttendances.reduce(
      (sum, a) => sum + (a.workMinutes || 0),
      0
    );

    // 3. Daily Breakdown
    const dailyStats = {};
    const daysInMonth = lastDay.getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(targetYear, targetMonth, day);
      date.setHours(0, 0, 0, 0);

      const dayAttendances = monthlyAttendances.filter(
        (a) => new Date(a.date).getDate() === day
      );

      dailyStats[day] = {
        date: date,
        total: dayAttendances.length,
        onTime: dayAttendances.filter((a) => a.clockInStatus === "ontime")
          .length,
        late: dayAttendances.filter((a) => a.clockInStatus === "late").length,
      };
    }

    // 4. Top Performers (Most On Time)
    const userStats = {};
    monthlyAttendances.forEach((a) => {
      const userId = a.user._id.toString();
      if (!userStats[userId]) {
        userStats[userId] = {
          user: a.user,
          total: 0,
          onTime: 0,
          late: 0,
          totalLateMinutes: 0,
        };
      }
      userStats[userId].total++;
      if (a.clockInStatus === "ontime") userStats[userId].onTime++;
      if (a.clockInStatus === "late") {
        userStats[userId].late++;
        userStats[userId].totalLateMinutes += a.lateMinutes || 0;
      }
    });

    const topPerformers = Object.values(userStats)
      .sort((a, b) => b.onTime - a.onTime)
      .slice(0, 10);

    const mostLate = Object.values(userStats)
      .sort((a, b) => b.late - a.late)
      .slice(0, 10);

    console.log("Monthly stats calculated");
    console.log("==========================================");

    res.status(200).json({
      success: true,
      message: "Statistik bulanan berhasil diambil",
      data: {
        period: {
          year: targetYear,
          month: targetMonth + 1,
          monthName: new Date(targetYear, targetMonth).toLocaleString("id-ID", {
            month: "long",
          }),
          startDate: firstDay,
          endDate: lastDay,
        },
        summary: {
          totalAttendances,
          totalOnTime,
          totalLate,
          totalLateMinutes,
          averageLateMinutes:
            totalLate > 0 ? Math.round(totalLateMinutes / totalLate) : 0,
          totalWorkHours: Math.round((totalWorkMinutes / 60) * 10) / 10,
          averageWorkHours:
            totalAttendances > 0
              ? Math.round((totalWorkMinutes / totalAttendances / 60) * 10) / 10
              : 0,
          punctualityRate:
            totalAttendances > 0
              ? Math.round((totalOnTime / totalAttendances) * 100)
              : 0,
        },
        dailyBreakdown: Object.values(dailyStats),
        topPerformers,
        mostLate,
      },
    });
  } catch (error) {
    console.error("❌ Get Monthly Stats Error:", error);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil statistik bulanan",
      error: error.message,
    });
  }
};
