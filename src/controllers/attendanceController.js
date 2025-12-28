import Attendance from "../models/Attendance.js";
import Shift from "../models/Shift.js";
import { uploadToS3 } from "../utils/s3Upload.js";
import { startOfDay, endOfDay } from "date-fns";
import { validateDistance } from "../utils/geoUtils.js";

const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
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

export const clockIn = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const file = req.file;

    if (!latitude || !longitude || !file) {
      return res.status(400).json({ message: "Lokasi dan foto wajib diisi" });
    }

    const geo = validateDistance(parseFloat(latitude), parseFloat(longitude));

    if (!geo.isWithinRange) {
      return res.status(403).json({
        success: false,
        message: `Akses ditolak. Anda berada ${geo.distance}m dari kantor (Batas 100m).`,
      });
    }

    // 2. Cari Shift yang Sesuai
    const now = new Date();
    const currentHour = now.getHours();

    // Cari semua shift berdasarkan kategori user (Staff/Satpam/Apoteker)
    const availableShifts = await Shift.find({ category: req.user.category });

    // Logika sederhana: cari shift yang jam mulainya paling dekat dengan jam sekarang
    let assignedShift = availableShifts[0];
    let minDiff = 24;

    availableShifts.forEach((shift) => {
      const shiftStartHour = parseInt(shift.startTime.split(":")[0]);
      const diff = Math.abs(currentHour - shiftStartHour);
      if (diff < minDiff) {
        minDiff = diff;
        assignedShift = shift;
      }
    });

    // 3. Hitung Keterlambatan
    const [startHour, startMinute] = assignedShift.startTime
      .split(":")
      .map(Number);
    const scheduleTime = new Date(now);
    scheduleTime.setHours(startHour, startMinute, 0, 0);

    let status = "ontime";
    let lateMinutes = 0;

    if (now > scheduleTime) {
      status = "late";
      lateMinutes = Math.floor((now - scheduleTime) / (1000 * 60));
    }

    // 4. Upload Foto ke Biznet GIO
    const photoUrl = await uploadToS3(file);

    // 5. Simpan ke MongoDB
    const newAttendance = await Attendance.create({
      user: req.user._id,
      shift: assignedShift._id, // Menyimpan ID shift yang digunakan
      clockIn: now,
      location: {
        type: "Point",
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
      },
      photoUrl,
      status,
      lateMinutes,
    });

    res.status(201).json({
      message: `Presensi berhasil (${status})`,
      shiftDetected: assignedShift.name,
      data: newAttendance,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const clockOut = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const file = req.file; // Menangkap file foto pulang

    // Validasi lokasi dan foto
    if (!latitude || !longitude || !file) {
      return res
        .status(400)
        .json({ message: "Lokasi dan foto pulang wajib diisi" });
    }

    const geo = validateDistance(parseFloat(latitude), parseFloat(longitude));

    if (!geo.isWithinRange) {
      return res.status(403).json({
        success: false,
        message: `Akses ditolak. Anda berada ${geo.distance}m dari kantor (Batas 100m).`,
      });
    }

    // 2. Cari data absen hari ini yang belum clockOut
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await Attendance.findOne({
      user: req.user._id,
      clockIn: { $gte: today },
      clockOut: null,
    });

    if (!attendance) {
      return res.status(404).json({
        message: "Data masuk tidak ditemukan atau Anda sudah absen pulang",
      });
    }

    // 3. Upload Foto Pulang ke Biznet GIO
    const photoOutUrl = await uploadToS3(file);

    // 4. Update Data Absensi
    const now = new Date();
    attendance.clockOut = now;
    attendance.photoOutUrl = photoOutUrl; // Pastikan field ini ada di Model Attendance Anda

    const diffMs = attendance.clockOut - attendance.clockIn;
    attendance.workMinutes = Math.floor(diffMs / (1000 * 60));

    await attendance.save();

    res.status(200).json({
      message: "Presensi pulang berhasil dengan foto",
      duration: `${Math.floor(attendance.workMinutes / 60)} jam ${
        attendance.workMinutes % 60
      } menit`,
      photoOut: photoOutUrl,
      data: attendance,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAttendanceHistory = async (req, res) => {
  try {
    // Mencari data absen milik user yang sedang login
    // Diurutkan dari yang paling baru (descending)
    const history = await Attendance.find({ user: req.user._id })
      .sort({ clockIn: -1 })
      .populate("shift", "name startTime endTime");

    // Menghitung ringkasan (optional tapi sangat berguna)
    const summary = {
      totalHadir: history.length,
      totalTerlambat: history.filter((item) => item.status === "late").length,
      totalMenitKerja: history.reduce(
        (acc, item) => acc + (item.workMinutes || 0),
        0
      ),
    };

    res.status(200).json({
      message: "Riwayat presensi berhasil diambil",
      summary,
      data: history,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getTodayAttendance = async (req, res) => {
  try {
    const timeZone = "Asia/Jakarta";

    // 1. Dapatkan waktu sekarang di Jakarta
    const nowInJakarta = new Date(
      new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date())
    );

    // 2. Tentukan awal dan akhir hari berdasarkan waktu Jakarta
    const start = startOfDay(nowInJakarta);
    const end = endOfDay(nowInJakarta);

    // 3. Query ke MongoDB
    const todayAttendance = await Attendance.find({
      checkIn: {
        $gte: start,
        $lte: end,
      },
    })
      .populate("user", "name employeeId category") // Opsional: jika ingin ambil detail user dari collection users
      .sort({ checkIn: -1 });

    res.status(200).json({
      success: true,
      data: todayAttendance,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Gagal mengambil data presensi",
      error: error.message,
    });
  }
};
