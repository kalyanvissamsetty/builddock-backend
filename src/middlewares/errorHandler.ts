import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

export function errorHandler(
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
){
    logger.error("Error - "+ err);
    return res.status(400).json({
        success: false,
        message: err.message || err
    })
}