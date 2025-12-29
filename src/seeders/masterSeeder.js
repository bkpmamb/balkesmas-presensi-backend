// src/seeders/masterSeeder.js

import mongoose from "mongoose";
import dotenv from "dotenv";
import Category from "../models/Category.js";
import Shift from "../models/Shift.js";
import Settings from "../models/Settings.js";

dotenv.config();

// Data Categories
const categories = [
  { name: "Satpam", prefix: "SAT", description: "Satuan Pengamanan" },
  { name: "Cleaning Service", prefix: "CS", description: "Petugas Kebersihan" },
  { name: "Staff", prefix: "STA", description: "Staff Administrasi dan Umum" },
  { name: "Apoteker", prefix: "APT", description: "Tenaga Farmasi" },
];

const masterSeeder = async () => {
  try {
    console.log("🚀 Memulai Master Seeder...\n");

    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Database terkoneksi\n");

    // 1. Seed Categories
    console.log("📦 Seeding Categories...");
    await Category.deleteMany();
    const cats = await Category.insertMany(categories);
    console.log(`✅ ${cats.length} kategori berhasil ditambahkan\n`);

    // 2. Seed Shifts
    console.log("📦 Seeding Shifts...");
    const satpam = cats.find((c) => c.prefix === "SAT");
    const staff = cats.find((c) => c.prefix === "STA");
    const apoteker = cats.find((c) => c.prefix === "APT");
    const cs = cats.find((c) => c.prefix === "CS");

    const shifts = [
      {
        name: "Staff Pagi",
        category: staff._id,
        startTime: "08:00",
        endTime: "16:00",
        toleranceMinutes: 15,
      },
      {
        name: "Satpam Pagi",
        category: satpam._id,
        startTime: "07:00",
        endTime: "15:00",
        toleranceMinutes: 15,
      },
      {
        name: "Satpam Siang",
        category: satpam._id,
        startTime: "15:00",
        endTime: "23:00",
        toleranceMinutes: 15,
      },
      {
        name: "Satpam Malam",
        category: satpam._id,
        startTime: "23:00",
        endTime: "07:00",
        toleranceMinutes: 15,
      },
      {
        name: "Apoteker Pagi",
        category: apoteker._id,
        startTime: "07:00",
        endTime: "15:00",
        toleranceMinutes: 15,
      },
      {
        name: "Apoteker Siang",
        category: apoteker._id,
        startTime: "15:00",
        endTime: "23:00",
        toleranceMinutes: 15,
      },
      {
        name: "CS Pagi",
        category: cs._id,
        startTime: "06:00",
        endTime: "14:00",
        toleranceMinutes: 15,
      },
      {
        name: "CS Siang",
        category: cs._id,
        startTime: "14:00",
        endTime: "22:00",
        toleranceMinutes: 15,
      },
    ];

    await Shift.deleteMany();
    const shiftResults = await Shift.insertMany(shifts);
    console.log(`✅ ${shiftResults.length} shift berhasil ditambahkan\n`);

    // 3. Seed Settings
    console.log("📦 Seeding Settings...");
    await Settings.deleteMany();
    await Settings.create({
      officeName: "Balkesmas Ambarawa",
      officeAddress: "Jl. Contoh No. 123, Ambarawa",
      targetLatitude: -7.0051,
      targetLongitude: 110.4381,
      radiusMeters: 300,
      isActive: true,
    });
    console.log("✅ Settings berhasil dibuat\n");

    console.log("🎉 Master Seeder selesai! Semua data berhasil di-seed.");
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
};

masterSeeder();
