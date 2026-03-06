import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/authJwt";
import { listMyBuilds } from "../controllers/viewer.controller";
import { Role } from "../generated/prisma/client"

const router = Router();

router.use(requireAuth);
router.use(requireRole([Role.VIEWER]));

router.get("/builds", listMyBuilds);

export default router;