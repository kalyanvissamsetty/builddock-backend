import { Router } from "express";
import {
  redirectToActiveVersion, openBuild
} from "../controllers/public.controller";
import { requireAuth } from "../middlewares/authJwt";
import { requireBuildAccess } from "../middlewares/requireBuildAccess";


const router = Router();
router.use(requireAuth)
router.get("/:projectSlug/:envSlug/:versionName", requireBuildAccess,openBuild);
router.get("/:projectSlug/:envSlug" ,redirectToActiveVersion);
export default router;
