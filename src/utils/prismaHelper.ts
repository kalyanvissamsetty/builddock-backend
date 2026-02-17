import { Prisma } from "../../src/generated/prisma/client";

export function isUniqueConstraintError(
    error: unknown,
    constraint?: string
) {
    return (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        (!constraint ||
            (error.meta?.target as string[])?.includes(constraint))
    );
}

export function isRecordNotFound(error: unknown) {
    return (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
    );
}