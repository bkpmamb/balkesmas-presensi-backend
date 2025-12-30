// src/models/Attendance.js

import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    shift: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shift",
      required: true,
    },
    date: {
      type: Date,
      required: true,
      // Simpan tanggal saja (00:00:00) untuk kemudahan query
    },
    clockIn: {
      type: Date,
      required: true,
    },
    clockOut: {
      type: Date,
    },
    clockInLocation: {
      type: { type: String, default: "Point" },
      coordinates: { type: [Number], required: true }, // [longitude, latitude]
    },
    clockOutLocation: {
      type: { type: String, enum: "Point" },
      coordinates: { type: [Number] }, // [longitude, latitude]
    },
    photoUrl: {
      type: String,
      required: true,
    },
    photoOutUrl: {
      type: String,
    },
    clockInStatus: {
      type: String,
      enum: ["ontime", "late"],
      default: "ontime",
    },
    clockOutStatus: {
      type: String,
      enum: ["normal", "early", "ontime"],
      default: "normal",
    },
    lateMinutes: {
      type: Number,
      default: 0,
    },
    workMinutes: {
      type: Number,
      default: 0,
    },
    isManualEntry: {
      type: Boolean,
      default: false,
    },
    manualEntryNote: {
      type: String,
      trim: true,
    },
    manualEntryBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Index untuk Geolocation
attendanceSchema.index({ clockInLocation: "2dsphere" });
attendanceSchema.index({ clockOutLocation: "2dsphere" }, { sparse: true });

// Compound Index untuk performa query
attendanceSchema.index({ user: 1, date: -1 });
attendanceSchema.index({ user: 1, clockIn: -1 });
attendanceSchema.index({ date: -1 });
attendanceSchema.index({ shift: 1 });

// Virtual untuk mendapatkan durasi kerja dalam format jam:menit
attendanceSchema.virtual("workDuration").get(function () {
  if (!this.workMinutes) return "0 jam 0 menit";
  const hours = Math.floor(this.workMinutes / 60);
  const minutes = this.workMinutes % 60;
  return `${hours} jam ${minutes} menit`;
});

// Pastikan virtual fields ikut di-serialize
attendanceSchema.set("toJSON", { virtuals: true });
attendanceSchema.set("toObject", { virtuals: true });

export default mongoose.model("Attendance", attendanceSchema);
