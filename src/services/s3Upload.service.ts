import { S3Client, PutObjectCommand, ListObjectsCommand, DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { logger } from "../utils/logger";
import fs from "fs";
import path from "path";
import { Upload } from "@aws-sdk/lib-storage";

type FolderUploadProgress = {
  currentFile: string;
  currentFileLoaded: number;
  currentFileTotal: number;
  currentFilePercent: number;
  overallLoaded: number;
  overallTotal: number;
  overallPercent: number;
};
console.log("Using S3 region:", process.env.AWS_REGION);

const s3 = new S3Client({
  region: process.env.AWS_REGION,
});

console.log("Using Bucket:", process.env.AWS_S3_BUCKET);

const BUCKET_NAME = process.env.AWS_S3_BUCKET!;
export class S3PrefixDeleteError extends Error {
  prefix: string;
  details: string;

  constructor(prefix: string, details: string) {
    super(`Failed to delete S3 prefix "${prefix}": ${details}`);
    this.prefix = prefix;
    this.details = details;
  }
}
// Helper function to get all files recursively
function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const file of files) {
    const fullPath = path.join(dirPath, file.name);

    if (file.isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else if (file.isFile()) {
      arrayOfFiles.push(fullPath);
    }
  }

  return arrayOfFiles;
}

