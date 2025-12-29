// src/controllers/adminController.js

import Attendance from "../models/Attendance.js";
import User from "../models/User.js";
import Category from "../models/Category.js";
import bcrypt from "bcryptjs";
import { json2csv } from "json-2-csv";

export const getAllAttendance = async (req, res) => {
  try {
    // Ambil parameter query, default: halaman 1, limit 10 data
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // 1. Ambil data dengan pagination
    const data = await Attendance.find()
      .populate("user", "name employeeId category")
      .populate("shift", "name")
      .sort({ clockIn: -1 }) // Terbaru di atas
      .skip(skip)
      .limit(limit);

    // 2. Hitung total record untuk info di frontend
    const totalAttendance = await Attendance.countDocuments();
    const totalPages = Math.ceil(totalAttendance / limit);

    res.status(200).json({
      message: "Seluruh riwayat absensi berhasil diambil",
      data: data,
      pagination: {
        totalData: totalAttendance,
        totalPages: totalPages,
        currentPage: page,
        limit: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAdminStats = async (req, res) => {
  try {
    // 1. Hitung Total Karyawan
    const totalKaryawan = await User.countDocuments({ role: "employee" });

    // 2. Setup Rentang Waktu Hari Ini (WIB/Lokal)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // 3. Hitung Hadir Hari Ini
    const hadirHariIni = await Attendance.countDocuments({
      clockIn: { $gte: startOfDay, $lte: endOfDay },
    });

    // 4. Hitung Terlambat Hari Ini
    const terlambatHariIni = await Attendance.countDocuments({
      clockIn: { $gte: startOfDay, $lte: endOfDay },
      status: "Terlambat", // Pastikan string "Terlambat" sesuai dengan di DB Anda
    });

    // 5. Hitung Persentase Kehadiran
    const persentase =
      totalKaryawan > 0
        ? `${((hadirHariIni / totalKaryawan) * 100).toFixed(2)}%`
        : "0.00%";

    // 6. Kirim Response (Dibungkus properti 'data' agar sinkron dengan Frontend)
    res.status(200).json({
      success: true,
      data: {
        totalKaryawan,
        hadirHariIni,
        terlambatHariIni,
        persentaseKehadiran: persentase,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getAllEmployees = async (req, res) => {
  try {
    // Ambil parameter dari query string, berikan nilai default jika tidak ada
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";

    // Hitung berapa data yang harus dilewati
    const skip = (page - 1) * limit;

    // Filter pencarian berdasarkan nama (opsional tapi sangat berguna)
    const searchFilter = {
      role: "employee",
      name: { $regex: search, $options: "i" },
    };

    // 1. Ambil data dengan limit dan skip
    const employees = await User.find(searchFilter)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // 2. Hitung total data untuk keperluan info halaman di frontend
    const totalEmployees = await User.countDocuments(searchFilter);
    const totalPages = Math.ceil(totalEmployees / limit);

    res.status(200).json({
      message: "Daftar karyawan berhasil diambil",
      data: employees,
      pagination: {
        totalData: totalEmployees,
        totalPages: totalPages,
        currentPage: page,
        limit: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// export const createEmployee = async (req, res) => {
//   try {
//     const { name, username, password, employeeId, category } = req.body;

//     // Cek apakah username sudah digunakan
//     const userExists = await User.findOne({ username });
//     if (userExists) {
//       return res.status(400).json({ message: "Username sudah digunakan" });
//     }

//     // Hash password secara manual (jika belum ada logic pre-save di model)
//     const salt = await bcrypt.genSalt(10);
//     const hashedPassword = await bcrypt.hash(password, salt);

//     // Simpan ke database
//     const newUser = await User.create({
//       name,
//       username,
//       password: hashedPassword,
//       employeeId,
//       category, // Harus salah satu dari: Satpam, Apoteker, Cleaning Service, Staff
//       role: "employee",
//     });

//     res.status(201).json({
//       message: "Karyawan berhasil didaftarkan",
//       data: {
//         id: newUser._id,
//         username: newUser.username,
//         category: newUser.category,
//       },
//     });
//   } catch (error) {
//     // Menangkap error jika kategori tidak sesuai ENUM
//     if (error.name === "ValidationError") {
//       return res.status(400).json({
//         message:
//           "Kategori tidak valid. Pilih antara: Satpam, Apoteker, Cleaning Service, atau Staff",
//       });
//     }
//     res.status(500).json({ message: error.message });
//   }
// };

export const createEmployee = async (req, res) => {
  try {
    const { name, username, password, category, phone } = req.body;

    // Validasi input
    if (!name || !username || !password || !category) {
      return res.status(400).json({
        success: false,
        message: "Nama, username, password, dan kategori wajib diisi",
      });
    }

    // Cek username sudah ada
    const userExists = await User.findOne({ username: username.toLowerCase() });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: `Username "${username}" sudah digunakan`,
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

    // ✅ AUTO-GENERATE EMPLOYEE ID (KITA IMPLEMENT INI NANTI)
    // Sementara biarkan null dulu

    // Create user - password akan di-hash otomatis oleh pre-save hook
    const newUser = await User.create({
      name: name.trim(),
      username: username.toLowerCase().trim(),
      password, // ✅ Jangan hash manual! Biar pre-save hook yang handle
      category,
      phone: phone?.trim(),
      role: "employee",
      isActive: true,
    });

    // Populate category untuk response
    await newUser.populate("category", "name prefix");

    res.status(201).json({
      success: true,
      message: "Karyawan berhasil ditambahkan",
      data: {
        _id: newUser._id,
        name: newUser.name,
        username: newUser.username,
        employeeId: newUser.employeeId, // Null dulu, nanti kita auto-generate
        category: newUser.category,
        role: newUser.role,
        isActive: newUser.isActive,
        createdAt: newUser.createdAt,
      },
    });
  } catch (error) {
    // Handle duplicate key error (username)
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Username sudah digunakan",
      });
    }

    res.status(500).json({
      success: false,
      message: "Gagal menambahkan karyawan",
      error: error.message,
    });
  }
};

export const updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, username, category, employeeId } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    // Update field yang dikirim
    if (name) user.name = name;
    if (username) user.username = username;
    if (employeeId) user.employeeId = employeeId;
    if (category) user.category = category;

    await user.save();

    res.status(200).json({
      message: "Profil karyawan berhasil diperbarui",
      data: user,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    // Cari user terlebih dahulu
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: "Karyawan tidak ditemukan" });
    }

    // Cegah admin menghapus dirinya sendiri (opsional tapi disarankan)
    if (user._id.toString() === req.user._id.toString()) {
      return res
        .status(400)
        .json({ message: "Admin tidak dapat menghapus akunnya sendiri" });
    }

    // Hapus user
    await User.findByIdAndDelete(id);

    res.status(200).json({
      message: `Karyawan dengan username '${user.username}' berhasil dihapus`,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "Password baru minimal 6 karakter" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "Karyawan tidak ditemukan" });
    }

    // Hash password baru
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    await user.save();

    res.status(200).json({
      message: `Password untuk user '${user.username}' berhasil diperbarui`,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAttendanceReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // 1. Validasi input tanggal
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Silakan tentukan rentang tanggal (startDate & endDate)",
      });
    }

    // 2. Format tanggal (Menangani awal dan akhir hari dengan presisi)
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // 3. Query ke database dengan Populate
    const attendances = await Attendance.find({
      clockIn: {
        $gte: start,
        $lte: end,
      },
    })
      .populate("user", "name employeeId category") // Mengambil data user terkait
      .sort({ clockIn: -1 });

    // 4. Transformasi Data (Penting agar Frontend mudah membacanya)
    const reportData = attendances.map((item) => ({
      _id: item._id,
      // Mengambil nama dari populate, jika user dihapus pakai fallback "N/A"
      employeeName: item.user?.name || "Karyawan Dihapus",
      employeeId: item.user?.employeeId || "-",
      category: item.user?.category || "-",
      clockIn: item.clockIn,
      clockOut: item.clockOut || null,
      status: item.status,
      location: item.location || "Lokasi tidak ada",
    }));

    // 5. Kirim Response
    res.status(200).json({
      success: true,
      count: reportData.length,
      data: reportData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Gagal mengambil laporan: " + error.message,
    });
  }
};

export const exportAttendance = async (req, res) => {
  try {
    const { startDate, endDate, category } = req.query;
    let query = {};

    // 1. Logika Filter
    if (startDate && endDate) {
      query.clockIn = {
        $gte: new Date(new Date(startDate).setHours(0, 0, 0, 0)),
        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
      };
    }

    let userFilter = {};
    if (category) userFilter.category = category;
    const users = await User.find(userFilter).select("_id");
    query.user = { $in: users.map((u) => u._id) };

    // 2. Ambil Data
    const data = await Attendance.find(query)
      .populate("user", "name employeeId category")
      .populate("shift", "name");

    if (data.length === 0) {
      return res.status(404).json({ message: "Tidak ada data untuk diexport" });
    }

    // 3. Mapping Data (Agar kolom di Excel rapi)
    const flatData = data.map((item) => ({
      Tanggal: new Date(item.clockIn).toLocaleDateString("id-ID"),
      Nama: item.user?.name || "N/A",
      ID_Karyawan: item.user?.employeeId || "-",
      Kategori: item.user?.category || "-",
      Shift: item.shift?.name || "-",
      Jam_Masuk: item.clockIn
        ? new Date(item.clockIn).toLocaleTimeString("id-ID")
        : "-",
      Jam_Pulang: item.clockOut
        ? new Date(item.clockOut).toLocaleTimeString("id-ID")
        : "-",
      Status: item.status,
      Menit_Telat: item.lateMinutes || 0,
      Total_Menit_Kerja: item.workMinutes || 0,
    }));

    // 4. Konversi ke CSV menggunakan json-2-csv
    const csv = json2csv(flatData, {
      delimiter: { field: "," },
      wrapBooleans: true,
    });

    // Tambahkan instruksi pemisah agar Excel otomatis membagi kolom
    const finalCsv = "sep=,\n" + csv;

    // 5. Kirim sebagai file download
    const fileName = `Laporan_Presensi_${startDate || "All"}.csv`;
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);

    return res.status(200).send(finalCsv);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
