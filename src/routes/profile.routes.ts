import { Router } from "express";
import { requireAuth } from "../middlewares/authJwt";
import {
    getProfile,
    updateProfile,
    updatePassword,
} from "../controllers/profile.controller";

const router = Router();

router.get("/", requireAuth, getProfile);
router.patch("/", requireAuth, updateProfile);
router.patch("/password", requireAuth, updatePassword);

export default router;