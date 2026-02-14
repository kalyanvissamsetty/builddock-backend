import { Router } from "express";
import {
  redirectToActiveVersion,
  openBuild,
} from "../controllers/public.controller";
import { requireAuth, requireRole } from "../middlewares/auth";
import { requireBuildAccess } from "../middlewares/requireBuildAccess";

requireBuildAccess;
import { Role } from "../generated/prisma/client";

const router = Router();

router.get("/:projectSlug/:envSlug",requireAuth, redirectToActiveVersion);
router.get(
  "/:projectSlug/:envSlug/:versionName",
  requireAuth,
  requireBuildAccess,openBuild,
);
export default router;
