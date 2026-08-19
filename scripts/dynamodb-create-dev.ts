import {
  CreateTableCommand,
  DescribeTableCommand,
  type TableDescription,
  waitUntilTableExists,
} from "@aws-sdk/client-dynamodb";

import {
  config as loadEnvironment,
} from "dotenv";

import {
  createBeforeBellDynamoClients,
} from "../src/infrastructure/dynamodb/client";

import {
  getBeforeBellDynamoConfig,
} from "../src/infrastructure/dynamodb/env";

loadEnvironment({
  path:
    ".env.local",
});

const DEV_TABLE_NAME =
  "beforebell-dev";

async function describeTableIfExists(
  tableName: string,
  client:
    ReturnType<
      typeof createBeforeBellDynamoClients
    >["serviceClient"],
): Promise<
  TableDescription | undefined
> {
  try {
    const result =
      await client.send(
        new DescribeTableCommand({
          TableName:
            tableName,
        }),
      );

    return result.Table;
  } catch (error) {
    if (
      typeof error ===
        "object" &&
      error !== null &&
      "name" in error &&
      error.name ===
        "ResourceNotFoundException"
    ) {
      return undefined;
    }

    throw error;
  }
}

function assertTableShape(
  table:
    TableDescription,
): void {
  const partitionKey =
    table.KeySchema?.find(
      (item) =>
        item.KeyType ===
        "HASH",
    )?.AttributeName;

  const sortKey =
    table.KeySchema?.find(
      (item) =>
        item.KeyType ===
        "RANGE",
    )?.AttributeName;

  if (
    partitionKey !==
      "PK" ||
    sortKey !==
      "SK"
  ) {
    throw new Error(
      "Existing table does not have the required PK/SK primary key.",
    );
  }

  const gsi =
    table
      .GlobalSecondaryIndexes
      ?.find(
        (index) =>
          index.IndexName ===
          "GSI1",
      );

  if (!gsi) {
    throw new Error(
      "Existing table does not contain required GSI1.",
    );
  }

  const gsiPartitionKey =
    gsi.KeySchema?.find(
      (item) =>
        item.KeyType ===
        "HASH",
    )?.AttributeName;

  const gsiSortKey =
    gsi.KeySchema?.find(
      (item) =>
        item.KeyType ===
        "RANGE",
    )?.AttributeName;

  if (
    gsiPartitionKey !==
      "GSI1PK" ||
    gsiSortKey !==
      "GSI1SK"
  ) {
    throw new Error(
      "Existing GSI1 does not have the required GSI1PK/GSI1SK key schema.",
    );
  }
}

async function main() {
  const config =
    getBeforeBellDynamoConfig();

  /**
   * Hard guard against accidentally running this development bootstrap
   * script against a production table.
   */
  if (
    config.tableName !==
    DEV_TABLE_NAME
  ) {
    throw new Error(
      `Refusing to run dev table bootstrap for "${config.tableName}". Expected exactly "${DEV_TABLE_NAME}".`,
    );
  }

  const {
    serviceClient,
  } =
    createBeforeBellDynamoClients(
      config,
    );

  try {
    console.log(
      "\n=== BeforeBell DynamoDB Dev Bootstrap ===\n",
    );

    console.log(
      `Region: ${config.region}`,
    );

    console.log(
      `Table: ${config.tableName}`,
    );

    const existing =
      await describeTableIfExists(
        config.tableName,
        serviceClient,
      );

    if (existing) {
      console.log(
        `Existing table status: ${existing.TableStatus}`,
      );

      if (
        existing.TableStatus !==
        "ACTIVE"
      ) {
        console.log(
          "Waiting for existing table to become ACTIVE...",
        );

        await waitUntilTableExists(
          {
            client:
              serviceClient,

            maxWaitTime:
              180,
          },
          {
            TableName:
              config.tableName,
          },
        );
      }

      const current =
        await describeTableIfExists(
          config.tableName,
          serviceClient,
        );

      if (!current) {
        throw new Error(
          "Table disappeared while validating it.",
        );
      }

      assertTableShape(
        current,
      );

      console.log(
        "\nTable already exists with the expected BeforeBell schema. ✅",
      );

      return;
    }

    console.log(
      "\nCreating beforebell-dev...",
    );

    await serviceClient.send(
      new CreateTableCommand({
        TableName:
          config.tableName,

        BillingMode:
          "PAY_PER_REQUEST",

        AttributeDefinitions: [
          {
            AttributeName:
              "PK",

            AttributeType:
              "S",
          },
          {
            AttributeName:
              "SK",

            AttributeType:
              "S",
          },
          {
            AttributeName:
              "GSI1PK",

            AttributeType:
              "S",
          },
          {
            AttributeName:
              "GSI1SK",

            AttributeType:
              "S",
          },
        ],

        KeySchema: [
          {
            AttributeName:
              "PK",

            KeyType:
              "HASH",
          },
          {
            AttributeName:
              "SK",

            KeyType:
              "RANGE",
          },
        ],

        GlobalSecondaryIndexes: [
          {
            IndexName:
              "GSI1",

            KeySchema: [
              {
                AttributeName:
                  "GSI1PK",

                KeyType:
                  "HASH",
              },
              {
                AttributeName:
                  "GSI1SK",

                KeyType:
                  "RANGE",
              },
            ],

            Projection: {
              ProjectionType:
                "ALL",
            },
          },
        ],

        /**
         * Development only.
         * Production deletion protection will be enabled separately.
         */
        DeletionProtectionEnabled:
          false,

        Tags: [
          {
            Key:
              "Application",

            Value:
              "BeforeBell",
          },
          {
            Key:
              "Environment",

            Value:
              "development",
          },
        ],
      }),
    );

    console.log(
      "CreateTable accepted. Waiting for ACTIVE...",
    );

    await waitUntilTableExists(
      {
        client:
          serviceClient,

        maxWaitTime:
          180,
      },
      {
        TableName:
          config.tableName,
      },
    );

    const created =
      await describeTableIfExists(
        config.tableName,
        serviceClient,
      );

    if (!created) {
      throw new Error(
        "DynamoDB waiter completed but the table could not be described.",
      );
    }

    assertTableShape(
      created,
    );

    console.log(
      "\nBeforeBell dev table ACTIVE. ✅",
    );

    console.log(
      `Primary key: PK + SK`,
    );

    console.log(
      `GSI1: GSI1PK + GSI1SK`,
    );

    console.log(
      `Billing: PAY_PER_REQUEST`,
    );
  } finally {
    serviceClient.destroy();
  }
}

main().catch(
  (error) => {
    console.error(
      "\nBeforeBell DynamoDB bootstrap failed.",
    );

    console.error(
      error,
    );

    process.exitCode =
      1;
  },
);