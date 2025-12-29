// src/seeders/categorySeeder.js

import mongoose from "mongoose";
import dotenv from "dotenv";
import Category from "../models/Category.js";

dotenv.config();

const categories = [
  {
    name: "Satpam",
    prefix: "SAT",
    description: "Satuan Pengamanan",
  },
  {
    name: "Cleaning Service",
    prefix: "CS",
    description: "Petugas Kebersihan",
  },
  {
    name: "Staff",
    prefix: "STA",
    description: "Staff Administrasi dan Umum",
  },
  {
    name: "Apoteker",
    prefix: "APT",
    description: "Tenaga Farmasi",
  },
];

const seedCategories = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    // Hapus data lama
    await Category.deleteMany();

    // Insert data baru
    const result = await Category.insertMany(categories);

    console.log("✅ Master Data Kategori berhasil ditambahkan!");
    console.log("📋 Total kategori:", result.length);
    result.forEach((cat) => {
      console.log(`   - ${cat.name} (${cat.prefix})`);
    });

    process.exit(0);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
};

seedCategories();
