// src/config/database.js (BARU)

import mongoose from "mongoose";

const connectDB = async (retries = 5) => {
  if (mongoose.connection.readyState >= 1) {
    console.log("✅ Database already connected");
    return;
  }

  for (let i = 0; i < retries; i++) {
    try {
      await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 10000, // 10 detik timeout
        socketTimeoutMS: 45000,
        family: 4, // Force IPv4 (kadang IPv6 bermasalah di macOS)
      });

      console.log("✅ MongoDB Connected");
      return;
    } catch (error) {
      console.log(`⚠️  Connection attempt ${i + 1} failed:`, error.message);

      if (i < retries - 1) {
        console.log(`   Retrying in 3 seconds...`);
        await new Promise((resolve) => setTimeout(resolve, 3000));
      } else {
        console.error("❌ Failed to connect after", retries, "attempts");
        throw error;
      }
    }
  }
};

export default connectDB;
