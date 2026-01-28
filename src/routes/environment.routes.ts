import { Router } from "express";
import { createEnvironment, getEnvironments } from "../controllers/environment.controller";
import verisonRoutes from "./version.routes"
const router = Router({ mergeParams: true })

router.get("/",getEnvironments)
router.post("/",createEnvironment)
router.use("/:environmentId/versions", verisonRoutes)
export default router