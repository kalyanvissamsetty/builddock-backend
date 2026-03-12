import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthedRequest } from "../middlewares/authJwt";
import { hashPassword, verifyPassword } from "../utils/password";
import { validatePassword } from "../utils/passwordRules";

export async function getProfile(req: AuthedRequest, res: Response) {
    const userId = req.user?.id;

    if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            passwordHash: true,
        },
    });

    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        hasPassword: !!user.passwordHash,
    });
}

export async function updateProfile(req: AuthedRequest, res: Response) {
    const userId = req.user?.id;
    const { name } = req.body;

    if (!userId) {
        return res.status(401).json({ message: "User not found" });
    }

    if (!name || typeof name !== "string") {
        return res.status(400).json({ message: "Name is required to update" });
    }

    const normalizedName = name.trim();

    if (normalizedName.length < 2 || normalizedName.length > 50) {
        return res.status(400).json({
            message: "Name must be between 2 and 50 characters",
        });
    }

    const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
            name: normalizedName,
        },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
        },
    });

    return res.status(200).json({
        message: "Profile updated successfully",
        user: updatedUser,
    });
}

export async function updatePassword(req: AuthedRequest, res: Response) {
    const userId = req.user?.id;
    const { oldPassword, newPassword } = req.body;

    if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    if (!newPassword || typeof newPassword !== "string") {
        return res.status(400).json({
            message: "New password is required",
        });
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
        return res.status(400).json({ message: passwordError });
    }

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            passwordHash: true,
        },
    });

    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }

    const hasPassword = !!user.passwordHash;

    if (hasPassword) {
        if (!oldPassword || typeof oldPassword !== "string") {
            return res.status(400).json({
                message: "Current password is required",
            });
        }

        const isValidOldPassword = await verifyPassword(
            oldPassword,
            user.passwordHash!
        );

        if (!isValidOldPassword) {
            return res.status(400).json({
                message: "Current password is incorrect",
            });
        }

        const isSameAsOld = await verifyPassword(newPassword, user.passwordHash!);

        if (isSameAsOld) {
            return res.status(400).json({
                message: "New password must be different from current password",
            });
        }
    }

    const newPasswordHash = await hashPassword(newPassword);

    await prisma.user.update({
        where: { id: userId },
        data: {
            passwordHash: newPasswordHash,
        },
    });

    return res.status(200).json({
        message: hasPassword
            ? "Password updated successfully"
            : "Password set successfully",
    });
}