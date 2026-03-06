import { Router } from "express";
import { getProjects,createProject, deleteProject, projectDeleteSummary } from "../controllers/project.controller";  
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

// delete summary for dialog
router.get(
  "/:id/summary",
  requireAuth,
  requireRole(["ADMIN"]),
  projectDeleteSummary,
);

// cascade delete project -> envs -> versions
router.delete(
  "/:id",
  requireAuth,
  requireRole(["ADMIN"]),
  deleteProject,
);
export default router