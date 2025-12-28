import Attendance from "../models/Attendance.js";
import Shift from "../models/Shift.js";
import { uploadToS3 } from "../utils/s3Upload.js";
import { validateDistance } from "../utils/geoUtils.js";

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

    if (!availableShifts || availableShifts.length === 0) {
      return res
        .status(404)
        .json({ message: "Data shift untuk kategori Anda tidak ditemukan." });
    }

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
    const now = new Date();
    const jakartaTime = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).format(now);

    // 2. Tentukan awal dan akhir hari (00:00:00 sampai 23:59:59)
    const start = new Date(jakartaTime);
    start.setHours(0, 0, 0, 0);

    const end = new Date(jakartaTime);
    end.setHours(23, 59, 59, 999);

    // 3. Query ke MongoDB
    // Tambahkan filter 'user: req.user._id' agar hanya mengambil data milik user ybs
    const todayAttendance = await Attendance.findOne({
      user: req.user._id, // Filter berdasarkan user yang login
      clockIn: {
        $gte: start,
        $lte: end,
      },
    })
      .populate("shift", "name startTime endTime")
      .sort({ clockIn: -1 });

    res.status(200).json({
      success: true,
      data: todayAttendance, // Menggunakan findOne karena 1 user biasanya 1 absen per hari
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Gagal mengambil data presensi hari ini",
      error: error.message,
    });
  }
};
