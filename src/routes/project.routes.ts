import { Router } from "express";
import { getProjects,createProject, deleteProject, projectDeleteSummary } from "../controllers/project.controller";  
import environmentRoutes from "./environment.routes";
import { requireAuth, requireRole } from "../middlewares/authJwt";
import { Role } from "../generated/prisma/enums";

const router = Router()

router.get(
  "/",
  requireAuth,
  requireRole([Role.ADMIN, Role.MANAGER]),
  getProjects,
);
router.post(
  "/",
  requireAuth,
  requireRole([Role.ADMIN, Role.MANAGER]),
  createProject,
);
router.use(
  "/:projectId/environments",
  requireAuth,
  requireRole([Role.ADMIN, Role.MANAGER]),
  environmentRoutes,
);

// delete summary for dialog
router.get(
  "/:id/summary",
  requireAuth,
  requireRole([Role.ADMIN, Role.MANAGER]),
  projectDeleteSummary,
);

// cascade delete project -> envs -> versions
router.delete(
  "/:id",
  requireAuth,
  requireRole([Role.ADMIN, Role.MANAGER]),
  deleteProject,
);
export default router