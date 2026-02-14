import { Router } from "express";
import { activateVersion, createVersion, getVersions } from "../controllers/version.controller";
import { requireAuth, requireRole } from "../middlewares/auth";
import { Role } from "../generated/prisma/client";

const router = Router({mergeParams:true})

router.get(
  "/",
  requireAuth,
  requireRole([Role.ADMIN, Role.DEV, Role.QA, Role.VIEWER]),
  getVersions,
);
router.post(
  "/",
  requireAuth,
  requireRole([Role.ADMIN, Role.DEV, Role.QA, Role.VIEWER]),
  createVersion,
);
router.post(
  "/:versionId/activate",
  requireAuth,
  requireRole([Role.ADMIN, Role.DEV, Role.QA, Role.VIEWER]),
  activateVersion,
);

export default router