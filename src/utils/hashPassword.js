// src/utils/hashPassword.js

import bcrypt from "bcryptjs";

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(password, salt);
  console.log("Password:", password);
  console.log("Hashed:", hashed);
  console.log("\nCopy hashed password ini ke MongoDB Atlas!");
};

// Hash password "admin123"
hashPassword("admin123");