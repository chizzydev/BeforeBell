import {
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";

import {
  DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";

import type {
  BeforeBellDynamoConfig,
} from "@/infrastructure/dynamodb/env";

export interface BeforeBellDynamoClients {
  serviceClient:
    DynamoDBClient;

  documentClient:
    DynamoDBDocumentClient;
}

export function createBeforeBellDynamoClients(
  config:
    BeforeBellDynamoConfig,
): BeforeBellDynamoClients {
  /**
   * No credentials are hard-coded here.
   *
   * In Node.js the AWS SDK resolves credentials through its normal
   * credential-provider chain.
   */
  const serviceClient =
    new DynamoDBClient({
      region:
        config.region,
    });

  const documentClient =
    DynamoDBDocumentClient.from(
      serviceClient,
      {
        marshallOptions: {
          /**
           * Our TypeScript domain types legitimately use optional fields.
           * Do not marshal undefined values into DynamoDB.
           */
          removeUndefinedValues:
            true,
        },
      },
    );

  return {
    serviceClient,
    documentClient,
  };
}