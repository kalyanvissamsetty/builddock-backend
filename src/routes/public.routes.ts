import { Router } from "express";
import {
  redirectToActiveVersion, openBuild
} from "../controllers/public.controller";
import { requireAuth } from "../middlewares/authJwt";
import { requireBuildAccess } from "../middlewares/requireBuildAccess";


const router = Router();
router.use(requireAuth)
router.use(requireBuildAccess)
router.get("/:projectSlug/:envSlug", redirectToActiveVersion);
router.get("/:projectSlug/:envSlug/:versionName", openBuild);
export default router;
