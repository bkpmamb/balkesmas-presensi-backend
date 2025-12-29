// src/models/ShiftSchedule.js

import mongoose from "mongoose";

const shiftScheduleSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    dayOfWeek: {
      type: Number,
      required: true,
      min: 0, // 0 = Minggu
      max: 6, // 6 = Sabtu
      // 0: Minggu, 1: Senin, 2: Selasa, 3: Rabu, 4: Kamis, 5: Jumat, 6: Sabtu
    },
    shift: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shift",
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Compound index: 1 user hanya bisa punya 1 schedule per hari
shiftScheduleSchema.index({ user: 1, dayOfWeek: 1 }, { unique: true });

// Index untuk performa query
shiftScheduleSchema.index({ user: 1 });
shiftScheduleSchema.index({ shift: 1 });

export default mongoose.model("ShiftSchedule", shiftScheduleSchema);
