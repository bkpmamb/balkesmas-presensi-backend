import { PutObjectCommand } from "@aws-sdk/client-s3";
import s3Client from "../config/s3Config.js";

export const uploadToS3 = async (file) => {
  // Folder: photos/2025/12/namafile.jpg
  const date = new Date();
  const folderPath = `photos/${date.getFullYear()}/${date.getMonth() + 1}`;
  const fileName = `${folderPath}/${Date.now()}-${file.originalname}`;

  const params = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: fileName,
    Body: file.buffer,
    ContentType: file.mimetype,
    ACL: "public-read", // Agar foto bisa dibuka di Admin Panel
  };

  try {
    await s3Client.send(new PutObjectCommand(params));

    // Format URL Biznet GIO NOS: https://nos.wjv-1.neo.id/bucket-name/key
    return `${process.env.AWS_S3_ENDPOINT}/${process.env.AWS_S3_BUCKET_NAME}/${fileName}`;
  } catch (error) {
    console.error("Biznet GIO Upload Error:", error);
    throw new Error("Gagal upload foto ke NEO Object Storage");
  }
};
