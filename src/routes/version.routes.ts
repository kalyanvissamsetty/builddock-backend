import { Router } from "express";
import { activateVersion, createVersion, getVersions } from "../controllers/version.controller";
import { requireAuth, requireRole } from "../middlewares/authJwt";
import { Role } from "../generated/prisma/enums";

const router = Router({mergeParams:true})

router.get(
  "/",
  requireAuth,
  requireRole([Role.ADMIN, Role.DEV]),
  getVersions,
);
router.post(
  "/",
  requireAuth,
  requireRole([Role.ADMIN, Role.DEV]),
  createVersion,
);
router.post(
  "/:versionId/activate",
  requireAuth,
  requireRole([Role.ADMIN, Role.DEV]),
  activateVersion,
);

export default router