import { Router } from "express";
import { activateVersion, createVersion, getVersions } from "../controllers/version.controller";

const router = Router({mergeParams:true})

router.get("/",getVersions)
router.post("/",createVersion)
router.post("/:versionId/activate", activateVersion);

export default router