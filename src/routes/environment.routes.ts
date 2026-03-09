import { Router } from "express";
import {
  createEnvironment,
  deleteEnvironment,
  environmentDeleteSummary,
  getEnvironments,
} from "../controllers/environment.controller";
import verisonRoutes from "./version.routes";
import { requireAuth, requireRole } from "../middlewares/authJwt";
import { Role } from "../generated/prisma/enums";

const router = Router({ mergeParams: true });

router.get(
  "/",
  requireAuth,
  requireRole([Role.ADMIN, Role.DEV, Role.MANAGER]), 
  getEnvironments,
);
router.post(
  "/",
  requireAuth,
  requireRole([Role.ADMIN, Role.DEV]),
  createEnvironment,
);
router.use(
  "/:environmentId/versions",
  requireAuth,
  requireRole([Role.ADMIN, Role.DEV, Role.MANAGER]),
  verisonRoutes,
);

// delete summary for dialog
router.get(
  "/:envId/summary",
  requireAuth,
  requireRole([Role.ADMIN, Role.DEV]),
  environmentDeleteSummary,
);

// cascade delete env, versions
router.delete(
  "/environments/:envId",
  requireAuth,
  requireRole([Role.ADMIN, Role.DEV]),
  deleteEnvironment,
);
export default router;
