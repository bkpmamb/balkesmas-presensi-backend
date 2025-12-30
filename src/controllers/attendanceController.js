// src/controllers/attendanceController.js

import Attendance from "../models/Attendance.js";
import Shift from "../models/Shift.js";
import ShiftSchedule from "../models/ShiftSchedule.js";
import Settings from "../models/Settings.js";
import { uploadToS3 } from "../utils/s3Upload.js";

// ✅ Helper: Validate GPS location
const validateLocation = async (userLat, userLon) => {
  // Ambil settings dari database (bukan hardcode)
  const settings = await Settings.getActiveSettings();

  // Haversine formula untuk hitung jarak
  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // meter
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const distance = getDistance(
    userLat,
    userLon,
    settings.targetLatitude,
    settings.targetLongitude
  );

  return {
    isWithinRange: distance <= settings.radiusMeters,
    distance: Math.round(distance),
    radiusLimit: settings.radiusMeters,
  };
};

export const clockIn = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const file = req.file;

    if (!latitude || !longitude || !file) {
      return res.status(400).json({
        success: false,
        message: "Lokasi dan foto wajib diisi",
      });
    }

    // ✅ GUNAKAN WIB TIME (UTC+7)
    const WIB_OFFSET = 7 * 60 * 60 * 1000;
    const nowUTC = new Date();
    const nowWIB = new Date(nowUTC.getTime() + WIB_OFFSET);

    const dayOfWeek = nowWIB.getDay(); // Day berdasarkan WIB
    const dayNames = [
      "Minggu",
      "Senin",
      "Selasa",
      "Rabu",
      "Kamis",
      "Jumat",
      "Sabtu",
    ];

    console.log("==========================================");
    console.log("🔍 CLOCK IN DEBUG");
    console.log("UTC Time:", nowUTC.toISOString());
    console.log("WIB Time:", nowWIB.toISOString());
    console.log(
      "WIB Local:",
      nowWIB.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })
    );
    console.log("User:", req.user.name);
    console.log("Day:", dayNames[dayOfWeek]);
    console.log("==========================================");

    const geoValidation = await validateLocation(
      parseFloat(latitude),
      parseFloat(longitude)
    );

    if (!geoValidation.isWithinRange) {
      return res.status(403).json({
        success: false,
        message: `${req.user.name}, Anda berada di luar area kantor (${geoValidation.distance}m dari kantor, batas ${geoValidation.radiusLimit}m)`,
      });
    }

    // ✅ Gunakan WIB untuk cek sudah clock in atau belum
    const todayWIB = new Date(nowWIB);
    todayWIB.setHours(0, 0, 0, 0);

    const alreadyClockIn = await Attendance.findOne({
      user: req.user._id,
      date: todayWIB, // Cek berdasarkan date field
    });

    if (alreadyClockIn) {
      return res.status(400).json({
        success: false,
        message: `${req.user.name}, Anda sudah melakukan presensi masuk hari ini`,
        data: {
          clockIn: alreadyClockIn.clockIn,
          shift: alreadyClockIn.shift,
        },
      });
    }

    const schedule = await ShiftSchedule.findOne({
      user: req.user._id,
      dayOfWeek: dayOfWeek,
      isActive: true,
    }).populate("shift");

    if (!schedule || !schedule.shift) {
      return res.status(404).json({
        success: false,
        message: `${req.user.name}, Anda tidak memiliki jadwal shift untuk hari ini (${dayNames[dayOfWeek]}). Hubungi admin untuk mengatur jadwal.`,
      });
    }

    const assignedShift = schedule.shift;

    // ✅ Hitung late berdasarkan WIB time
    const [startHour, startMinute] = assignedShift.startTime
      .split(":")
      .map(Number);

    // Schedule time dalam WIB
    const scheduleTimeWIB = new Date(nowWIB);
    scheduleTimeWIB.setHours(startHour, startMinute, 0, 0);

    // Tambahkan toleransi
    const toleranceTimeWIB = new Date(scheduleTimeWIB);
    toleranceTimeWIB.setMinutes(
      scheduleTimeWIB.getMinutes() + (assignedShift.toleranceMinutes || 0)
    );

    let clockInStatus = "ontime";
    let lateMinutes = 0;

    console.log("Schedule Time (WIB):", scheduleTimeWIB.toISOString());
    console.log("Tolerance Time (WIB):", toleranceTimeWIB.toISOString());
    console.log("Clock In Time (WIB):", nowWIB.toISOString());

    if (nowWIB > toleranceTimeWIB) {
      clockInStatus = "late";
      lateMinutes = Math.floor((nowWIB - scheduleTimeWIB) / (1000 * 60));
      console.log("⚠️ LATE by", lateMinutes, "minutes");
    } else {
      console.log("✅ ON TIME");
    }

    const photoUrl = await uploadToS3(file);

    // ✅ Simpan date dalam WIB (00:00:00)
    const dateOnlyWIB = new Date(nowWIB);
    dateOnlyWIB.setHours(0, 0, 0, 0);

    const newAttendance = await Attendance.create({
      user: req.user._id,
      shift: assignedShift._id,
      date: dateOnlyWIB, // Date dalam WIB
      clockIn: nowUTC, // Simpan waktu asli UTC untuk consistency
      clockInLocation: {
        type: "Point",
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
      },
      photoUrl,
      clockInStatus,
      lateMinutes,
    });

    await newAttendance.populate("shift", "name startTime endTime");

    console.log("✅ CLOCK IN SUCCESS!");
    console.log("Status:", clockInStatus);
    console.log("Late Minutes:", lateMinutes);
    console.log("==========================================");

    res.status(201).json({
      success: true,
      message:
        clockInStatus === "ontime"
          ? `${req.user.name}, presensi masuk berhasil (tepat waktu)`
          : `${req.user.name}, presensi masuk berhasil (terlambat ${lateMinutes} menit)`,
      data: {
        _id: newAttendance._id,
        clockIn: newAttendance.clockIn,
        clockInStatus: newAttendance.clockInStatus,
        lateMinutes: newAttendance.lateMinutes,
        shift: newAttendance.shift,
        location: {
          distance: geoValidation.distance,
          isValid: true,
        },
      },
    });
  } catch (error) {
    console.error("❌ CLOCK IN ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Gagal melakukan presensi masuk",
      error: error.message,
    });
  }
};

