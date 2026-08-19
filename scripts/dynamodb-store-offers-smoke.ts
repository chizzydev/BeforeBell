import {
  randomUUID,
} from "node:crypto";

import {
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

import {
  config as loadEnvironment,
} from "dotenv";

import type {
  CoverageOffer,
} from "../src/domain/types";

import {
  createBeforeBellDynamoClients,
} from "../src/infrastructure/dynamodb/client";

import {
  DynamoDbBeforeBellStore,
} from "../src/infrastructure/dynamodb/dynamodb-beforebell-store";

import {
  getBeforeBellDynamoConfig,
} from "../src/infrastructure/dynamodb/env";

import {
  dynamoKeys,
} from "../src/infrastructure/dynamodb/keys";

loadEnvironment({
  path:
    ".env.local",
});

const DEV_TABLE_NAME =
  "beforebell-dev";

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(
      message,
    );
  }
}

async function main() {
  const config =
    getBeforeBellDynamoConfig();

  if (
    config.tableName !==
    DEV_TABLE_NAME
  ) {
    throw new Error(
      `Refusing to run DynamoDB 3B smoke against "${config.tableName}".`,
    );
  }

  const {
    serviceClient,
    documentClient,
  } =
    createBeforeBellDynamoClients(
      config,
    );

  const store =
    new DynamoDbBeforeBellStore({
      documentClient,

      tableName:
        config.tableName,
    });

  const nonce =
    randomUUID()
      .replaceAll(
        "-",
        "",
      )
      .slice(
        0,
        12,
      );

  const caseId =
    `case-offer-${nonce}`;

  const offerId =
    `offer-ddb-${nonce}`;

  const candidateId =
    `candidate-ddb-${nonce}`;

  const pendingOffer:
    CoverageOffer = {
      id:
        offerId,

      caseId,

      candidateId,

      periodIds: [
        "P2",
        "P5",
      ],

      status:
        "pending",

      createdAt:
        "2026-09-14T05:55:00.000Z",

      expiresAt:
        "2026-09-14T06:15:00.000Z",
    };

  const canonicalKey =
    dynamoKeys.caseOffer(
      caseId,
      offerId,
    );

  const lookupKey =
    dynamoKeys.offerLookup(
      offerId,
    );

  console.log(
    "\n=== BeforeBell DynamoDbBeforeBellStore 3B Offer Smoke ===\n",
  );

  console.log(
    `Region: ${config.region}`,
  );

  console.log(
    `Table: ${config.tableName}`,
  );

  console.log(
    `Offer: ${offerId}`,
  );

  try {
    console.log(
      "\n1. Conditional offer creation...",
    );

    const created =
      await store.putOfferIfAbsent(
        pendingOffer,
      );

    assert(
      created,
      "First offer creation should succeed.",
    );

    console.log(
      "First creation: PASS ✅",
    );

    console.log(
      "\n2. Idempotent duplicate creation...",
    );

    const duplicate =
      await store.putOfferIfAbsent(
        pendingOffer,
      );

    assert(
      !duplicate,
      "Second stable offer creation should be rejected as already existing.",
    );

    console.log(
      "Duplicate rejected: PASS ✅",
    );

    console.log(
      "\n3. Strong lookup → canonical Get...",
    );

    const loaded =
      await store.getOffer(
        offerId,
      );

    assert(
      loaded !==
        undefined,
      "Offer could not be loaded through immutable lookup.",
    );

    assert(
      loaded.status ===
        "pending",
      "Offer did not round-trip with pending status.",
    );

    console.log(
      "Strong getOffer: PASS ✅",
    );

    console.log(
      "\n4. Strong listOffersByCase Query...",
    );

    const offers =
      await store.listOffersByCase(
        caseId,
      );

    assert(
      offers.length ===
        1,
      `Expected one case offer but found ${offers.length}.`,
    );

    console.log(
      "Case offer Query: PASS ✅",
    );

    console.log(
      "\n5. Conditional pending → accepted...",
    );

    const acceptedOffer:
      CoverageOffer = {
        ...pendingOffer,

        status:
          "accepted",

        respondedAt:
          "2026-09-14T06:00:00.000Z",
      };

    const accepted =
      await store.updateOfferIfStatus(
        offerId,
        "pending",
        acceptedOffer,
      );

    assert(
      accepted,
      "Expected pending → accepted to succeed.",
    );

    console.log(
      "First response wins: PASS ✅",
    );

    console.log(
      "\n6. Competing stale pending → declined...",
    );

    const declinedOffer:
      CoverageOffer = {
        ...pendingOffer,

        status:
          "declined",

        respondedAt:
          "2026-09-14T06:00:01.000Z",
      };

    const staleDecline =
      await store.updateOfferIfStatus(
        offerId,
        "pending",
        declinedOffer,
      );

    assert(
      !staleDecline,
      "Stale pending → declined transition should lose.",
    );

    const finalOffer =
      await store.getOffer(
        offerId,
      );

    assert(
      finalOffer?.status ===
        "accepted",
      "Rejected stale response changed authoritative offer state.",
    );

    console.log(
      "Competing response rejected: PASS ✅",
    );

    console.log(
      "\n=== DynamoDbBeforeBellStore 3B Connected ===\n",
    );

    console.log(
      "Canonical + lookup transaction: PASS",
    );

    console.log(
      "Idempotent stable offer creation: PASS",
    );

    console.log(
      "Strong lookup resolution: PASS",
    );

    console.log(
      "Strong case offer query: PASS",
    );

    console.log(
      "Conditional response transition: PASS",
    );

    console.log(
      "Accept-vs-decline race protection: PASS",
    );
  } finally {
    console.log(
      "\nCleaning synthetic 3B records...",
    );

    for (
      const key of [
        canonicalKey,
        lookupKey,
      ]
    ) {
      try {
        await documentClient.send(
          new DeleteCommand({
            TableName:
              config.tableName,

            Key:
              key,
          }),
        );
      } catch (
        cleanupError
      ) {
        console.error(
          `WARNING: cleanup failed for ${key.PK} / ${key.SK}`,
        );

        console.error(
          cleanupError,
        );
      }
    }

    serviceClient.destroy();

    console.log(
      "Cleanup complete.",
    );
  }
}

main().catch(
  (error) => {
    console.error(
      "\nBeforeBell DynamoDbBeforeBellStore 3B offer smoke failed.",
    );

    console.error(
      error,
    );

    process.exitCode =
      1;
  },
);