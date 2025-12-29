// src/models/Settings.js

import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
  {
    officeName: {
      type: String,
      default: "Kantor Pusat",
      trim: true,
    },
    officeAddress: {
      type: String,
      trim: true,
    },
    targetLatitude: {
      type: Number,
      required: [true, "Latitude kantor wajib diisi"],
      min: [-90, "Latitude harus antara -90 dan 90"],
      max: [90, "Latitude harus antara -90 dan 90"],
    },
    targetLongitude: {
      type: Number,
      required: [true, "Longitude kantor wajib diisi"],
      min: [-180, "Longitude harus antara -180 dan 180"],
      max: [180, "Longitude harus antara -180 dan 180"],
    },
    radiusMeters: {
      type: Number,
      default: 300, // UPDATE: 100m → 300m
      min: [10, "Radius minimal 10 meter"],
      max: [5000, "Radius maksimal 5000 meter"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Method untuk get active settings
settingsSchema.statics.getActiveSettings = async function () {
  let settings = await this.findOne({ isActive: true });

  // Jika belum ada settings, buat default
  if (!settings) {
    settings = await this.create({
      officeName: "Kantor Pusat",
      targetLatitude: -7.0051,
      targetLongitude: 110.4381,
      radiusMeters: 300,
      isActive: true,
    });
  }

  return settings;
};

export default mongoose.model("Settings", settingsSchema);
