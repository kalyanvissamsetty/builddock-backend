import { NextFunction, Request, Response } from "express"
import { logger } from "../utils/logger";
import fs from "fs"
import path from "path"
import { uploadFolderToS3, deleteS3Prefix, uploadFolderToS3WithProgress } from "../services/s3Upload.service"
import prisma from "../lib/prisma"
import { invalidateCloudFront } from "../services/cloudfront.service";
import { getBaseCDNURL } from "../utils/conditionalRules";
import { execFile } from "child_process";
import { promisify } from "util";

function getAuthUserId(req: any): number | null {
  const id = req?.user?.id ?? null;
  return typeof id === "number" ? id : null;
}
export async function uploadBuild(req: Request, res: Response, next: NextFunction) {
  try {
    const { projectId, environmentId, versionId } = req.body;

    logger.info(`Upload build request: Project=${projectId}, Env=${environmentId}, Version=${versionId}`);
    const releaseNotesRaw = req.body.releaseNotes;
    const projectIdNum = Number(projectId);
    const environmentIdNum = Number(environmentId);
    const versionIdNum = Number(versionId);
    const file = req.file

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

    if (!file) {
      return next(new Error("ZIP file is required"));
    }

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

    validateUnityWebglBuild(extractDir);
    // await fs.
    //   createReadStream(zipPath)
    //   .pipe(unzipper.Extract({ path: extractDir }))
    //   .promise()
    // validateUnityWebglBuild(extractDir)
    logger.info(`Build extracted to ${extractDir}`);

    const s3KeyBase = `${project.slug}/${environment.slug}/${version.name}`;
    logger.info(`Uploading to S3: ${s3KeyBase}`);
    //await uploadFolderToS3(extractDir, s3KeyBase)
    await uploadFolderToS3WithProgress(extractDir, s3KeyBase, (progress) => {
      logger.info(
        `[${progress.overallPercent}%] Uploading ${progress.currentFile} (${progress.currentFilePercent}%)`,
      );
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
    if (version.s3Path != "" && version.s3Path != null) {
      await invalidateCloudFront([
        `/${project.slug}/${environment.slug}/${version.name}/*`,
      ]);
      logger.info(`CloudFront invalidated for ${s3KeyBase}`);
    }



    return res.status(200).json({
      success: true,
      publicUrl: getBaseCDNURL(req.headers.origin || req.headers.host) + s3KeyBase + "/index.html",
      message: "ZIP extracted successfully",
      extractedPath: extractDir,
      isThisVersionDefault: isFirstVersion || versionBeingUploaded?.isActive,
    });
  } catch (error: any) {
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