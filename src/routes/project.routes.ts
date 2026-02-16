import { Router } from "express";
import { getProjects,createProject } from "../controllers/project.controller";  
import environmentRoutes from "./environment.routes";
import { requireAuth, requireRole } from "../middlewares/authJwt";
import { Role } from "../generated/prisma/client";

const router = Router()

router.get(
  "/",
  requireAuth,
  requireRole([Role.ADMIN, Role.DEV, Role.QA, Role.VIEWER]),
  getProjects,
);
router.post(
  "/",
  requireAuth,
  requireRole([Role.ADMIN, Role.DEV, Role.QA, Role.VIEWER]),
  createProject,
);
router.use(
  "/:projectId/environments",
  requireAuth,
  requireRole([Role.ADMIN, Role.DEV, Role.QA, Role.VIEWER]),
  environmentRoutes,
);
export default router