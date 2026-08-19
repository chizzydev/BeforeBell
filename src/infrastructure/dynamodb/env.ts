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
  env?: NodeJS.ProcessEnv,
): BeforeBellDynamoConfig {
  const source =
    env ?? {
      BEFOREBELL_AWS_REGION:
        process.env
          .BEFOREBELL_AWS_REGION,

      AWS_REGION:
        process.env.AWS_REGION,

      BEFOREBELL_DYNAMODB_TABLE:
        process.env
          .BEFOREBELL_DYNAMODB_TABLE,
    };

  const parsed =
    dynamoEnvironmentSchema.safeParse(
      source,
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