import { Router } from "express";
import {
  redirectToActiveVersion,
  openBuild,
} from "../controllers/public.controller";
import { requireAuth } from "../middlewares/authJwt";
import { requireBuildAccess } from "../middlewares/requireBuildAccess";

requireBuildAccess;

const router = Router();

router.get("/:projectSlug/:envSlug",requireAuth, redirectToActiveVersion);
router.get(
  "/:projectSlug/:envSlug/:versionName",
  requireAuth,
  requireBuildAccess,openBuild,
);
export default router;
