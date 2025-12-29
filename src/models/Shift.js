// src/models/Shift.js

import mongoose from "mongoose";

const shiftSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Nama shift wajib diisi"],
      trim: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Kategori shift wajib diisi"],
    },
    startTime: {
      type: String,
      required: [true, "Waktu mulai wajib diisi"],
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Format waktu harus HH:mm"],
    },
    endTime: {
      type: String,
      required: [true, "Waktu selesai wajib diisi"],
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Format waktu harus HH:mm"],
    },
    toleranceMinutes: {
      type: Number,
      default: 15,
      min: [0, "Toleransi tidak boleh negatif"],
      max: [60, "Toleransi maksimal 60 menit"],
    },
    description: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Index untuk performa
shiftSchema.index({ category: 1 });
shiftSchema.index({ name: 1 });

export default mongoose.model("Shift", shiftSchema);
