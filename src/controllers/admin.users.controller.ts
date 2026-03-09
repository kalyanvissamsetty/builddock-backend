import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { Role } from "../generated/prisma/enums";

// GET /api/admin/users
export async function listUsers(req: Request, res: Response) {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isEmailVerified: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  res.json(users);
}

export async function updateUserRole(req: Request, res: Response) {
  const userId = Number(req.params.id);
  const { role } = req.body;

  if (!Object.values(Role).includes(role)) {
    return res.status(400).json({ message: "Invalid role" });
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!targetUser) {
    return res.status(404).json({ message: "User not found" });
  }

  // HARD RULE: Admin role is immutable
  if (targetUser.role === Role.ADMIN) {
    return res.status(400).json({
      message: "Admin role cannot be changed",
    });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role },
    select: {
      id: true,
      email: true,
      role: true,
    },
  });

  res.json(updated);
}