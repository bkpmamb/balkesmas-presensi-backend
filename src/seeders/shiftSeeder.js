import mongoose from "mongoose";
import dotenv from "dotenv";
import Shift from "../models/Shift.js";

dotenv.config();

const shifts = [
  {
    name: "Staff Kantor",
    startTime: "08:00",
    endTime: "16:00",
    category: "Staff",
  },
  {
    name: "Satpam Pagi",
    startTime: "07:00",
    endTime: "15:00",
    category: "Satpam",
  },
  {
    name: "Apoteker Pagi",
    startTime: "07:00",
    endTime: "15:00",
    category: "Apoteker",
  },
  {
    name: "Satpam Siang",
    startTime: "08:00",
    endTime: "23:00",
    category: "Satpam",
  },
  {
    name: "Satpam Malam",
    startTime: "23:00",
    endTime: "07:00",
    category: "Satpam",
  },
  {
    name: "Apoteker Siang",
    startTime: "15:00",
    endTime: "23:00",
    category: "Apoteker",
  },
];

const seedShifts = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    // Hapus data shift lama agar tidak duplikat saat running ulang
    await Shift.deleteMany();

    // Masukkan data baru
    await Shift.insertMany(shifts);

    console.log("✅ Master Data Shift berhasil ditambahkan!");
    process.exit();
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
};

seedShifts();
