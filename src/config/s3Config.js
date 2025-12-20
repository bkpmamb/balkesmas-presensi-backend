import { S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

const s3Client = new S3Client({
  region: process.env.AWS_REGION, // idn
  endpoint: process.env.AWS_S3_ENDPOINT, // https://nos.wjv-1.neo.id
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true, // Sangat penting untuk Biznet GIO / Minio
});

export default s3Client;
