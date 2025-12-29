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

// ✅ NEW: Clock In dengan ShiftSchedule
export const clockIn = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const file = req.file;

    // 1. Validasi input
    if (!latitude || !longitude || !file) {
      return res.status(400).json({
        success: false,
        message: "Lokasi dan foto wajib diisi",
      });
    }

    // 2. Validasi GPS
    const geoValidation = await validateLocation(
      parseFloat(latitude),
      parseFloat(longitude)
    );

    if (!geoValidation.isWithinRange) {
      return res.status(403).json({
        success: false,
        message: `Anda berada di luar area kantor (${geoValidation.distance}m dari kantor, batas ${geoValidation.radiusLimit}m)`,
      });
    }

    // 3. Cek apakah sudah presensi hari ini
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const alreadyClockIn = await Attendance.findOne({
      user: req.user._id,
      clockIn: { $gte: today },
    });

    if (alreadyClockIn) {
      return res.status(400).json({
        success: false,
        message: "Anda sudah melakukan presensi masuk hari ini",
        data: {
          clockIn: alreadyClockIn.clockIn,
          shift: alreadyClockIn.shift,
        },
      });
    }

    // 4. Cari ShiftSchedule user untuk hari ini
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Minggu, 1 = Senin, dst

    const schedule = await ShiftSchedule.findOne({
      user: req.user._id,
      dayOfWeek: dayOfWeek,
      isActive: true,
    }).populate("shift");

    if (!schedule || !schedule.shift) {
      return res.status(404).json({
        success: false,
        message: `Anda tidak memiliki jadwal shift untuk hari ini. Hubungi admin untuk mengatur jadwal.`,
      });
    }

    const assignedShift = schedule.shift;

    // 5. Hitung status keterlambatan dengan toleransi
    const [startHour, startMinute] = assignedShift.startTime
      .split(":")
      .map(Number);
    const scheduleTime = new Date(now);
    scheduleTime.setHours(startHour, startMinute, 0, 0);

    // Tambahkan toleransi
    const toleranceTime = new Date(scheduleTime);
    toleranceTime.setMinutes(
      scheduleTime.getMinutes() + (assignedShift.toleranceMinutes || 0)
    );

    let clockInStatus = "ontime";
    let lateMinutes = 0;

    if (now > toleranceTime) {
      clockInStatus = "late";
      lateMinutes = Math.floor((now - scheduleTime) / (1000 * 60)); // Total menit terlambat dari jam seharusnya (tanpa toleransi)
    }

    // 6. Upload foto ke S3
    const photoUrl = await uploadToS3(file);

    // 7. Simpan ke database
    const dateOnly = new Date(now);
    dateOnly.setHours(0, 0, 0, 0);

    const newAttendance = await Attendance.create({
      user: req.user._id,
      shift: assignedShift._id,
      date: dateOnly,
      clockIn: now,
      clockInLocation: {
        type: "Point",
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
      },
      photoUrl,
      clockInStatus,
      lateMinutes,
    });

    // Populate untuk response
    await newAttendance.populate("shift", "name startTime endTime");

    res.status(201).json({
      success: true,
      message:
        clockInStatus === "ontime"
          ? "Presensi masuk berhasil (tepat waktu)"
          : `Presensi masuk berhasil (terlambat ${lateMinutes} menit)`,
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
    console.error("Clock In Error:", error);
    res.status(500).json({
      success: false,
      message: "Gagal melakukan presensi masuk",
      error: error.message,
    });
  }
};

// ✅ Clock Out (belum diupdate, nanti di step berikutnya)
export const clockOut = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const file = req.file;

    if (!latitude || !longitude || !file) {
      return res.status(400).json({
        success: false,
        message: "Lokasi dan foto pulang wajib diisi",
      });
    }

    const geoValidation = await validateLocation(
      parseFloat(latitude),
      parseFloat(longitude)
    );

    if (!geoValidation.isWithinRange) {
      return res.status(403).json({
        success: false,
        message: `Anda berada di luar area kantor (${geoValidation.distance}m dari kantor)`,
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await Attendance.findOne({
      user: req.user._id,
      clockIn: { $gte: today },
      clockOut: null,
    });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message:
          "Data presensi masuk tidak ditemukan atau Anda sudah presensi pulang",
      });
    }

    const photoOutUrl = await uploadToS3(file);

    const now = new Date();
    attendance.clockOut = now;
    attendance.photoOutUrl = photoOutUrl;
    attendance.clockOutLocation = {
      type: "Point",
      coordinates: [parseFloat(longitude), parseFloat(latitude)],
    };

    const diffMs = attendance.clockOut - attendance.clockIn;
    attendance.workMinutes = Math.floor(diffMs / (1000 * 60));

    await attendance.save();

    res.status(200).json({
      success: true,
      message: "Presensi pulang berhasil",
      data: {
        _id: attendance._id,
        clockIn: attendance.clockIn,
        clockOut: attendance.clockOut,
        workDuration: `${Math.floor(attendance.workMinutes / 60)} jam ${
          attendance.workMinutes % 60
        } menit`,
        photoOut: photoOutUrl,
      },
    });
  } catch (error) {
    console.error("Clock Out Error:", error);
    res.status(500).json({
      success: false,
      message: "Gagal melakukan presensi pulang",
      error: error.message,
    });
  }
};

export const getAttendanceHistory = async (req, res) => {
  try {
    const history = await Attendance.find({ user: req.user._id })
      .sort({ clockIn: -1 })
      .populate("shift", "name startTime endTime");

    const summary = {
      totalHadir: history.length,
      totalTerlambat: history.filter((item) => item.clockInStatus === "late")
        .length,
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
