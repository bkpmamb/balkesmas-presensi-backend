// src/utils/testConnection.js

import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const testConnection = async () => {
  console.log("🔌 Testing MongoDB connection...\n");
  console.log(
    "Connection String:",
    process.env.MONGO_URI.replace(/:[^:@]+@/, ":****@")
  ); // Hide password

  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      family: 4, // Force IPv4
    });

    console.log("✅ Connection successful!");
    console.log("📊 Database:", mongoose.connection.name);
    console.log("🖥️  Host:", mongoose.connection.host);

    await mongoose.connection.close();
    console.log("🔌 Connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Connection failed!");
    console.error("Error:", error.message);
    console.error("\n💡 Troubleshooting:");
    console.error("   1. Check your internet connection");
    console.error("   2. Verify MongoDB Atlas is accessible");
    console.error("   3. Check IP whitelist in MongoDB Atlas");
    console.error("   4. Try flushing DNS: sudo dscacheutil -flushcache");
    process.exit(1);
  }
};

testConnection();
