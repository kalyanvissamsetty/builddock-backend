import { Client } from "@microsoft/microsoft-graph-client";
import { ClientSecretCredential } from "@azure/identity";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";

let graphClient: Client | null = null;

export function getGraphClient() {
    if (graphClient) return graphClient;

    const { TENANT_ID, CLIENT_ID, CLIENT_SECRET } = process.env;
    if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
        throw new Error("Missing TENANT_ID/CLIENT_ID/CLIENT_SECRET");
    }

    const credential = new ClientSecretCredential(TENANT_ID, CLIENT_ID, CLIENT_SECRET);
    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
        scopes: ["https://graph.microsoft.com/.default"],
    });

    graphClient = Client.initWithMiddleware({ authProvider });
    return graphClient;
}

export async function runWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let i = 0;

    async function runWorker() {
        while (i < items.length) {
            const idx = i++;
            results[idx] = await worker(items[idx], idx);
        }
    }

    const workers = Array.from({ length: Math.max(1, concurrency) }, () => runWorker());
    await Promise.all(workers);
    return results;
}

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

function getRetryAfterMs(err: any) {
    const h = err?.response?.headers;
    const retryAfter =
        (typeof h?.get === "function" && h.get("Retry-After")) ||
        err?.headers?.["retry-after"] ||
        err?.body?.error?.innerError?.["retry-after"];

    const sec = Number(retryAfter);
    if (Number.isFinite(sec) && sec > 0) return sec * 1000;

    return null;
}

export async function withGraphRetry<T>(fn: () => Promise<T>, maxAttempts = 5): Promise<T> {
    let attempt = 0;
    let lastErr: any;

    while (attempt < maxAttempts) {
        attempt++;
        try {
            return await fn();
        } catch (err: any) {
            lastErr = err;
            const status = err?.statusCode || err?.status;

            // 429 throttle or transient server errors
            if (status === 429 || status === 503 || status === 502) {
                const retryMs = getRetryAfterMs(err) ?? 500 * attempt;
                await sleep(retryMs);
                continue;
            }

            throw err;
        }
    }

    throw lastErr;
}