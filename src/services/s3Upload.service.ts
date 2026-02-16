import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { logger } from "../utils/logger";
import fs from "fs";
import path from "path";

console.log("Using S3 region:", process.env.AWS_REGION);

const s3 = new S3Client({
  region: process.env.AWS_REGION,
});

console.log("Using Bucket:", process.env.AWS_S3_BUCKET);

const BUCKET_NAME = process.env.AWS_S3_BUCKET!;

// Helper function to get all files recursively
function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);

  files.forEach(function (file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      arrayOfFiles.push(path.join(dirPath, "/", file));
    }
  });

  return arrayOfFiles;
}

export async function uploadFolderToS3(folderPath: string, s3KeyBase: string) {
  logger.info(`Starting S3 upload from ${folderPath} to s3://${BUCKET_NAME}/${s3KeyBase}`);
  const allLocalFiles = getAllFiles(folderPath);

  for (const fullPath of allLocalFiles) {
    // Calculate the relative path from the base folderPath
    const relativePath = path.relative(folderPath, fullPath);
    const s3Key = path.join(s3KeyBase, relativePath).replace(/\\/g, '/'); // Ensure S3 key uses forward slashes

    try {
      // Upload file
      const fileStream = fs.createReadStream(fullPath);
      const metadata = getS3Metadata(relativePath);

      logger.debug(`Uploading file: ${s3Key}`);

      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: s3Key,
          Body: fileStream,
          ContentType: metadata.ContentType,
          ContentEncoding: metadata.ContentEncoding,
        }),
      );
    } catch (e) {
      logger.error(`Failed to upload ${s3Key}:`, e);
      throw e;
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