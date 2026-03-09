import { Router } from "express"
import { deleteBuild, listAllBuilds, uploadBuild } from "../controllers/build.controller"
import { upload } from "../middlewares/upload.middleware"
import { requireAuth, requireRole } from "../middlewares/authJwt";
import { Role } from "../generated/prisma/client"

const router = Router()

router.post("/upload", requireAuth, requireRole([Role.ADMIN, Role.DEV]), upload.single("file"), uploadBuild)
router.post("/deleteBuild", requireAuth, requireRole([Role.ADMIN, Role.DEV]), deleteBuild)

router.get(
    "/all",
    requireAuth,
    requireRole([Role.ADMIN, Role.DEV, Role.MANAGER]),
    listAllBuilds,
);
export default router
