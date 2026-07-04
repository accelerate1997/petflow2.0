import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

// Load .env file from the current working directory
dotenv.config();

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME || 'petflow-assets';

if (!accountId || !accessKeyId || !secretAccessKey) {
  console.error("❌ Missing R2 configuration environment variables in .env file.");
  process.exit(1);
}

const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

async function main() {
  console.log(`🔄 Configuring CORS for R2 bucket: ${bucketName}...`);
  
  const corsRules = {
    Bucket: bucketName,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedHeaders: ["*"],
          AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
          AllowedOrigins: [
            "https://petflow.elevetoai.com",
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:3002",
            "*"
          ],
          ExposeHeaders: ["ETag"],
          MaxAgeSeconds: 3600
        }
      ]
    }
  };

  const command = new PutBucketCorsCommand(corsRules);
  const response = await client.send(command);
  console.log("✅ CORS configuration updated successfully on Cloudflare R2 bucket!");
  console.log(JSON.stringify(response, null, 2));
}

main().catch(err => {
  console.error("❌ Error setting CORS on R2 bucket:", err);
  process.exit(1);
});
