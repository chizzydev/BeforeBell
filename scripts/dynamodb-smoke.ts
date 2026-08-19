import {
  randomUUID,
} from "node:crypto";

import {
  DeleteCommand,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";

import {
  config as loadEnvironment,
} from "dotenv";

import {
  createBeforeBellDynamoClients,
} from "../src/infrastructure/dynamodb/client";

import {
  getBeforeBellDynamoConfig,
} from "../src/infrastructure/dynamodb/env";

import {
  createSmokeRecord,
  parseSmokeRecord,
} from "../src/infrastructure/dynamodb/records";

loadEnvironment({
  path:
    ".env.local",
});

const DEV_TABLE_NAME =
  "beforebell-dev";

async function main() {
  const config =
    getBeforeBellDynamoConfig();

  if (
    config.tableName !==
    DEV_TABLE_NAME
  ) {
    throw new Error(
      `Refusing to run development smoke test against "${config.tableName}".`,
    );
  }

  const {
    serviceClient,
    documentClient,
  } =
    createBeforeBellDynamoClients(
      config,
    );

  const nonce =
    randomUUID();

  const record =
    createSmokeRecord(
      nonce,
      new Date(),
    );

  let recordCreated =
    false;

  console.log(
    "\n=== BeforeBell DynamoDB Connection Smoke ===\n",
  );

  console.log(
    `Region: ${config.region}`,
  );

  console.log(
    `Table: ${config.tableName}`,
  );

  try {
    console.log(
      "\n1. Writing temporary record...",
    );

    await documentClient.send(
      new PutCommand({
        TableName:
          config.tableName,

        Item:
          record,

        ConditionExpression:
          "attribute_not_exists(PK) AND attribute_not_exists(SK)",
      }),
    );

    recordCreated =
      true;

    console.log(
      "Write: PASS ✅",
    );

    console.log(
      "\n2. Reading it back strongly consistently...",
    );

    const result =
      await documentClient.send(
        new GetCommand({
          TableName:
            config.tableName,

          Key: {
            PK:
              record.PK,

            SK:
              record.SK,
          },

          ConsistentRead:
            true,
        }),
      );

    if (!result.Item) {
      throw new Error(
        "Smoke record was written but could not be read back.",
      );
    }

    const parsed =
      parseSmokeRecord(
        result.Item,
      );

    if (
      parsed.nonce !==
      nonce
    ) {
      throw new Error(
        "Read-back smoke record did not match the written nonce.",
      );
    }

    console.log(
      "Strong read: PASS ✅",
    );

    console.log(
      "Schema validation: PASS ✅",
    );

    console.log(
      "\n3. Cleaning temporary record...",
    );

    await documentClient.send(
      new DeleteCommand({
        TableName:
          config.tableName,

        Key: {
          PK:
            record.PK,

          SK:
            record.SK,
        },
      }),
    );

    recordCreated =
      false;

    console.log(
      "Cleanup: PASS ✅",
    );

    console.log(
      "\n=== DynamoDB Foundation Connected ===\n",
    );

    console.log(
      "Put → strong Get → codec validation → Delete: PASS",
    );
  } finally {
    /**
     * Best-effort cleanup if something failed after the Put.
     */
    if (recordCreated) {
      try {
        await documentClient.send(
          new DeleteCommand({
            TableName:
              config.tableName,

            Key: {
              PK:
                record.PK,

              SK:
                record.SK,
            },
          }),
        );
      } catch (
        cleanupError
      ) {
        console.error(
          "WARNING: failed to clean temporary smoke record.",
        );

        console.error(
          cleanupError,
        );
      }
    }

    serviceClient.destroy();
  }
}

main().catch(
  (error) => {
    console.error(
      "\nBeforeBell DynamoDB smoke test failed.",
    );

    console.error(
      error,
    );

    process.exitCode =
      1;
  },
);