
import { Request, Response } from "express"; 
type ProgressEventPayload = {
    type: "status" | "progress" | "completed" | "error";
    message?: string;
    currentFile?: string;
    currentFilePercent?: number;
    overallPercent?: number;
};

const sseClients = new Map<string, Response>();

export function addSseClient(uploadId: string, res: Response) {
    sseClients.set(uploadId, res);
}

export function removeSseClient(uploadId: string) {
    sseClients.delete(uploadId);
}

export function sendSseEvent(uploadId: string, payload: ProgressEventPayload) {
    const client = sseClients.get(uploadId);
    if (!client) return;

    client.write(`data: ${JSON.stringify(payload)}\n\n`);
    (client as any).flush?.();
}

export function subscribeUploadProgress(req: Request, res: Response) {
    const { uploadId } = req.params;
    if (typeof uploadId !== "string") {
        throw new Error("Invalid uploadId");
    }
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();
    
    addSseClient(uploadId, res);

    res.write(`data: ${JSON.stringify({ type: "status", message: "Connected" })}\n\n`);

    const keepAlive = setInterval(() => {
        res.write(": ping\n\n");
        (res as any).flush?.();
    }, 20000);
    
    req.on("close", () => {
        clearInterval(keepAlive);
        removeSseClient(uploadId);
        res.end();
    });
}