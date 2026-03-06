import { Router } from "express";
import { signup, login, me, logout, refresh } from "../controllers/auth.controller";
import { requireAuth } from "../middlewares/authJwt";
import { verifyOtp, resendOtp, requestOtp } from "../controllers/otp.controller";

const router = Router();

router.post("/signup", signup);
// router.get("/verify-email", verifyEmail);
router.post("/login", login);
router.post("/refresh", refresh);
router.get("/me", requireAuth, me);
router.post("/logout", logout);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);
router.post("/request-otp", requestOtp);
export default router;
