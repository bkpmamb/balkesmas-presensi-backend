import mongoose from "mongoose";

const shiftSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // misal: "Shift Pagi Satpam"
    category: { type: String, required: true }, // Menghubungkan ke category di User
    startTime: { type: String, required: true }, // Format "07:00"
    endTime: { type: String, required: true }, // Format "15:00"
    gracePeriod: { type: Number, default: 0 },
  },
  { timestamps: true }
);

shiftSchema.index({ category: 1 });

export default mongoose.model("Shift", shiftSchema);
