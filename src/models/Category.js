// src/models/Category.js

import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Nama kategori wajib diisi"],
      unique: true,
      trim: true,
    },
    prefix: {
      type: String,
      required: [true, "Prefix ID wajib diisi"],
      unique: true,
      uppercase: true,
      trim: true,
      minlength: [2, "Prefix minimal 2 karakter"],
      maxlength: [4, "Prefix maksimal 4 karakter"],
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

export default mongoose.model("Category", categorySchema);
