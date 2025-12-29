// src/seeders/adminSeeder.js

import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js";
import Category from "../models/Category.js";

dotenv.config();

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      family: 4,
    });
    console.log("✅ Database terkoneksi\n");

    // Ambil category pertama (untuk dummy admin)
    const firstCategory = await Category.findOne();

    if (!firstCategory) {
      console.log("❌ Belum ada kategori! Jalankan npm run seed:all dulu");
      process.exit(1);
    }

    // Cek apakah admin sudah ada
    const adminExists = await User.findOne({ username: "admin" });

    if (adminExists) {
      console.log("⚠️  Admin sudah ada!");
      console.log("👤 Username:", adminExists.username);
      console.log("🔑 Password: admin123");
      console.log("📋 Role:", adminExists.role);
      console.log("🆔 ID:", adminExists._id);
      console.log("\n✅ Anda bisa langsung login dengan credentials di atas");
      process.exit(0);
    }

    // Buat admin baru
    const admin = await User.create({
      name: "Super Admin",
      username: "admin",
      password: "admin123", // Akan di-hash otomatis oleh pre-save hook
      role: "admin",
      category: firstCategory._id, // ← Pakai ObjectId category pertama
      employeeId: "ADM001",
      isActive: true,
    });

    console.log("✅ Admin berhasil dibuat!\n");
    console.log("📝 Credentials:");
    console.log("   Username: admin");
    console.log("   Password: admin123");
    console.log("\n📋 Details:");
    console.log("   Name:", admin.name);
    console.log("   Role:", admin.role);
    console.log("   ID:", admin._id);
    console.log("   Category:", firstCategory.name);

    process.exit(0);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
};

createAdmin();
