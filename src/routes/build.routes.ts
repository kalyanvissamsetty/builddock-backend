import { Router } from "express"
import { uploadBuild } from "../controllers/build.controller"
import { upload } from "../middlewares/upload.middleware"

const router = Router()

router.post("/upload", upload.single("file"), uploadBuild)

export default router
