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
  AbsenceCase,
  ActivityEvent,
  HumanDecision,
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
      `Refusing to run DynamoDB 3C smoke against "${config.tableName}".`,
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

  const schoolId =
    `school-decision-${nonce}`;

  const caseId =
    `case-decision-${nonce}`;

  const decisionId =
    `decision-ddb-${nonce}`;

  const eventId =
    `activity-ddb-${nonce}`;

  const absenceCase:
    AbsenceCase = {
      id:
        caseId,

      schoolId,

      absentStaffMemberId:
        `staff-ddb-${nonce}`,

      subject:
        "Science",

      date:
        "2026-09-14",

      affectedPeriods: [
        "P5",
      ],

      status:
        "partially_covered",

      createdAt:
        "2026-09-14T05:50:00.000Z",

      updatedAt:
        "2026-09-14T06:05:00.000Z",
    };

  const decision:
    HumanDecision = {
      id:
        decisionId,

      caseId,

      kind:
        "request_external_substitute",

      status:
        "approved",

      periodIds: [
        "P5",
      ],

      summary:
        "Request an external substitute for P5.",

      requestedAt:
        "2026-09-14T06:10:00.000Z",

      decidedAt:
        "2026-09-14T06:10:00.000Z",

      decidedBy:
        "administrator-demo",
    };

  const activity:
    ActivityEvent = {
      eventId,

      caseId,

      timestamp:
        "2026-09-14T06:10:00.000Z",

      actorType:
        "administrator",

      action:
        "human_exception_decision_approved",

      toolName:
        "request_exception_decision",

      status:
        "succeeded",

      summary:
        "Administrator approved exception decision: Request an external substitute for P5.",

      correlationId:
        `correlation-ddb-${nonce}`,
    };

  const cleanupKeys = [
    dynamoKeys.caseMeta(
      caseId,
    ),

    dynamoKeys.caseDecision(
      caseId,
      decisionId,
    ),

    dynamoKeys.decisionLookup(
      decisionId,
    ),

    dynamoKeys.caseActivity(
      caseId,
      eventId,
    ),
  ];

  console.log(
    "\n=== BeforeBell DynamoDbBeforeBellStore 3C Decision + Activity Smoke ===\n",
  );

  console.log(
    `Region: ${config.region}`,
  );

  console.log(
    `Table: ${config.tableName}`,
  );

  console.log(
    `Case: ${caseId}`,
  );

  try {
    await store.putCase(
      absenceCase,
    );

    console.log(
      "\n1. Stable human-decision creation...",
    );

    const created =
      await store.putDecisionIfAbsent(
        decision,
      );

    assert(
      created,
      "First human-decision creation should succeed.",
    );

    console.log(
      "First decision creation: PASS ✅",
    );

    console.log(
      "\n2. Duplicate human-decision replay...",
    );

    const duplicate =
      await store.putDecisionIfAbsent(
        decision,
      );

    assert(
      !duplicate,
      "Second stable human-decision creation should be rejected.",
    );

    console.log(
      "Duplicate decision rejected: PASS ✅",
    );

    console.log(
      "\n3. Strong decision lookup...",
    );

    const loadedDecision =
      await store.getDecision(
        decisionId,
      );

    assert(
      loadedDecision !==
        undefined,
      "Human decision could not be loaded through immutable lookup.",
    );

    assert(
      loadedDecision.kind ===
        "request_external_substitute",
      "Human decision kind did not round-trip.",
    );

    assert(
      loadedDecision.status ===
        "approved",
      "Human decision status did not round-trip.",
    );

    console.log(
      "Strong getDecision: PASS ✅",
    );

    console.log(
      "\n4. Strong decisions-by-case Query...",
    );

    const decisions =
      await store.listDecisionsByCase(
        caseId,
      );

    assert(
      decisions.length ===
        1,
      `Expected one human decision but found ${decisions.length}.`,
    );

    console.log(
      "Case decision Query: PASS ✅",
    );

    console.log(
      "\n5. Idempotent activity append...",
    );

    await store.appendActivity(
      activity,
    );

    await store.appendActivity(
      activity,
    );

    const events =
      await store.listActivityByCase(
        caseId,
      );

    assert(
      events.length ===
        1,
      `Expected one activity event after replay but found ${events.length}.`,
    );

    assert(
      events[0]?.eventId ===
        eventId,
      "Activity event identity did not round-trip.",
    );

    console.log(
      "Activity replay: PASS ✅",
    );

    console.log(
      "\n6. Conflicting activity ID reuse...",
    );

    let conflictRejected =
      false;

    try {
      await store.appendActivity({
        ...activity,

        summary:
          "Conflicting evidence under the same event ID.",
      });
    } catch (error) {
      if (
        error instanceof
          Error &&
        /different authoritative data/i.test(
          error.message,
        )
      ) {
        conflictRejected =
          true;
      } else {
        throw error;
      }
    }

    assert(
      conflictRejected,
      "Reusing an event ID for different evidence should fail.",
    );

    console.log(
      "Conflicting evidence rejected: PASS ✅",
    );

    console.log(
      "\n=== DynamoDbBeforeBellStore 3C Connected ===\n",
    );

    console.log(
      "Canonical + decision lookup transaction: PASS",
    );

    console.log(
      "Human-decision idempotency: PASS",
    );

    console.log(
      "Strong decision lookup: PASS",
    );

    console.log(
      "Strong case decision query: PASS",
    );

    console.log(
      "Activity idempotent append: PASS",
    );

    console.log(
      "Activity evidence conflict detection: PASS",
    );
  } finally {
    console.log(
      "\nCleaning synthetic 3C records...",
    );

    for (
      const key of
      cleanupKeys
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
      "\nBeforeBell DynamoDbBeforeBellStore 3C smoke failed.",
    );

    console.error(
      error,
    );

    process.exitCode =
      1;
  },
);