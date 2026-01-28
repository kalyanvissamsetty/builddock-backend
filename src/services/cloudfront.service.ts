import {
  CloudFrontClient,
  CreateInvalidationCommand,
} from "@aws-sdk/client-cloudfront";

const client = new CloudFrontClient({
  region: "us-east-1", // CloudFront is global, MUST be us-east-1
});

export async function invalidateCloudFront(paths: string[]) {
  if (!paths.length) return;

  const distributionId = process.env.CLOUDFRONT_DISTRIBUTION_ID;

  if (!distributionId) {
    throw new Error("CLOUDFRONT_DISTRIBUTION_ID not set");
  }

  const command = new CreateInvalidationCommand({
    DistributionId: distributionId,
    InvalidationBatch: {
      CallerReference: `builddock-${Date.now()}`,
      Paths: {
        Quantity: paths.length,
        Items: paths,
      },
    },
  });

  await client.send(command);
}
