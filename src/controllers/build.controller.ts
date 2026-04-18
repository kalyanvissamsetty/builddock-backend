import { NextFunction, Request, Response } from "express"
import { logger } from "../utils/logger";
import fs from "fs"
import path from "path"   
import {  deleteS3Prefix, uploadFolderToS3WithProgress } from "../services/s3Upload.service"  
import prisma from "../lib/prisma"
import { invalidateCloudFront } from "../services/cloudfront.service";
import { getBaseCDNURL } from "../utils/conditionalRules";
import { execFile } from "child_process";
import { promisify } from "util";
import { sendSseEvent } from "../services/progressStore.service";

function getAuthUserId(req: any): number | null {
  const id = req?.user?.id ?? null;
  return typeof id === "number" ? id : null;
}

function resolveUnityBuildRoot(extractDir: string) {
  const indexAtRoot = path.join(extractDir, "index.html");
  if (fs.existsSync(indexAtRoot)) return extractDir;

  const entries = fs.readdirSync(extractDir, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

  if (dirs.length === 1) {
    const candidate = path.join(extractDir, dirs[0]);
    const candidateIndex = path.join(candidate, "index.html");
    if (fs.existsSync(candidateIndex)) return candidate;
  }

  return extractDir; // validation will throw if incorrect
}


export async function uploadBuild(req: Request, res: Response, next: NextFunction) {
  const {uploadId} = req.body;
  try {
    const { projectId, environmentId, versionId } = req.body;

    logger.info(`Upload build request: Project=${projectId}, Env=${environmentId}, Version=${versionId}`);
    const releaseNotesRaw = req.body.releaseNotes;
    const projectIdNum = Number(projectId);
    const environmentIdNum = Number(environmentId);
    const versionIdNum = Number(versionId);
    const file = req.file

    if (!projectIdNum || !environmentIdNum || !versionIdNum) {
      return res.status(400).json({ message: "Project or Environment or version is missing" });
    }
    if (!uploadId) {
      return res.status(400).json({ message: "uploadId is required" });
    }
    const project = await prisma.project.findUnique({
      where: { id: projectIdNum },
    });

    const environment = await prisma.environment.findUnique({
      where: { id: environmentIdNum },
    });

    const version = await prisma.version.findUnique({
      where: { id: versionIdNum },
    });

    if (!project || !environment || !version) {
      return res.status(400).json({ message: "Invalid project/env/version" });
    }

    if (!file) {
      return res.status(400).json({ message: "ZIP file is required" });
    }

    sendSseEvent(uploadId, {
      type: "status",
      message: "Validating Unity WebGL build",
    });
    const zipPath = file.path;
    const zipBaseName = path.basename(zipPath, ".zip");

    const extractDir = path.join(
      "tmp",
      "extracted",
      zipBaseName
    )

    fs.mkdirSync(extractDir, { recursive: true });
    const execFileAsync = promisify(execFile);
    await execFileAsync("unzip", ["-o", zipPath, "-d", extractDir]);

    logger.info(`Build extracted to ${extractDir}`);
    logFolderTree(extractDir, "AFTER_UNZIP");

    const buildRoot = resolveUnityBuildRoot(extractDir);
    logger.info(`Resolved Unity build root: ${buildRoot}`);
    logFolderTree(buildRoot, "BUILD_ROOT");

    validateUnityWebglBuild(buildRoot);
    
    logger.info(`Build extracted to ${extractDir}`);
    sendSseEvent(uploadId, {
      type: "status",
      message: "Build extracted & validated successfully",
    });
    const s3KeyBase = `${project.slug}/${environment.slug}/${version.name}`;
    logger.info(`Uploading to S3: ${s3KeyBase}`);
    sendSseEvent(uploadId, {
      type: "status",
      message: "Started Uploading to S3",
    });
    //await uploadFolderToS3(extractDir, s3KeyBase)
    await uploadFolderToS3WithProgress(buildRoot, s3KeyBase, (progress) => {
      logger.info(
        `[${progress.overallPercent}%] Uploading ${progress.currentFile} (${progress.currentFilePercent}%)`,
      );
      sendSseEvent(uploadId, {
        type: "progress",
        currentFile: progress.currentFile,
        currentFilePercent: progress.currentFilePercent,
        overallPercent: progress.overallPercent,
        message: `Uploading ${progress.currentFile}`,
      });
    });
    logger.info(`Upload to S3 completed: ${s3KeyBase}`);
    cleanUpTempFiles(zipPath, extractDir);
    const versions = await prisma.version.findMany({
      where: { environmentId: environmentIdNum },
    });

    const isFirstVersion = versions.length === 1;

    if (isFirstVersion) {
      await prisma.version.update({
        where: { id: versionIdNum },
        data: { isActive: true },
      });
    }

    const versionBeingUploaded = await prisma.version.update({
      where: { id: versionIdNum },
      data: { s3Path: s3KeyBase },
    });
    if (releaseNotesRaw !== null) {
      await prisma.version.update({
        where: { id: versionIdNum },
        data: {
          releaseNotes: releaseNotesRaw,
          releaseNotesUpdatedAt: new Date(),
          lastUploadedAt: new Date(),
          lastUploadedByUserId: getAuthUserId(req),
        },
      });
    }
    try{
      await invalidateCloudFront([
        `/${project.slug}/${environment.slug}/${versionBeingUploaded.name}/*`,
      ]);
      logger.info(`CloudFront invalidated for ${s3KeyBase}`);
    }catch(error){
      logger.error("Error invalidating CloudFront", error);
    }

    sendSseEvent(uploadId, {
      type: "completed",
      message: "Build uploaded successfully",
      overallPercent: 100,
    });
    return res.status(200).json({
      success: true,
      publicUrl: getBaseCDNURL(req.headers.origin || req.headers.host) + s3KeyBase + "/index.html",
      message: "ZIP extracted successfully",
      extractedPath: extractDir,
      isThisVersionDefault: isFirstVersion || versionBeingUploaded?.isActive,
    });
  } catch (error: any) {
    sendSseEvent(uploadId, {
      type: "error",
      message: error.message || "Upload failed",
    });
    logger.error("Error uploading build", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    })
    //next(error)
  }
}


