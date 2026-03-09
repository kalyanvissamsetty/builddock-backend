import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/authJwt";
import {
  assignViewerBuild,
  removeViewerBuild,
  listViewerBuilds,
  bulkAssignViewerAccess,
} from "../controllers/viewerAccess.controller";
import { Role } from "../generated/prisma/client"

const router = Router();

router.use(requireAuth);
router.use(requireRole([Role.ADMIN, Role.MANAGER]));

router.post("/", assignViewerBuild);
router.delete("/", removeViewerBuild);
router.get("/:userId", listViewerBuilds);
router.post("/bulk", bulkAssignViewerAccess);
export default router;