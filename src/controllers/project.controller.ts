import { error } from "node:console"
import { logger } from "../utils/logger";
import prisma from "../lib/prisma"
import { Request,Response } from "express"

export const getProjects = async(req:Request, res:Response)=>{
    const projects = await prisma.project.findMany({
        orderBy:{createdAt : "desc"}
    })
    res.json(projects)
}

export const createProject = async(req:Request, res:Response)=>{
    const {name, slug} = req.body;

    if(!name || !slug)
        return res.status(400).json({message:"name or slug is missing"});

    const project = await prisma.project.create({
        data:{name,slug}
    })
    
    logger.info(`Project created: ${project.name} (${project.slug})`);

    res.status(201).json(project)
}