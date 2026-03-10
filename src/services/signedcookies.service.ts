import type { Request, Response } from "express";
import { getSignedCookies } from "@aws-sdk/cloudfront-signer";
import { getBaseCDNURL, getBaseOriginDomain } from "../utils/conditionalRules";


function readPrivateKey(): string {
    const privateKey = Buffer.from(process.env.CLOUDFRONT_PRIVATE_KEY_PEM_B64!, "base64").toString("utf8");
    return privateKey
}

function cookieOpts(req: Request) {
    const secure = "true";
    const domain = getBaseOriginDomain(req.headers.origin || req.headers.host);
    const opts: any = {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
    };
    if (domain) opts.domain = domain;
    return opts;
}

export function setCloudFrontCookiesAndRedirect(
    req: Request,
    res: Response,
    s3Path: string,
) {
    const cdnBase = getBaseCDNURL(req.headers.origin || req.headers.host);
    const keyPairId = process.env.CLOUDFRONT_KEY_PAIR_ID;
    if (!keyPairId) throw new Error("CLOUDFRONT_KEY_PAIR_ID not configured");

    const ttlSeconds = Number(process.env.CLOUDFRONT_TTL_SECONDS ?? "7200");
    const expiresEpoch = Math.floor((Date.now() + ttlSeconds * 1000) / 1000);
    const expiresAt = new Date(expiresEpoch * 1000);

    const redirectUrl = `${cdnBase}${s3Path}/index.html`;
    //const resourcePattern = `${cdnBase}${s3Path}/*`;
    const resourcePattern = `${cdnBase}*`;

    const policy = JSON.stringify({
        Statement: [
            {
                Resource: resourcePattern,
                Condition: {
                    DateLessThan: { "AWS:EpochTime": expiresEpoch },
                },
            },
        ],
    });

    const signedCookies = getSignedCookies({
        keyPairId,
        privateKey: readPrivateKey(),
        policy,
    });

    const opts = cookieOpts(req);

    res.cookie("CloudFront-Policy", signedCookies["CloudFront-Policy"], {
        ...opts,
        expires: expiresAt,
    });
    res.cookie("CloudFront-Signature", signedCookies["CloudFront-Signature"], {
        ...opts,
        expires: expiresAt,
    });
    res.cookie("CloudFront-Key-Pair-Id", signedCookies["CloudFront-Key-Pair-Id"], {
        ...opts,
        expires: expiresAt,
    });

    // // Log for manual copy
    // console.log("CloudFront signed cookies generated:");
    // console.log("CloudFront-Policy=", signedCookies["CloudFront-Policy"]);
    // console.log("CloudFront-Signature=", signedCookies["CloudFront-Signature"]);
    // console.log("CloudFront-Key-Pair-Id=", signedCookies["CloudFront-Key-Pair-Id"]);
    // console.log("ExpiresAt=", expiresAt.toISOString());
    // console.log("ResourcePattern=", resourcePattern);
    // console.log("RedirectUrl=", redirectUrl);

    return res.redirect(302, redirectUrl);
}