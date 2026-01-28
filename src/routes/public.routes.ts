import { Router } from "express";
import { redirectToActiveVersion } from "../controllers/public.controller";

const router = Router();

router.get("/:projectSlug/:envSlug", redirectToActiveVersion);

export default router;
