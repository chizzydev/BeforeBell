import {
  z,
} from "zod";

const dynamoEnvironmentSchema =
  z.object({
    AWS_REGION:
      z.string()
        .trim()
        .min(1),

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
      parsed.data.AWS_REGION,

    tableName:
      parsed.data
        .BEFOREBELL_DYNAMODB_TABLE,
  };
}