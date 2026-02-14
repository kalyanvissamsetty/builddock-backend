import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import { listUsers, updateUserRole } from "../controllers/admin.users.controller";
import { Role } from "../generated/prisma/client"

const router = Router();

router.use(requireAuth);
router.use(requireRole([Role.ADMIN]));

router.get("/", listUsers);
router.patch("/:id/role", updateUserRole);

export default router;