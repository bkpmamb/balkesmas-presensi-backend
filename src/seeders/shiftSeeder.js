// src/seeders/shiftSeeder.js

import mongoose from "mongoose";
import dotenv from "dotenv";
import Shift from "../models/Shift.js";
import Category from "../models/Category.js";

dotenv.config();

const seedShifts = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    // 1. Ambil ID kategori dari database
    const satpam = await Category.findOne({ prefix: "SAT" });
    const staff = await Category.findOne({ prefix: "STA" });
    const apoteker = await Category.findOne({ prefix: "APT" });
    const cs = await Category.findOne({ prefix: "CS" });

    if (!satpam || !staff || !apoteker || !cs) {
      console.error("❌ Kategori belum di-seed! Jalankan categorySeeder dulu.");
      process.exit(1);
    }

    // 2. Data shift
    const shifts = [
      // Staff
      {
        name: "Staff Pagi",
        category: staff._id,
        startTime: "08:00",
        endTime: "16:00",
        toleranceMinutes: 15,
        description: "Shift pagi untuk staff administrasi",
      },

      // Satpam
      {
        name: "Satpam Pagi",
        category: satpam._id,
        startTime: "07:00",
        endTime: "15:00",
        toleranceMinutes: 15,
        description: "Shift pagi untuk satpam",
      },
      {
        name: "Satpam Siang",
        category: satpam._id,
        startTime: "15:00",
        endTime: "23:00",
        toleranceMinutes: 15,
        description: "Shift siang untuk satpam",
      },
      {
        name: "Satpam Malam",
        category: satpam._id,
        startTime: "23:00",
        endTime: "07:00",
        toleranceMinutes: 15,
        description: "Shift malam untuk satpam",
      },

      // Apoteker
      {
        name: "Apoteker Pagi",
        category: apoteker._id,
        startTime: "07:00",
        endTime: "15:00",
        toleranceMinutes: 15,
        description: "Shift pagi untuk apoteker",
      },
      {
        name: "Apoteker Siang",
        category: apoteker._id,
        startTime: "15:00",
        endTime: "23:00",
        toleranceMinutes: 15,
        description: "Shift siang untuk apoteker",
      },

      // Cleaning Service
      {
        name: "CS Pagi",
        category: cs._id,
        startTime: "06:00",
        endTime: "14:00",
        toleranceMinutes: 15,
        description: "Shift pagi untuk cleaning service",
      },
      {
        name: "CS Siang",
        category: cs._id,
        startTime: "14:00",
        endTime: "22:00",
        toleranceMinutes: 15,
        description: "Shift siang untuk cleaning service",
      },
    ];

    // 3. Hapus data shift lama
    await Shift.deleteMany();

    // 4. Insert data baru
    const result = await Shift.insertMany(shifts);

    console.log("✅ Master Data Shift berhasil ditambahkan!");
    console.log("📋 Total shift:", result.length);

    // Group by category untuk display yang rapi
    const grouped = result.reduce((acc, shift) => {
      const catName =
        shifts
          .find((s) => s.name === shift.name)
          ?.description?.split(" untuk ")[1] || "Unknown";
      if (!acc[catName]) acc[catName] = [];
      acc[catName].push(shift.name);
      return acc;
    }, {});

    Object.entries(grouped).forEach(([category, shiftNames]) => {
      console.log(`   📌 ${category}:`);
      shiftNames.forEach((name) => console.log(`      - ${name}`));
    });

    process.exit(0);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
};

seedShifts();