export async function uploadFolderToS3(folderPath: string, s3KeyBase: string) {
  logger.info(`Starting S3 upload from ${folderPath} to s3://${BUCKET_NAME}/${s3KeyBase}`);
  const allLocalFiles = getAllFiles(folderPath);
  
  for (const fullPath of allLocalFiles) {
    // Calculate the relative path from the base folderPath
    const relativePath = path.relative(folderPath, fullPath);
    const s3Key = path.posix.join(s3KeyBase, relativePath.replace(/\\/g, "/"));

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


const MULTIPART_THRESHOLD = 8 * 1024 * 1024; // 8 MB
const MULTIPART_PART_SIZE = 8 * 1024 * 1024; // 8 MB
const MAX_RETRIES = 3;

function isRetriableUploadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const anyErr = error as Error & {
    code?: string;
    name?: string;
    errno?: number;
    $metadata?: { httpStatusCode?: number };
  };

  const code = anyErr.code ?? "";
  const name = anyErr.name ?? "";
  const status = anyErr.$metadata?.httpStatusCode;

  if (code === "ERANGE") return true;
  if (code === "ECONNRESET") return true;
  if (code === "ETIMEDOUT") return true;
  if (code === "EPIPE") return true;
  if (name === "TimeoutError") return true;
  if (status === 500 || status === 502 || status === 503 || status === 504) return true;

  return false;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function uploadFolderToS3WithProgress(
  folderPath: string,
  s3KeyBase: string,
  onProgress?: (progress: FolderUploadProgress) => void,
) {
  logger.info(`Starting S3 upload from ${folderPath} to s3://${BUCKET_NAME}/${s3KeyBase}`);

  const allLocalFiles = getAllFiles(folderPath);

  if (allLocalFiles.length === 0) {
    logger.warn(`No files found in folder: ${folderPath}`);
    return;
  }

  const filesWithStats = allLocalFiles.map((fullPath) => {
    const stat = fs.statSync(fullPath);
    const relativePath = path.relative(folderPath, fullPath).replace(/\\/g, "/");

    return {
      fullPath,
      size: stat.size,
      relativePath,
      s3Key: path.posix.join(s3KeyBase, relativePath),
      metadata: getS3Metadata(relativePath),
    };
  });

  logger.info(`Total files found for upload: ${filesWithStats.length}`);
  for (const file of filesWithStats) {
    logger.info(`[UPLOAD_LIST] ${file.relativePath} (${file.size} bytes)`);
  }

  const overallTotal = filesWithStats.reduce((sum, file) => sum + file.size, 0);
  let overallLoaded = 0;

  const emitProgress = (
    file: {
      relativePath: string;
      size: number;
    },
    currentFileLoaded: number,
    currentFileTotal: number,
  ) => {
    onProgress?.({
      currentFile: file.relativePath,
      currentFileLoaded,
      currentFileTotal,
      currentFilePercent:
        currentFileTotal > 0 ? Math.round((currentFileLoaded / currentFileTotal) * 100) : 0,
      overallLoaded,
      overallTotal,
      overallPercent: overallTotal > 0 ? Math.round((overallLoaded / overallTotal) * 100) : 0,
    });
  };

  for (const file of filesWithStats) {
    let uploaded = false;

    for (let attempt = 1; attempt <= MAX_RETRIES && !uploaded; attempt++) {
      let lastLoadedForThisFile = 0;

      try {
        logger.info(
          `Uploading file: ${file.s3Key} | size=${file.size} | attempt=${attempt}/${MAX_RETRIES}`,
        );

        if (file.size < MULTIPART_THRESHOLD) {
          const fileStream = fs.createReadStream(file.fullPath);

          fileStream.on("error", (err) => {
            logger.error(`Read stream error for ${file.fullPath}`, err);
          });

          emitProgress(file, 0, file.size);

          await s3.send(
            new PutObjectCommand({
              Bucket: BUCKET_NAME,
              Key: file.s3Key,
              Body: fileStream,
              ContentLength: file.size,
              ContentType: file.metadata.ContentType,
              ContentEncoding: file.metadata.ContentEncoding,
            }),
          );

          overallLoaded += file.size;
          emitProgress(file, file.size, file.size);
        } else {
          const fileStream = fs.createReadStream(file.fullPath);

          fileStream.on("error", (err) => {
            logger.error(`Read stream error for ${file.fullPath}`, err);
          });

          const upload = new Upload({
            client: s3,
            params: {
              Bucket: BUCKET_NAME,
              Key: file.s3Key,
              Body: fileStream,
              ContentLength: file.size,
              ContentType: file.metadata.ContentType,
              ContentEncoding: file.metadata.ContentEncoding,
            },
            queueSize: 1,
            partSize: MULTIPART_PART_SIZE,
            leavePartsOnError: false,
          });

          upload.on("httpUploadProgress", (progress) => {
            const loaded = progress.loaded ?? 0;
            const total = progress.total ?? file.size;

            const delta = loaded - lastLoadedForThisFile;
            if (delta > 0) {
              overallLoaded += delta;
              lastLoadedForThisFile = loaded;
            }

            emitProgress(file, loaded, total);
          });

          await upload.done();

          if (lastLoadedForThisFile < file.size) {
            overallLoaded += file.size - lastLoadedForThisFile;
          }

          emitProgress(file, file.size, file.size);
        }

        logger.info(`Uploaded file successfully: ${file.s3Key}`);
        uploaded = true;
      } catch (error) {
        logger.error(
          `Failed to upload ${file.s3Key} on attempt ${attempt}/${MAX_RETRIES}:`,
          error,
        );

        const canRetry = attempt < MAX_RETRIES && isRetriableUploadError(error);

        if (!canRetry) {
          throw error;
        }

        logger.warn(`Retrying upload for ${file.s3Key} after transient failure...`);
        await sleep(500 * attempt);
      }
    }
  }

  logger.info(`Folder upload completed successfully: ${folderPath}`);
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
  let baseName = fileName.toLowerCase();

  if (baseName.endsWith(".gz")) {
    contentEncoding = "gzip";
    baseName = baseName.slice(0, -3);
  } else if (baseName.endsWith(".br")) {
    contentEncoding = "br";
    baseName = baseName.slice(0, -3);
  }

  let contentType: string | undefined;

  if (baseName.endsWith(".wasm")) {
    contentType = "application/wasm";
  } else if (baseName.endsWith(".js")) {
    contentType = "application/javascript; charset=utf-8";
  } else if (baseName.endsWith(".html")) {
    contentType = "text/html; charset=utf-8";
  } else if (baseName.endsWith(".css")) {
    contentType = "text/css; charset=utf-8";
  } else if (baseName.endsWith(".json")) {
    contentType = "application/json; charset=utf-8";
  } else if (baseName.endsWith(".data")) {
    contentType = "application/octet-stream";
  } else if (baseName.endsWith(".png")) {
    contentType = "image/png";
  } else if (baseName.endsWith(".jpg") || baseName.endsWith(".jpeg")) {
    contentType = "image/jpeg";
  } else if (baseName.endsWith(".svg")) {
    contentType = "image/svg+xml";
  } else if (baseName.endsWith(".ico")) {
    contentType = "image/x-icon";
  } else if (baseName.endsWith(".unityweb")) {
    contentType = "application/octet-stream";
  }

  return {
    ContentType: contentType,
    ContentEncoding: contentEncoding,
  };
}

export async function deleteS3Prefix(prefixRaw: string): Promise<number> {
  const bucket = process.env.AWS_S3_BUCKET!;
  const prefix = prefixRaw.trim().replace(/^\/+/, ""); // remove leading /

  let continuationToken: string | undefined;
  let totalDeleted = 0;

  logger.info(`Starting deletion for S3 prefix: "${prefix}" in bucket: "${bucket}"`);
try{
  while (true) {
    const listRes = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    const objects = (listRes.Contents || [])
      .map((o) => o.Key)
      .filter((k): k is string => Boolean(k));

    logger.info(`Found ${objects.length} objects to delete for prefix: "${prefix}"`);

    if (objects.length === 0) {
      break;
    }

    const deleteRes = await s3.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: objects.map((Key) => ({ Key })),
          Quiet: false, // important for debugging
        },
      }),
    );

    if (deleteRes.Errors && deleteRes.Errors.length > 0) {
      logger.error(
        `S3 delete had errors for prefix "${prefix}": ${deleteRes.Errors.map(
          (e) => `${e.Key}:${e.Code}`,
        ).join(", ")}`,
      );
      const msg = deleteRes.Errors.map((e) => `${e.Key}:${e.Code}`).join(", ");
      throw new S3PrefixDeleteError(prefix, msg);
    }

    const deletedNow = deleteRes.Deleted?.length ?? 0;
    totalDeleted += deletedNow;

    logger.info(`Deleted ${deletedNow} objects in this batch for prefix: "${prefix}"`);

    if (!listRes.IsTruncated) {
      break;
    }

    continuationToken = listRes.NextContinuationToken;
  }

  // Verify remaining objects
  const verifyRes = await s3.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      MaxKeys: 5,
    }),
  );

  const remaining = verifyRes.KeyCount ?? 0;
  logger.info(`Finished deletion for prefix "${prefix}". totalDeleted=${totalDeleted}, remaining=${remaining}`);

  if (remaining > 0) {
    const sample = (verifyRes.Contents || []).slice(0, 5).map((o) => o.Key).join(", ");
    logger.warn(`Some objects still remain under prefix "${prefix}". Sample: ${sample}`);
  }

  return totalDeleted;
} catch (err: any) {
  if (err instanceof S3PrefixDeleteError) throw err;
  throw new S3PrefixDeleteError(prefix, err?.message ?? "Unknown error");
}
}