function validateUnityWebglBuild(extractDir: string) {
  const idxHTMLPath = path.join(extractDir, 'index.html')
  const buildFolderPath = path.join(extractDir, "Build")

  const hadHTML = fs.existsSync(idxHTMLPath);

  const hadBuild = fs.existsSync(buildFolderPath) && fs.lstatSync(buildFolderPath).isDirectory();

  if (!hadBuild || !hadHTML) {
    throw new Error("index.html or Build/ folder is missing")
  }
}
function logFolderTree(dir: string, label: string, baseDir: string = dir) {
  if (!fs.existsSync(dir)) {
    logger.warn(`[${label}] Directory does not exist: ${dir}`);
    return;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, "/");

    if (entry.isDirectory()) {
      logger.info(`[${label}] DIR  : ${relativePath}`);
      logFolderTree(fullPath, label, baseDir);
    } else {
      logger.info(`[${label}] FILE : ${relativePath}`);
    }
  }
}
function cleanUpTempFiles(zipPath: string, extractDir: string) {
  if (fs.existsSync(zipPath))
    fs.unlinkSync(zipPath)

  if (fs.existsSync(extractDir))
    fs.rmSync(extractDir, { recursive: true })
}

export async function deleteBuild(req: Request, res: Response, next: NextFunction) {
  try {
    const { projectId, environmentId, versionId } = req.body;

    logger.info(`Delete build request: Project=${projectId}, Env=${environmentId}, Version=${versionId}`);

    const projectIdNum = Number(projectId);
    const environmentIdNum = Number(environmentId);
    const versionIdNum = Number(versionId);

    if (!projectIdNum || !environmentIdNum || !versionIdNum) {
      return next(new Error("Project or Environment or version is missing"));
    }
    const project = await prisma.project.findUnique({
      where: { id: projectIdNum },
    });

    const environment = await prisma.environment.findUnique({
      where: { id: environmentIdNum },
    });

    const version = await prisma.version.findUnique({
      where: { id: versionIdNum },
    });

    if (!project || !environment || !version) {
      return res.status(400).json({ message: "Invalid project/env/version" });
    }

    const s3KeyBase = `${project.slug}/${environment.slug}/${version.name}`;
    logger.info(`Deleting from S3: ${s3KeyBase}`);
    const itemsDeleted = await deleteS3Prefix(s3KeyBase)
    if (itemsDeleted == 0) {
      logger.warn(`No items found in S3 for ${s3KeyBase}`);
      return res.status(400).json({ message: "Can't delete Build as no objects found" })
    }
    logger.info(`Delete from S3 completed: ${s3KeyBase}`);
    await prisma.version.delete({
      where: { id: versionIdNum }
    });
    return res.status(200).json({
      success: true,
      itemsDeleted,
      message: "Build deleted successfully",
    });
  } catch (error) {
    logger.error("Error deleting build", error);
    next(error)
  }
}


export async function listAllBuilds(req: Request, res: Response) {
  const builds = await prisma.version.findMany({
    include: {
      lastUploadedByUser: {
        select: { id: true, name: true, email: true },
      },
      environment: {
        include: {
          project: true,
        },
      },
    },
    orderBy: [
      { lastUploadedAt: "desc" },
      { createdAt: "desc" },
    ],
  });

  res.json(builds);
}