import { Request,Response } from "express";
import prisma from "../lib/prisma";
import { invalidateCloudFront } from "../services/cloudfront.service";
export const createVersion = async (req:Request, res:Response)=>{
    const environmentId = Number(req.params.environmentId)

    if(isNaN(environmentId)) return res.status(400).json({"message": "Environment ID are Invalid"})
    
    const {name} = req.body;

    if(!name) return res.status(400).json({"message":"Version name is required"})

    const version = await prisma.version.create({
        data:{
            name,
            environmentId,
            s3Path:"",
        }
    })
    return res.status(201).json(version)
}

export const getVersions = async (req:Request, res:Response)=>{
    const environmentId = Number(req.params.environmentId)

    if(isNaN(environmentId)) return res.status(400).json({"message": "Environment ID are Invalid"})

    const versions = await prisma.version.findMany({
        where: {environmentId},
        orderBy:{createdAt:"desc"}
    })

    res.json(versions)
}

export const activateVersion = async (req: Request, res: Response) => {
  const versionId = Number(req.params.versionId);

  if (isNaN(versionId)) {
    return res.status(400).json({ message: "Invalid versionId" });
  }

  // 1. Get the version (to know environmentId)
  const version = await prisma.version.findUnique({
    where: { id: versionId },
  });

  if (!version) {
    return res.status(404).json({ message: "Version not found" });
  }

  // 2. Transaction: deactivate others, activate this one
  await prisma.$transaction([
    prisma.version.updateMany({
      where: {
        environmentId: version.environmentId,
        isActive: true,
      },
      data: { isActive: false },
    }),

    prisma.version.update({
      where: { id: versionId },
      data: { isActive: true },
    }),
  ]);

  const env = await prisma.environment.findFirst({
    where: { id: version.environmentId },
  });

  const project = await prisma.project.findFirst({
    where: { id: env?.projectId },
  });
  await invalidateCloudFront([`/${project?.slug}/${env?.slug}/*`]); 
  res.status(204).json({ message: "Version activated successfully" });
};
