import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    shift: { type: mongoose.Schema.Types.ObjectId, ref: "Shift" },
    clockIn: { type: Date, required: true },
    clockOut: { type: Date },
    location: {
      type: { type: String, default: "Point" },
      coordinates: { type: [Number], required: true }, // [longitude, latitude]
    },
    photoUrl: { type: String, required: true }, // URL dari S3
    status: {
      type: String,
      enum: ["ontime", "late"],
      default: "ontime",
    },
    lateMinutes: { type: Number, default: 0 },
    address: { type: String }, // Opsional: hasil reverse geocoding
  },
  { timestamps: true }
);

// 1. Index untuk Geolocation (Penting untuk validasi jarak)
attendanceSchema.index({ location: "2dsphere" });

// 2. Compound Index untuk performa query history per user
attendanceSchema.index({ user: 1, clockIn: -1 });

export default mongoose.model("Attendance", attendanceSchema);