export const clockOut = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const file = req.file;

    // 1. Validasi input
    if (!latitude || !longitude || !file) {
      return res.status(400).json({
        success: false,
        message: "Lokasi dan foto pulang wajib diisi",
      });
    }

    // ✅ GUNAKAN WIB TIME (UTC+7)
    const WIB_OFFSET = 7 * 60 * 60 * 1000;
    const nowUTC = new Date();
    const nowWIB = new Date(nowUTC.getTime() + WIB_OFFSET);

    console.log("==========================================");
    console.log("🔍 CLOCK OUT DEBUG");
    console.log("UTC Time:", nowUTC.toISOString());
    console.log("WIB Time:", nowWIB.toISOString());
    console.log("User:", req.user.name);
    console.log("==========================================");

    // 2. Validasi GPS
    const geoValidation = await validateLocation(
      parseFloat(latitude),
      parseFloat(longitude)
    );

    if (!geoValidation.isWithinRange) {
      return res.status(403).json({
        success: false,
        message: `${req.user.name}, Anda berada di luar area kantor (${geoValidation.distance}m dari kantor, batas ${geoValidation.radiusLimit}m)`,
      });
    }

    // 3. Cari attendance hari ini yang belum clock out
    // ✅ Gunakan WIB date untuk query
    const todayWIB = new Date(nowWIB);
    todayWIB.setHours(0, 0, 0, 0);

    const attendance = await Attendance.findOne({
      user: req.user._id,
      date: todayWIB, // Query by date field (lebih reliable)
      clockOut: null,
    }).populate("shift");

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: `${req.user.name}, data presensi masuk tidak ditemukan atau Anda sudah presensi pulang`,
      });
    }

    console.log("Attendance found:", attendance._id);
    console.log("Clock In:", attendance.clockIn);

    // 4. Upload foto pulang
    const photoOutUrl = await uploadToS3(file);

    // 5. Hitung status clock out berdasarkan WIB
    const shift = attendance.shift;

    // Parse end time dari shift (dalam WIB)
    const [endHour, endMinute] = shift.endTime.split(":").map(Number);
    const scheduleEndTimeWIB = new Date(nowWIB);
    scheduleEndTimeWIB.setHours(endHour, endMinute, 0, 0);

    let clockOutStatus = "normal";
    let earlyMinutes = 0;

    console.log("Schedule End Time (WIB):", scheduleEndTimeWIB.toISOString());
    console.log("Clock Out Time (WIB):", nowWIB.toISOString());

    // Jika pulang sebelum jam seharusnya
    if (nowWIB < scheduleEndTimeWIB) {
      clockOutStatus = "early";
      earlyMinutes = Math.floor((scheduleEndTimeWIB - nowWIB) / (1000 * 60));
      console.log("⚠️ EARLY by", earlyMinutes, "minutes");
    } else {
      console.log("✅ NORMAL (on time or late)");
    }

    // 6. Hitung durasi kerja (dari clockIn sampai sekarang)
    const workDurationMs = nowUTC - attendance.clockIn;
    const workMinutes = Math.floor(workDurationMs / (1000 * 60));
    const workHours = Math.floor(workMinutes / 60);
    const remainingMinutes = workMinutes % 60;

    console.log("Work Duration:", workHours, "hours", remainingMinutes, "minutes");

    // 7. Update attendance
    attendance.clockOut = nowUTC; // Simpan UTC untuk consistency
    attendance.photoOutUrl = photoOutUrl;
    attendance.clockOutLocation = {
      type: "Point",
      coordinates: [parseFloat(longitude), parseFloat(latitude)],
    };
    attendance.clockOutStatus = clockOutStatus;
    attendance.workMinutes = workMinutes;

    await attendance.save();

    console.log("✅ CLOCK OUT SUCCESS!");
    console.log("Status:", clockOutStatus);
    console.log("Early Minutes:", earlyMinutes);
    console.log("Work Minutes:", workMinutes);
    console.log("==========================================");

    // 8. Response
    res.status(200).json({
      success: true,
      message:
        clockOutStatus === "early"
          ? `${req.user.name}, presensi pulang berhasil (pulang lebih awal ${earlyMinutes} menit)`
          : `${req.user.name}, presensi pulang berhasil`,
      data: {
        _id: attendance._id,
        clockIn: attendance.clockIn,
        clockOut: attendance.clockOut,
        clockInStatus: attendance.clockInStatus,
        clockOutStatus: attendance.clockOutStatus,
        lateMinutes: attendance.lateMinutes,
        earlyMinutes: clockOutStatus === "early" ? earlyMinutes : 0,
        workDuration: `${workHours} jam ${remainingMinutes} menit`,
        workMinutes: workMinutes,
        shift: {
          name: shift.name,
          startTime: shift.startTime,
          endTime: shift.endTime,
        },
        location: {
          distance: geoValidation.distance,
          isValid: true,
        },
      },
    });
  } catch (error) {
    console.error("❌ CLOCK OUT ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Gagal melakukan presensi pulang",
      error: error.message,
    });
  }
};

