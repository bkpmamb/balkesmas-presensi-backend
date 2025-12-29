// src/utils/generateEmployeeId.js

import User from "../models/User.js";

/**
 * Generate Employee ID otomatis berdasarkan category
 * Format: PREFIX + 3 digit number (contoh: APT001, SAT002)
 *
 * @param {String} categoryId - ObjectId category
 * @param {String} prefix - Category prefix (APT, SAT, CS, STA)
 * @returns {String} Generated Employee ID
 */
export const generateEmployeeId = async (categoryId, prefix) => {
  try {
    // 1. Cari semua employee dengan category yang sama
    const employees = await User.find({
      category: categoryId,
      employeeId: { $ne: null }, // Hanya yang sudah punya employeeId
    })
      .select("employeeId")
      .sort({ employeeId: -1 }) // Sorting descending
      .limit(1); // Ambil yang paling baru

    let nextNumber = 1;

    if (employees.length > 0) {
      const lastEmployeeId = employees[0].employeeId;

      // 2. Extract nomor dari employeeId (APT001 → 001)
      const numberPart = lastEmployeeId.replace(prefix, ""); // "001"
      const lastNumber = parseInt(numberPart, 10); // 1

      // 3. Increment
      nextNumber = lastNumber + 1;
    }

    // 4. Format jadi 3 digit dengan leading zeros
    const formattedNumber = String(nextNumber).padStart(3, "0");

    // 5. Gabungkan prefix + number
    const newEmployeeId = `${prefix}${formattedNumber}`;

    return newEmployeeId;
  } catch (error) {
    console.error("Error generating employee ID:", error);
    throw error;
  }
};
