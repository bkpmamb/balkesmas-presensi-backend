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
    console.log("==========================================");
    console.log("🔢 Generating Employee ID");
    console.log("Category ID:", categoryId);
    console.log("Prefix:", prefix);

    // ✅ 1. Cari employee dengan VALID employeeId format (PREFIX + 3 digits)
    const validIdPattern = new RegExp(`^${prefix}\\d{3}$`); // e.g., ^SAT\d{3}$ matches SAT001, SAT002, etc.

    const employees = await User.find({
      category: categoryId,
      employeeId: validIdPattern, // ✅ Hanya yang format valid!
    })
      .select("employeeId")
      .sort({ employeeId: -1 }) // Descending
      .limit(1);

    console.log("Valid employees found:", employees.length);
    if (employees.length > 0) {
      console.log("Last valid employee ID:", employees[0].employeeId);
    }

    let nextNumber = 1;

    if (employees.length > 0) {
      const lastEmployeeId = employees[0].employeeId;

      // ✅ 2. Extract nomor (last 3 characters)
      const numberPart = lastEmployeeId.slice(-3); // Get last 3 chars: "001"
      console.log("Number part extracted:", numberPart);

      const lastNumber = parseInt(numberPart, 10); // Parse to integer
      console.log("Last number:", lastNumber);

      // ✅ 3. Safety check: jika parsing gagal, default ke 1
      if (!isNaN(lastNumber) && lastNumber > 0) {
        nextNumber = lastNumber + 1;
      } else {
        console.warn("⚠️ Invalid number detected, defaulting to 1");
      }
    }

    console.log("Next number:", nextNumber);

    // ✅ 4. Format jadi 3 digit dengan leading zeros
    const formattedNumber = String(nextNumber).padStart(3, "0");
    console.log("Formatted number:", formattedNumber);

    // ✅ 5. Gabungkan prefix + number
    const newEmployeeId = `${prefix}${formattedNumber}`;
    console.log("✅ Generated Employee ID:", newEmployeeId);
    console.log("==========================================");

    return newEmployeeId;
  } catch (error) {
    console.error("❌ Error generating employee ID:", error);
    throw new Error(`Failed to generate employee ID: ${error.message}`);
  }
};
