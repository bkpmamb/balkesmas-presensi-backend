// src/utils/s3Upload.js

import { PutObjectCommand } from "@aws-sdk/client-s3";
import s3Client from "../config/s3Config.js";
import { addWatermark } from "./watermark.js";

/**
 * Upload file to Biznet GIO NOS (with optional watermark)
 * @param {Object} file - Multer file object
 * @param {Object} watermarkData - Optional watermark data
 * @returns {Promise<string>} - Public URL of uploaded file
 */
export const uploadToS3 = async (file, watermarkData = null) => {
  try {
    let fileBuffer = file.buffer;
    let contentType = file.mimetype;

    // ✅ Add watermark if data provided
    if (watermarkData) {
      console.log("🎨 Adding watermark to image...");
      fileBuffer = await addWatermark(file.buffer, watermarkData);
      contentType = "image/jpeg"; // Sharp outputs JPEG
      console.log("✅ Watermark added successfully");
    }

    // Folder: photos/2025/12/timestamp-namafile.jpg
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0"); // 01, 02, ...
    const folderPath = `photos/${year}/${month}`;

    // Sanitize filename (remove spaces, special chars)
    const sanitizedFileName = file.originalname
      .replace(/\s+/g, "-") // Replace spaces with hyphens
      .replace(/[^a-zA-Z0-9.-]/g, ""); // Remove special chars

    const fileName = `${folderPath}/${Date.now()}-${sanitizedFileName}`;

    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: fileName,
      Body: fileBuffer, // Use processed buffer (with or without watermark)
      ContentType: contentType,
      ACL: "public-read", // Public access untuk Admin Panel
    };

    // Upload to Biznet GIO NOS
    await s3Client.send(new PutObjectCommand(params));

    // Format URL: https://nos.wjv-1.neo.id/bucket-name/photos/2025/12/filename.jpg
    const publicUrl = `${process.env.AWS_S3_ENDPOINT}/${process.env.AWS_S3_BUCKET_NAME}/${fileName}`;

    console.log("📤 File uploaded:", publicUrl);

    return publicUrl;
  } catch (error) {
    console.error("❌ Biznet GIO Upload Error:", error);
    throw new Error(
      `Gagal upload foto ke NEO Object Storage: ${error.message}`
    );
  }
};
