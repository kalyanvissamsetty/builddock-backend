import {
  CloudFrontClient,
  CreateInvalidationCommand,
} from "@aws-sdk/client-cloudfront";

const client = new CloudFrontClient({
  region: "us-east-1", // CloudFront is global, MUST be us-east-1
});

export async function invalidateCloudFront(paths: string[]) {
  if (!paths.length) return;
  const validPaths = paths.filter(
    (p) => p && p.startsWith("/") && !p.includes("undefined")
  );

  if (!validPaths.length) {
    console.warn("No valid CloudFront paths to invalidate", paths);
    return;
  }
  const distributionId = process.env.CLOUDFRONT_DISTRIBUTION_ID;

  if (!distributionId) {
    throw new Error("CLOUDFRONT_DISTRIBUTION_ID not set");
  }

  const command = new CreateInvalidationCommand({
    DistributionId: distributionId,
    InvalidationBatch: {
      CallerReference: `builddock-${Date.now()}`,
      Paths: {
        Quantity: validPaths.length,
        Items: validPaths,
      },
    },
  });

  const res = await client.send(command);
  console.log(res)
}
