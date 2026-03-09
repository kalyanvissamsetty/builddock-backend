import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/authJwt";

import {
    listInvites,
    createInvite,
    resendInviteOtp,
} from "../controllers/admin.invites.controller";
import { listAllowedDomains, addAllowedDomain, deleteAllowedDomain, domainDeleteSummary } from "../controllers/admin.domains.controller";
import { Role } from "../generated/prisma/enums";

const router = Router();

router.use(requireAuth, requireRole([Role.ADMIN, Role.MANAGER]));

// domains
router.get("/allowed-domains", listAllowedDomains);
router.post("/allowed-domains", addAllowedDomain);
router.delete("/allowed-domains/:id", deleteAllowedDomain);
router.get("/allowed-domains/:id/summary", domainDeleteSummary);
// invites
router.get("/invites", listInvites);
router.post("/invites", createInvite);
router.post("/invites/:id/resend", resendInviteOtp);

export default router;