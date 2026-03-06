import { Router } from "express"
import { deleteBuild, uploadBuild } from "../controllers/build.controller"
import { upload } from "../middlewares/upload.middleware"
import { requireAuth, requireRole } from "../middlewares/authJwt";
import { Role } from "../generated/prisma/client"

const router = Router()

router.post("/upload", requireAuth, requireRole([Role.ADMIN, Role.DEV]), upload.single("file"), uploadBuild)
router.post("/deleteBuild", requireAuth, requireRole([Role.ADMIN, Role.DEV]), deleteBuild)
export default router
