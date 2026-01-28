import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";

console.log("Using S3 region:", process.env.AWS_REGION);

const s3 = new S3Client({
  region: process.env.AWS_REGION,
});

console.log("Using Bucket:", process.env.AWS_S3_BUCKET);

const BUCKET_NAME = process.env.AWS_S3_BUCKET!;

export async function uploadFolderToS3(
  localFolderPath: string,
  s3BaseKey: string,
) {
  const files = fs.readdirSync(localFolderPath);

  for (const file of files) {
    const fullPath = path.join(localFolderPath, file);
    const s3Key = `${s3BaseKey}/${file}`;

    if (fs.lstatSync(fullPath).isDirectory()) {
      //  Recurse into subfolder
      await uploadFolderToS3(fullPath, s3Key);
    } else {
      // Upload file
      const fileStream = fs.createReadStream(fullPath);
      const metadata = getS3Metadata(file);
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: s3Key,
          Body: fileStream,
          ...metadata,
        }),
      );
    }
  }
}

function getContentType(filename: string): string {
  if (filename.endsWith(".html")) return "text/html";
  if (filename.endsWith(".js")) return "application/javascript";
  if (filename.endsWith(".wasm")) return "application/wasm";
  if (filename.endsWith(".data")) return "application/octet-stream";
  if (filename.endsWith(".json")) return "application/json";
  return "application/octet-stream";
}

function getS3Metadata(fileName: string) {
  let contentEncoding: string | undefined;
  let baseName = fileName;

  // Handle compression
  if (fileName.endsWith(".gz")) {
    contentEncoding = "gzip";
    baseName = fileName.slice(0, -3);
  } else if (fileName.endsWith(".br")) {
    contentEncoding = "br";
    baseName = fileName.slice(0, -3);
  }

  // Determine content-type
  let contentType: string | undefined;

  if (baseName.endsWith(".wasm")) {
    contentType = "application/wasm";
  } else if (baseName.endsWith(".js")) {
    contentType = "application/javascript";
  } else if (baseName.endsWith(".html")) {
    contentType = "text/html";
  } else if (baseName.endsWith(".json")) {
    contentType = "application/json";
  } else if (baseName.endsWith(".data")) {
    contentType = "application/octet-stream";
  }

  return {
    ContentType: contentType,
    ContentEncoding: contentEncoding,
  };
}