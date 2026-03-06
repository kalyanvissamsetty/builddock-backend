import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/authJwt";
import {
  assignViewerBuild,
  removeViewerBuild,
  listViewerBuilds,
} from "../controllers/viewerAccess.controller";
import { Role } from "../generated/prisma/client"

const router = Router();

router.use(requireAuth);
router.use(requireRole([Role.ADMIN]));

router.post("/", assignViewerBuild);
router.delete("/", removeViewerBuild);
router.get("/:userId", listViewerBuilds);

export default router;