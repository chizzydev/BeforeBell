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
  CoverageCandidate,
  CoveragePolicy,
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
      `Refusing to run DynamoDB 3A smoke against "${config.tableName}".`,
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
    `school-ddb-${nonce}`;

  const caseId =
    `case-ddb-${nonce}`;

  const candidateOneId =
    `candidate-ddb-a-${nonce}`;

  const candidateTwoId =
    `candidate-ddb-b-${nonce}`;

  const policy:
    CoveragePolicy = {
      schoolId,

      maxDailyCoveragePeriods:
        5,

      preferSubjectQualifiedFor: [
        "Math",
        "Science",
      ],

      preferSingleCandidate:
        true,

      requireCandidateAcceptance:
        true,

      protectedPlanningRequiresApproval:
        true,

      externalSubstituteRequiresApproval:
        true,

      combineGroupsRequiresApproval:
        true,
    };

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
        "P2",
        "P5",
      ],

      status:
        "open",

      createdAt:
        "2026-09-14T05:50:00.000Z",

      updatedAt:
        "2026-09-14T05:50:00.000Z",
    };

  const candidates:
    CoverageCandidate[] = [
      {
        id:
          candidateOneId,

        schoolId,

        name:
          "Dynamo Test Candidate A",

        qualifiedSubjects: [
          "Science",
        ],

        availablePeriods: [
          "P2",
          "P5",
        ],

        conflictingPeriods:
          [],

        protectedPlanningPeriods:
          [],

        dailyCoverageCount:
          0,

        active:
          true,
      },
      {
        id:
          candidateTwoId,

        schoolId,

        name:
          "Dynamo Test Candidate B",

        qualifiedSubjects: [
          "Science",
        ],

        availablePeriods: [
          "P2",
        ],

        conflictingPeriods:
          [],

        protectedPlanningPeriods: [
          "P5",
        ],

        dailyCoverageCount:
          1,

        active:
          true,
      },
    ];

  const cleanupKeys = [
    dynamoKeys.coveragePolicy(
      schoolId,
    ),

    dynamoKeys.caseMeta(
      caseId,
    ),

    dynamoKeys.candidateMeta(
      candidateOneId,
    ),

    dynamoKeys.schoolCandidate(
      schoolId,
      candidateOneId,
    ),

    dynamoKeys.candidateMeta(
      candidateTwoId,
    ),

    dynamoKeys.schoolCandidate(
      schoolId,
      candidateTwoId,
    ),
  ];

  console.log(
    "\n=== BeforeBell DynamoDbBeforeBellStore 3A Smoke ===\n",
  );

  console.log(
    `Region: ${config.region}`,
  );

  console.log(
    `Table: ${config.tableName}`,
  );

  console.log(
    `Synthetic school: ${schoolId}`,
  );

  try {
    console.log(
      "\n1. Policy Put/Get...",
    );

    await store.putPolicy(
      policy,
    );

    const loadedPolicy =
      await store.getPolicy(
        schoolId,
      );

    assert(
      loadedPolicy !==
        undefined,
      "Coverage policy was not read back.",
    );

    assert(
      loadedPolicy.schoolId ===
        schoolId,
      "Coverage policy school ID did not round-trip.",
    );

    console.log(
      "Policy Put/Get: PASS ✅",
    );

    console.log(
      "\n2. Case Put/Get...",
    );

    await store.putCase(
      absenceCase,
    );

    const loadedCase =
      await store.getCase(
        caseId,
      );

    assert(
      loadedCase !==
        undefined,
      "Absence case was not read back.",
    );

    assert(
      loadedCase.status ===
        "open",
      "Absence case did not round-trip with open status.",
    );

    console.log(
      "Case Put/Get: PASS ✅",
    );

    console.log(
      "\n3. Conditional case status transition...",
    );

    const offeringCase:
      AbsenceCase = {
        ...absenceCase,

        status:
          "offering",

        updatedAt:
          "2026-09-14T06:00:00.000Z",
      };

    const firstTransition =
      await store.updateCaseIfStatus(
        caseId,
        "open",
        offeringCase,
      );

    assert(
      firstTransition,
      "Expected open → offering conditional transition to succeed.",
    );

    const staleTransition =
      await store.updateCaseIfStatus(
        caseId,
        "open",
        {
          ...offeringCase,

          status:
            "resolved",

          updatedAt:
            "2026-09-14T06:01:00.000Z",
        },
      );

    assert(
      !staleTransition,
      "Stale expected-status transition should have been rejected.",
    );

    const afterTransition =
      await store.getCase(
        caseId,
      );

    assert(
      afterTransition?.status ===
        "offering",
      "Rejected stale transition changed authoritative case status.",
    );

    console.log(
      "Conditional update: PASS ✅",
    );

    console.log(
      "\n4. Candidate transactional Put...",
    );

    for (
      const candidate of
      candidates
    ) {
      await store.putCandidate(
        candidate,
      );
    }

    console.log(
      "Candidate transaction: PASS ✅",
    );

    console.log(
      "\n5. Canonical candidate Get...",
    );

    const loadedCandidate =
      await store.getCandidate(
        candidateOneId,
      );

    assert(
      loadedCandidate !==
        undefined,
      "Canonical candidate could not be read.",
    );

    assert(
      loadedCandidate.name ===
        "Dynamo Test Candidate A",
      "Canonical candidate payload did not round-trip.",
    );

    console.log(
      "Candidate strong Get: PASS ✅",
    );

    console.log(
      "\n6. Strong school-roster Query...",
    );

    const roster =
      await store
        .listCandidatesBySchool(
          schoolId,
        );

    assert(
      roster.length ===
        2,
      `Expected 2 roster candidates but found ${roster.length}.`,
    );

    assert(
      roster.every(
        (candidate) =>
          candidate.schoolId ===
          schoolId,
      ),
      "School roster returned a candidate from another school.",
    );

    console.log(
      "School roster Query: PASS ✅",
    );

    console.log(
      "\n=== DynamoDbBeforeBellStore 3A Connected ===\n",
    );

    console.log(
      "Policy persistence: PASS",
    );

    console.log(
      "Case persistence: PASS",
    );

    console.log(
      "Conditional case concurrency guard: PASS",
    );

    console.log(
      "Candidate canonical persistence: PASS",
    );

    console.log(
      "Candidate roster mirror transaction: PASS",
    );

    console.log(
      "Strong roster query: PASS",
    );
  } finally {
    console.log(
      "\nCleaning synthetic 3A records...",
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
      "\nBeforeBell DynamoDbBeforeBellStore 3A smoke failed.",
    );

    console.error(
      error,
    );

    process.exitCode =
      1;
  },
);