import { Router } from "express";
import { signup, login, me } from "../controllers/auth.controller";
import { requireAuth } from "../middlewares/auth";
import { verifyOtp, resendOtp } from "../controllers/otp.controller";

const router = Router();

router.post("/signup", signup);
// router.get("/verify-email", verifyEmail);
router.post("/login", login);
router.get("/me", requireAuth, me);
router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("builddock.sid");
    res.json({ ok: true });
  });
});
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);
export default router;
