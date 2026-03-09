import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/authJwt";
import { listUsers, updateUserRole } from "../controllers/admin.users.controller";
import { Role } from "../generated/prisma/client"

const router = Router();

router.use(requireAuth);
router.use(requireRole([Role.ADMIN, Role.MANAGER]));

router.get("/", listUsers);
router.patch("/:id/role", updateUserRole);

export default router;