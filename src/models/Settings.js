import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
  {
    officeName: { type: String, default: "Balkesmas Ambarawa" },
    targetLatitude: { type: Number, required: true, default: -7.0051 },
    targetLongitude: { type: Number, required: true, default: 110.4381 },
    radius: { type: Number, default: 100 }, // dalam meter
    workStartTime: { type: String, default: "07:00" }, // Format HH:mm
    workEndTime: { type: String, default: "15:00" },
  },
  { timestamps: true }
);

export default mongoose.model("Settings", settingsSchema);
