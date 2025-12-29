// src/utils/checkDuplicates.js

import dotenv from "dotenv";
import connectDB from "../config/database.js";
import Category from "../models/Category.js";
import Shift from "../models/Shift.js";
import Settings from "../models/Settings.js";
import User from "../models/User.js";

dotenv.config();

const checkDuplicates = async () => {
  try {
    await connectDB(); 
    console.log("✅ Database terkoneksi\n");

    // 1. Cek Categories
    console.log("🔍 Checking Categories...");
    const categories = await Category.find();
    console.log(`   Total: ${categories.length} records`);

    const categoryNames = categories.map((c) => c.name);
    const categoryPrefixes = categories.map((c) => c.prefix);

    const dupNames = categoryNames.filter(
      (item, index) => categoryNames.indexOf(item) !== index
    );
    const dupPrefixes = categoryPrefixes.filter(
      (item, index) => categoryPrefixes.indexOf(item) !== index
    );

    if (dupNames.length > 0) {
      console.log(`   ❌ DUPLICATE NAME FOUND: ${dupNames.join(", ")}`);
    } else {
      console.log("   ✅ No duplicate names");
    }

    if (dupPrefixes.length > 0) {
      console.log(`   ❌ DUPLICATE PREFIX FOUND: ${dupPrefixes.join(", ")}`);
    } else {
      console.log("   ✅ No duplicate prefixes");
    }

    console.log("");

    // 2. Cek Shifts
    console.log("🔍 Checking Shifts...");
    const shifts = await Shift.find().populate("category", "name prefix");
    console.log(`   Total: ${shifts.length} records`);

    const shiftKeys = shifts.map(
      (s) => `${s.name}-${s.category?._id || "no-cat"}`
    );
    const dupShifts = shiftKeys.filter(
      (item, index) => shiftKeys.indexOf(item) !== index
    );

    if (dupShifts.length > 0) {
      console.log(
        `   ❌ DUPLICATE SHIFTS FOUND: ${dupShifts.length} duplicates`
      );

      // Tampilkan detail
      const grouped = {};
      shifts.forEach((s) => {
        const key = `${s.name}-${s.category?._id}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(s);
      });

      Object.entries(grouped).forEach(([key, items]) => {
        if (items.length > 1) {
          console.log(
            `   📌 ${items[0].name} (${items[0].category?.name}): ${items.length} duplicates`
          );
        }
      });
    } else {
      console.log("   ✅ No duplicate shifts");
    }

    console.log("");

    // 3. Cek Settings
    console.log("🔍 Checking Settings...");
    const settings = await Settings.find();
    console.log(`   Total: ${settings.length} records`);

    const activeSettings = settings.filter((s) => s.isActive);
    if (activeSettings.length > 1) {
      console.log(
        `   ❌ MULTIPLE ACTIVE SETTINGS: ${activeSettings.length} active`
      );
    } else {
      console.log("   ✅ Only 1 active setting");
    }

    console.log("");

    // 4. Cek Users (jika ada)
    console.log("🔍 Checking Users...");
    const users = await User.find();
    console.log(`   Total: ${users.length} records`);

    const usernames = users.map((u) => u.username);
    const employeeIds = users.map((u) => u.employeeId).filter(Boolean);

    const dupUsernames = usernames.filter(
      (item, index) => usernames.indexOf(item) !== index
    );
    const dupEmployeeIds = employeeIds.filter(
      (item, index) => employeeIds.indexOf(item) !== index
    );

    if (dupUsernames.length > 0) {
      console.log(`   ❌ DUPLICATE USERNAMES: ${dupUsernames.join(", ")}`);
    } else {
      console.log("   ✅ No duplicate usernames");
    }

    if (dupEmployeeIds.length > 0) {
      console.log(`   ❌ DUPLICATE EMPLOYEE IDs: ${dupEmployeeIds.join(", ")}`);
    } else {
      console.log("   ✅ No duplicate employee IDs");
    }

    console.log("\n✅ Check complete!");
    process.exit(0);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
};

checkDuplicates();
