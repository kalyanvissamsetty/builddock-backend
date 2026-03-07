import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/authJwt";
import { getReleaseNotes, listMyBuilds } from "../controllers/viewer.controller";
import { Role } from "../generated/prisma/client"

const router = Router();

router.use(requireAuth);
router.use(requireRole([Role.VIEWER]));

router.get("/builds", listMyBuilds);
router.get("/builds/:versionId/release-notes", getReleaseNotes);
export default router;