import { Router } from "express";
import {
  createEnvironment,
  getEnvironments,
} from "../controllers/environment.controller";
import verisonRoutes from "./version.routes";
import { requireAuth, requireRole } from "../middlewares/authJwt";
import { Role } from "../generated/prisma/client";

const router = Router({ mergeParams: true });

router.get(
  "/",
  requireAuth,
  requireRole([Role.ADMIN, Role.DEV, Role.QA, Role.VIEWER]),
  getEnvironments,
);
router.post(
  "/",
  requireAuth,
  requireRole([Role.ADMIN, Role.DEV, Role.QA, Role.VIEWER]),
  createEnvironment,
);
router.use(
  "/:environmentId/versions",
  requireAuth,
  requireRole([Role.ADMIN, Role.DEV, Role.QA, Role.VIEWER]),
  verisonRoutes,
);
export default router;
