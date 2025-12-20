import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["admin", "employee"], default: "employee" },
    category: {
      type: String,
      enum: ["Satpam", "Apoteker", "Cleaning Service", "Staff"],
      required: true,
    },
    employeeId: { type: String, unique: true },
  },
  { timestamps: true }
);

userSchema.index({ category: 1 });

export default mongoose.model("User", userSchema);
