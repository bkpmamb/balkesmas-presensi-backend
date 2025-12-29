// src/seeders/settingsSeeder.js

import mongoose from "mongoose";
import dotenv from "dotenv";
import Settings from "../models/Settings.js";

dotenv.config();

const seedSettings = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    // Hapus settings lama
    await Settings.deleteMany();

    // Buat settings default
    const settings = await Settings.create({
      officeName: "Balkesmas Ambarawa",
      officeAddress: "Jl. Contoh No. 123, Ambarawa",
      targetLatitude: -7.0051,
      targetLongitude: 110.4381,
      radiusMeters: 300, // UPDATE: 300 meter
      isActive: true,
    });

    console.log("✅ Settings default berhasil dibuat!");
    console.log("📍 Lokasi:", settings.officeName);
    console.log("📏 Radius:", settings.radiusMeters, "meter");
    console.log(
      "🗺️  Koordinat:",
      `${settings.targetLatitude}, ${settings.targetLongitude}`
    );

    process.exit(0);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
};

seedSettings();