export const getAttendanceHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const history = await Attendance.find({ user: req.user._id })
      .sort({ clockIn: -1 })
      .populate("shift", "name startTime endTime")
      .skip(skip)
      .limit(limit);

    const totalRecords = await Attendance.countDocuments({
      user: req.user._id,
    });
    const totalPages = Math.ceil(totalRecords / limit);

    const summary = {
      totalHadir: totalRecords,
      totalTerlambat: await Attendance.countDocuments({
        user: req.user._id,
        clockInStatus: "late",
      }),
      totalPulangAwal: await Attendance.countDocuments({
        user: req.user._id,
        clockOutStatus: "early",
      }),
      totalMenitKerja: history.reduce(
        (acc, item) => acc + (item.workMinutes || 0),
        0
      ),
    };

    res.status(200).json({
      success: true,
      message: "Riwayat presensi berhasil diambil",
      summary,
      data: history,
      pagination: {
        totalData: totalRecords,
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
      message: "Gagal mengambil riwayat presensi",
      error: error.message,
    });
  }
};

export const getTodayAttendance = async (req, res) => {
  try {
    const timeZone = "Asia/Jakarta";

    const now = new Date();
    const jakartaTime = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).format(now);

    const start = new Date(jakartaTime);
    start.setHours(0, 0, 0, 0);

    const end = new Date(jakartaTime);
    end.setHours(23, 59, 59, 999);

    const todayAttendance = await Attendance.findOne({
      user: req.user._id,
      clockIn: {
        $gte: start,
        $lte: end,
      },
    })
      .populate("shift", "name startTime endTime")
      .sort({ clockIn: -1 });

    res.status(200).json({
      success: true,
      data: todayAttendance,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Gagal mengambil data presensi hari ini",
      error: error.message,
    });
  }
};
