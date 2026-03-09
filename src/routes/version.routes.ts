import { Router } from "express";
import { activateVersion, createVersion, getVersions } from "../controllers/version.controller";
import { requireAuth, requireRole } from "../middlewares/authJwt";
import { Role } from "../generated/prisma/enums";

const router = Router({mergeParams:true})

router.get(
  "/",
  requireAuth,
  requireRole([Role.ADMIN, Role.DEV, Role.QA]),
  getVersions,
);
router.post(
  "/",
  requireAuth,
  requireRole([Role.ADMIN, Role.DEV, Role.QA]),
  createVersion,
);
router.post(
  "/:versionId/activate",
  requireAuth,
  requireRole([Role.ADMIN, Role.DEV, Role.QA]),
  activateVersion,
);

export default router