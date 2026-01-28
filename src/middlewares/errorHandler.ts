import { Request, Response, NextFunction } from "express";

export function errorHandler(
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
){
    console.error("Error - "+ err);
    return res.status(400).json({
        success: false,
        message: err.message || err
    })
}