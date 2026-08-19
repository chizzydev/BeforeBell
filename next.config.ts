import type {
  NextConfig,
} from "next";


function readBuildEnvironment(
  name:
    string,
  fallback?:
    string,
): string {
  const value =
    process.env[name]
      ?.trim();

  if (value) {
    return value;
  }

  if (
    fallback !==
    undefined
  ) {
    return fallback;
  }

  throw new Error(
    `Missing required build environment variable: ${name}`,
  );
}


const beforeBellAwsRegion =
  readBuildEnvironment(
    "BEFOREBELL_AWS_REGION",
    process.env.AWS_REGION
      ?.trim() ||
      "us-east-1",
  );


const nextConfig:
  NextConfig = {
    env: {
      BEFOREBELL_AWS_REGION:
        beforeBellAwsRegion,

      BEFOREBELL_DYNAMODB_TABLE:
        readBuildEnvironment(
          "BEFOREBELL_DYNAMODB_TABLE",
        ),

      BEFOREBELL_AGENTCORE_RUNTIME_ARN:
        readBuildEnvironment(
          "BEFOREBELL_AGENTCORE_RUNTIME_ARN",
        ),

      BEFOREBELL_ENABLE_DEMO_MUTATIONS:
        readBuildEnvironment(
          "BEFOREBELL_ENABLE_DEMO_MUTATIONS",
          "false",
        ),
    },

    turbopack: {
      root:
        process.cwd(),
    },
  };


export default nextConfig;