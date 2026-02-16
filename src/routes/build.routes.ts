import { Router } from "express"
import { uploadBuild } from "../controllers/build.controller"
import { upload } from "../middlewares/upload.middleware"
import { requireAuth, requireRole } from "../middlewares/authJwt";
import { Role } from "../generated/prisma/client"

const router = Router()

router.post("/upload", requireAuth, requireRole([Role.ADMIN, Role.DEV]), upload.single("file"), uploadBuild)

export default router
