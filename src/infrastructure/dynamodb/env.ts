import {
  z,
} from "zod";


const DEFAULT_REGION =
  "us-east-1";


const optionalRegionSchema =
  z.string()
    .trim()
    .min(1)
    .optional();


const dynamoEnvironmentSchema =
  z.object({
    BEFOREBELL_AWS_REGION:
      optionalRegionSchema,

    AWS_REGION:
      optionalRegionSchema,

    BEFOREBELL_DYNAMODB_TABLE:
      z.string()
        .trim()
        .min(3)
        .max(255)
        .regex(
          /^[A-Za-z0-9_.-]+$/,
          "DynamoDB table name contains unsupported characters.",
        ),
  });


export interface BeforeBellDynamoConfig {
  region: string;
  tableName: string;
}


export function getBeforeBellDynamoConfig(
  env:
    NodeJS.ProcessEnv =
      process.env,
): BeforeBellDynamoConfig {
  const parsed =
    dynamoEnvironmentSchema.safeParse(
      env,
    );

  if (!parsed.success) {
    const details =
      parsed.error.issues
        .map(
          (issue) =>
            `${issue.path.join(".")}: ${issue.message}`,
        )
        .join("; ");

    throw new Error(
      `Invalid BeforeBell DynamoDB environment: ${details}`,
    );
  }

  return {
    region:
      parsed.data
        .BEFOREBELL_AWS_REGION ??
      parsed.data.AWS_REGION ??
      DEFAULT_REGION,

    tableName:
      parsed.data
        .BEFOREBELL_DYNAMODB_TABLE,
  };
}