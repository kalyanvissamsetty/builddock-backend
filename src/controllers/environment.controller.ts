import { Request, Response } from "express";
import prisma from "../lib/prisma";

export const getEnvironments = async(req:Request, res:Response)=>{
    const projectId = Number(req.params.projectId)

    if(isNaN(projectId)) return res.status(400).json({"message": "Invalid project ID"})

    const environments = await prisma.environment.findMany({
        where: {projectId},
        orderBy: {createdAt: "asc"}
    })
    res.json(environments)
}

export const createEnvironment = async(req: Request, res: Response)=>{
    const projectId = Number(req.params.projectId)
    if(isNaN(projectId)) return res.status(400).json({"message": "Invalid project ID: "+req.baseUrl})

    const {name, slug} = req.body

    if(!name || !slug) return res.status(400).json({"message":"Name or slug is missing!"})
    
    const environment = await prisma.environment.create({
        data:{
            name,
            slug,
            projectId
        }
    })
    res.status(200).json(environment)
}