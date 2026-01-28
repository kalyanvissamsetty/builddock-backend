import { Router } from "express";
import { getProjects,createProject } from "../controllers/project.controller";  
import environmentRoutes from "./environment.routes";
const router = Router()

router.get("/", getProjects)
router.post("/",createProject)
router.use("/:projectId/environments",environmentRoutes)
export default router