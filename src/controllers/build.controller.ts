import { NextFunction, Request, Response } from "express"
import fs from "fs"
import path from "path"
import unzipper from "unzipper"
import {uploadFolderToS3} from "../services/s3Upload.service"
import prisma from "../lib/prisma"
import { invalidateCloudFront } from "../services/cloudfront.service";

export async function uploadBuild(req: Request, res: Response, next: NextFunction) {
  try {
    const { projectId, environmentId, versionId } = req.body;

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
    const zipBaseName = path.basename(zipPath,".zip");

    const extractDir = path.join(
        "tmp",
        "extracted",
        zipBaseName
    )

    fs.mkdirSync(extractDir, {recursive: true});

    await fs.
        createReadStream(zipPath)
        .pipe(unzipper.Extract({path: extractDir}))
        .promise()
    validateUnityWebglBuild(extractDir)
    const s3KeyBase = `${project.slug}/${environment.slug}/${version.name}`;
    await uploadFolderToS3(extractDir, s3KeyBase)
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

  if(version.s3Path != "" && version.s3Path != null ){
      await invalidateCloudFront([
        `/${project.slug}/${environment.slug}/${version.name}/*`,
      ]);
  }



    return res.status(200).json({
      success: true,
      publicUrl: process.env.STATIC_BASE_URL+s3KeyBase+"/index.html",
      message: "ZIP extracted successfully",
      extractedPath: extractDir,
      isThisVersionDefault: isFirstVersion || versionBeingUploaded?.isActive,
    });
  } catch (error) {
    console.error(error)
    next(error)
  }
}


function validateUnityWebglBuild(extractDir: string){
    const idxHTMLPath = path.join(extractDir,'index.html')
    const buildFolderPath = path.join(extractDir,"Build")

    const hadHTML = fs.existsSync(idxHTMLPath);

    const hadBuild = fs.existsSync(buildFolderPath) && fs.lstatSync(buildFolderPath).isDirectory();

    if(!hadBuild || !hadHTML){
        throw new Error("index.html or Build/ folder is missing")
    }
}

function cleanUpTempFiles(zipPath: string, extractDir: string){
    if(fs.existsSync(zipPath))
        fs.unlinkSync(zipPath)

    if(fs.existsSync(extractDir))
        fs.rmSync(extractDir,{recursive:true})
}