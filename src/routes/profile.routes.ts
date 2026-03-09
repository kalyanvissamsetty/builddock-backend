import { Router } from "express";
import { requireAuth } from "../middlewares/authJwt";
import {
    getProfile,
    updateProfile,
    updatePassword,
} from "../controllers/profile.controller";

const router = Router();
router.use(requireAuth);
router.get("/", getProfile);
router.patch("/", updateProfile);
router.patch("/password", updatePassword);

export default router;