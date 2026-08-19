import {
  randomUUID,
} from "node:crypto";

import {
  DeleteCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";

import {
  config as loadEnvironment,
} from "dotenv";

import type {
  AbsenceCase,
  CoverageAssignment,
  CoverageCandidate,
  CoveragePolicy,
  PeriodId,
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

import {
  parseCandidateCapacityRecord,
} from "../src/infrastructure/dynamodb/records";

loadEnvironment({
  path:
    ".env.local",
});

const DEV_TABLE_NAME =
  "beforebell-dev";

type PhysicalKey = {
  PK: string;
  SK: string;
};

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

function successfulCount(
  results:
    readonly boolean[],
): number {
  return results.filter(
    Boolean,
  ).length;
}

function createCase(
  input: {
    id: string;
    schoolId: string;
    date: string;
    periodIds:
      readonly PeriodId[];
  },
): AbsenceCase {
  return {
    id:
      input.id,

    schoolId:
      input.schoolId,

    absentStaffMemberId:
      `staff-${input.id}`,

    subject:
      "Science",

    date:
      input.date,

    affectedPeriods: [
      ...input.periodIds,
    ],

    status:
      "open",

    createdAt:
      `${input.date}T05:50:00.000Z`,

    updatedAt:
      `${input.date}T05:50:00.000Z`,
  };
}

function createCandidate(
  input: {
    id: string;
    schoolId: string;
    availablePeriods:
      readonly PeriodId[];
    dailyCoverageCount?:
      number;
  },
): CoverageCandidate {
  return {
    id:
      input.id,

    schoolId:
      input.schoolId,

    name:
      `Race Candidate ${input.id}`,

    qualifiedSubjects: [
      "Science",
    ],

    availablePeriods: [
      ...input.availablePeriods,
    ],

    conflictingPeriods:
      [],

    protectedPlanningPeriods:
      [],

    dailyCoverageCount:
      input.dailyCoverageCount ??
      0,

    active:
      true,
  };
}

function createAssignment(
  input: {
    id: string;
    caseId: string;
    candidateId: string;
    periodIds:
      readonly PeriodId[];
    createdAt: string;
  },
): CoverageAssignment {
  return {
    id:
      input.id,

    caseId:
      input.caseId,

    candidateId:
      input.candidateId,

    periodIds: [
      ...input.periodIds,
    ],

    source:
      "accepted_offer",

    offerId:
      `offer-${input.id}`,

    createdAt:
      input.createdAt,
  };
}

function keyIdentity(
  key: PhysicalKey,
): string {
  return `${key.PK}\u0000${key.SK}`;
}

async function main() {
  const config =
    getBeforeBellDynamoConfig();

  if (
    config.tableName !==
    DEV_TABLE_NAME
  ) {
    throw new Error(
      `Refusing to run DynamoDB 3D.3 smoke against "${config.tableName}".`,
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
    `school-assignment-race-${nonce}`;

  const dateOne =
    "2026-09-14";

  const dateTwo =
    "2026-09-15";

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

  /**
   * -----------------------------------------------------------------------
   * Race 1 — stable assignment ID
   * -----------------------------------------------------------------------
   */

  const sameIdCandidate =
    createCandidate({
      id:
        `candidate-same-id-${nonce}`,

      schoolId,

      availablePeriods: [
        "P1",
      ],
    });

  const sameIdCase =
    createCase({
      id:
        `case-same-id-${nonce}`,

      schoolId,

      date:
        dateOne,

      periodIds: [
        "P1",
      ],
    });

  const sameIdAssignment =
    createAssignment({
      id:
        `assignment-same-id-${nonce}`,

      caseId:
        sameIdCase.id,

      candidateId:
        sameIdCandidate.id,

      periodIds: [
        "P1",
      ],

      createdAt:
        `${dateOne}T06:00:00.000Z`,
    });

  /**
   * -----------------------------------------------------------------------
   * Race 2 — same case period, different candidates
   * -----------------------------------------------------------------------
   */

  const casePeriodCandidateA =
    createCandidate({
      id:
        `candidate-case-period-a-${nonce}`,

      schoolId,

      availablePeriods: [
        "P2",
      ],
    });

  const casePeriodCandidateB =
    createCandidate({
      id:
        `candidate-case-period-b-${nonce}`,

      schoolId,

      availablePeriods: [
        "P2",
      ],
    });

  const casePeriodCase =
    createCase({
      id:
        `case-period-race-${nonce}`,

      schoolId,

      date:
        dateOne,

      periodIds: [
        "P2",
      ],
    });

  const casePeriodAssignmentA =
    createAssignment({
      id:
        `assignment-case-period-a-${nonce}`,

      caseId:
        casePeriodCase.id,

      candidateId:
        casePeriodCandidateA.id,

      periodIds: [
        "P2",
      ],

      createdAt:
        `${dateOne}T06:01:00.000Z`,
    });

  const casePeriodAssignmentB =
    createAssignment({
      id:
        `assignment-case-period-b-${nonce}`,

      caseId:
        casePeriodCase.id,

      candidateId:
        casePeriodCandidateB.id,

      periodIds: [
        "P2",
      ],

      createdAt:
        `${dateOne}T06:01:00.000Z`,
    });

  /**
   * -----------------------------------------------------------------------
   * Race 3 — same candidate/date/period, different cases
   * -----------------------------------------------------------------------
   */

  const candidatePeriodCandidate =
    createCandidate({
      id:
        `candidate-period-race-${nonce}`,

      schoolId,

      availablePeriods: [
        "P3",
      ],
    });

  const candidatePeriodCaseA =
    createCase({
      id:
        `case-candidate-period-a-${nonce}`,

      schoolId,

      date:
        dateOne,

      periodIds: [
        "P3",
      ],
    });

  const candidatePeriodCaseB =
    createCase({
      id:
        `case-candidate-period-b-${nonce}`,

      schoolId,

      date:
        dateOne,

      periodIds: [
        "P3",
      ],
    });

  const candidatePeriodAssignmentA =
    createAssignment({
      id:
        `assignment-candidate-period-a-${nonce}`,

      caseId:
        candidatePeriodCaseA.id,

      candidateId:
        candidatePeriodCandidate.id,

      periodIds: [
        "P3",
      ],

      createdAt:
        `${dateOne}T06:02:00.000Z`,
    });

  const candidatePeriodAssignmentB =
    createAssignment({
      id:
        `assignment-candidate-period-b-${nonce}`,

      caseId:
        candidatePeriodCaseB.id,

      candidateId:
        candidatePeriodCandidate.id,

      periodIds: [
        "P3",
      ],

      createdAt:
        `${dateOne}T06:02:00.000Z`,
    });

  /**
   * -----------------------------------------------------------------------
   * Race 4 — disjoint periods, but only one daily-capacity slot remains
   * -----------------------------------------------------------------------
   */

  const capacityCandidate =
    createCandidate({
      id:
        `candidate-capacity-race-${nonce}`,

      schoolId,

      availablePeriods: [
        "P4",
        "P5",
      ],

      /**
       * Riverside-style max is five.
       *
       * Baseline four means the atomic BeforeBell counter may add exactly
       * one more period for this date.
       */
      dailyCoverageCount:
        4,
    });

  const capacityCaseA =
    createCase({
      id:
        `case-capacity-a-${nonce}`,

      schoolId,

      date:
        dateOne,

      periodIds: [
        "P4",
      ],
    });

  const capacityCaseB =
    createCase({
      id:
        `case-capacity-b-${nonce}`,

      schoolId,

      date:
        dateOne,

      periodIds: [
        "P5",
      ],
    });

  const capacityAssignmentA =
    createAssignment({
      id:
        `assignment-capacity-a-${nonce}`,

      caseId:
        capacityCaseA.id,

      candidateId:
        capacityCandidate.id,

      periodIds: [
        "P4",
      ],

      createdAt:
        `${dateOne}T06:03:00.000Z`,
    });

  const capacityAssignmentB =
    createAssignment({
      id:
        `assignment-capacity-b-${nonce}`,

      caseId:
        capacityCaseB.id,

      candidateId:
        capacityCandidate.id,

      periodIds: [
        "P5",
      ],

      createdAt:
        `${dateOne}T06:03:00.000Z`,
    });

  /**
   * -----------------------------------------------------------------------
   * Race 5 — same candidate + period, DIFFERENT dates
   * -----------------------------------------------------------------------
   */

  const crossDateCandidate =
    createCandidate({
      id:
        `candidate-cross-date-${nonce}`,

      schoolId,

      availablePeriods: [
        "P6",
      ],
    });

  const crossDateCaseA =
    createCase({
      id:
        `case-cross-date-a-${nonce}`,

      schoolId,

      date:
        dateOne,

      periodIds: [
        "P6",
      ],
    });

  const crossDateCaseB =
    createCase({
      id:
        `case-cross-date-b-${nonce}`,

      schoolId,

      date:
        dateTwo,

      periodIds: [
        "P6",
      ],
    });

  const crossDateAssignmentA =
    createAssignment({
      id:
        `assignment-cross-date-a-${nonce}`,

      caseId:
        crossDateCaseA.id,

      candidateId:
        crossDateCandidate.id,

      periodIds: [
        "P6",
      ],

      createdAt:
        `${dateOne}T06:04:00.000Z`,
    });

  const crossDateAssignmentB =
    createAssignment({
      id:
        `assignment-cross-date-b-${nonce}`,

      caseId:
        crossDateCaseB.id,

      candidateId:
        crossDateCandidate.id,

      periodIds: [
        "P6",
      ],

      createdAt:
        `${dateTwo}T06:04:00.000Z`,
    });

  const candidates = [
    sameIdCandidate,
    casePeriodCandidateA,
    casePeriodCandidateB,
    candidatePeriodCandidate,
    capacityCandidate,
    crossDateCandidate,
  ];

  const cases = [
    sameIdCase,
    casePeriodCase,
    candidatePeriodCaseA,
    candidatePeriodCaseB,
    capacityCaseA,
    capacityCaseB,
    crossDateCaseA,
    crossDateCaseB,
  ];

  const assignmentArtifacts: Array<{
    assignment:
      CoverageAssignment;

    date: string;
  }> = [
    {
      assignment:
        sameIdAssignment,

      date:
        dateOne,
    },
    {
      assignment:
        casePeriodAssignmentA,

      date:
        dateOne,
    },
    {
      assignment:
        casePeriodAssignmentB,

      date:
        dateOne,
    },
    {
      assignment:
        candidatePeriodAssignmentA,

      date:
        dateOne,
    },
    {
      assignment:
        candidatePeriodAssignmentB,

      date:
        dateOne,
    },
    {
      assignment:
        capacityAssignmentA,

      date:
        dateOne,
    },
    {
      assignment:
        capacityAssignmentB,

      date:
        dateOne,
    },
    {
      assignment:
        crossDateAssignmentA,

      date:
        dateOne,
    },
    {
      assignment:
        crossDateAssignmentB,

      date:
        dateTwo,
    },
  ];

  const cleanupKeyMap =
    new Map<
      string,
      PhysicalKey
    >();

  const addCleanupKey = (
    key: PhysicalKey,
  ) => {
    cleanupKeyMap.set(
      keyIdentity(
        key,
      ),
      key,
    );
  };

  addCleanupKey(
    dynamoKeys.coveragePolicy(
      schoolId,
    ),
  );

  for (
    const candidate of
    candidates
  ) {
    addCleanupKey(
      dynamoKeys.candidateMeta(
        candidate.id,
      ),
    );

    addCleanupKey(
      dynamoKeys.schoolCandidate(
        schoolId,
        candidate.id,
      ),
    );
  }

  for (
    const absenceCase of
    cases
  ) {
    addCleanupKey(
      dynamoKeys.caseMeta(
        absenceCase.id,
      ),
    );
  }

  for (
    const {
      assignment,
      date,
    } of
    assignmentArtifacts
  ) {
    addCleanupKey(
      dynamoKeys.caseAssignment(
        assignment.caseId,
        assignment.id,
      ),
    );

    addCleanupKey(
      dynamoKeys.assignmentLookup(
        assignment.id,
      ),
    );

    addCleanupKey(
      dynamoKeys.candidateAssignment(
        assignment.candidateId,
        date,
        assignment.id,
      ),
    );

    addCleanupKey(
      dynamoKeys.candidateCapacity(
        assignment.candidateId,
        date,
      ),
    );

    for (
      const periodId of
      assignment.periodIds
    ) {
      addCleanupKey(
        dynamoKeys.casePeriodLock(
          assignment.caseId,
          periodId,
        ),
      );

      addCleanupKey(
        dynamoKeys.candidatePeriodLock(
          assignment.candidateId,
          date,
          periodId,
        ),
      );
    }
  }

  async function getCapacityCount(
    candidateId: string,
    date: string,
  ): Promise<number> {
    const result =
      await documentClient.send(
        new GetCommand({
          TableName:
            config.tableName,

          Key:
            dynamoKeys.candidateCapacity(
              candidateId,
              date,
            ),

          ConsistentRead:
            true,
        }),
      );

    if (!result.Item) {
      return 0;
    }

    return parseCandidateCapacityRecord(
      result.Item,
    )
      .beforeBellAssignedPeriodCount;
  }

  console.log(
    "\n=== BeforeBell DynamoDbBeforeBellStore 3D.3 Assignment Race Smoke ===\n",
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
      "\n0. Seeding authoritative policy, cases and candidates...",
    );

    await store.putPolicy(
      policy,
    );

    for (
      const candidate of
      candidates
    ) {
      await store.putCandidate(
        candidate,
      );
    }

    for (
      const absenceCase of
      cases
    ) {
      await store.putCase(
        absenceCase,
      );
    }

    console.log(
      "Seed: PASS ✅",
    );

    /**
     * ---------------------------------------------------------------------
     * RACE 1
     * ---------------------------------------------------------------------
     */

    console.log(
      "\n1. Racing the same stable assignment ID...",
    );

    const sameIdResults =
      await Promise.all([
        store
          .putAssignmentIfPeriodsFree(
            sameIdAssignment,
          ),

        store
          .putAssignmentIfPeriodsFree(
            sameIdAssignment,
          ),
      ]);

    assert(
      successfulCount(
        sameIdResults,
      ) ===
        1,
      `Expected exactly one same-ID commit; results were ${JSON.stringify(
        sameIdResults,
      )}.`,
    );

    const sameIdLoaded =
      await store.getAssignment(
        sameIdAssignment.id,
      );

    assert(
      sameIdLoaded?.id ===
        sameIdAssignment.id,
      "Winning same-ID assignment could not be loaded.",
    );

    const sameIdCaseAssignments =
      await store
        .listAssignmentsByCase(
          sameIdCase.id,
        );

    assert(
      sameIdCaseAssignments.length ===
        1,
      `Expected one canonical same-ID assignment but found ${sameIdCaseAssignments.length}.`,
    );

    assert(
      await getCapacityCount(
        sameIdCandidate.id,
        dateOne,
      ) ===
        1,
      "Same-ID race incremented capacity more than once.",
    );

    console.log(
      `Same assignment ID: PASS ✅ ${JSON.stringify(
        sameIdResults,
      )}`,
    );

    /**
     * ---------------------------------------------------------------------
     * RACE 2
     * ---------------------------------------------------------------------
     */

    console.log(
      "\n2. Racing two candidates for the same case period...",
    );

    const casePeriodResults =
      await Promise.all([
        store
          .putAssignmentIfPeriodsFree(
            casePeriodAssignmentA,
          ),

        store
          .putAssignmentIfPeriodsFree(
            casePeriodAssignmentB,
          ),
      ]);

    assert(
      successfulCount(
        casePeriodResults,
      ) ===
        1,
      `Expected exactly one case-period winner; results were ${JSON.stringify(
        casePeriodResults,
      )}.`,
    );

    const casePeriodAssignments =
      await store
        .listAssignmentsByCase(
          casePeriodCase.id,
        );

    assert(
      casePeriodAssignments.length ===
        1,
      `Expected one assignment for the contested case period but found ${casePeriodAssignments.length}.`,
    );

    assert(
      casePeriodAssignments[0]
        ?.periodIds
        .includes(
          "P2",
        ),
      "Winning case-period assignment did not own P2.",
    );

    console.log(
      `Case-period lock: PASS ✅ ${JSON.stringify(
        casePeriodResults,
      )}`,
    );

    /**
     * ---------------------------------------------------------------------
     * RACE 3
     * ---------------------------------------------------------------------
     */

    console.log(
      "\n3. Racing one candidate across two same-date cases for the same period...",
    );

    const candidatePeriodResults =
      await Promise.all([
        store
          .putAssignmentIfPeriodsFree(
            candidatePeriodAssignmentA,
          ),

        store
          .putAssignmentIfPeriodsFree(
            candidatePeriodAssignmentB,
          ),
      ]);

    assert(
      successfulCount(
        candidatePeriodResults,
      ) ===
        1,
      `Expected exactly one candidate-period winner; results were ${JSON.stringify(
        candidatePeriodResults,
      )}.`,
    );

    const candidatePeriodAssignments =
      await store
        .listAssignmentsByCandidate(
          candidatePeriodCandidate.id,
        );

    assert(
      candidatePeriodAssignments.length ===
        1,
      `Expected one same-date candidate assignment but found ${candidatePeriodAssignments.length}.`,
    );

    assert(
      await getCapacityCount(
        candidatePeriodCandidate.id,
        dateOne,
      ) ===
        1,
      "Candidate-period race incremented capacity more than once.",
    );

    console.log(
      `Candidate/date/period lock: PASS ✅ ${JSON.stringify(
        candidatePeriodResults,
      )}`,
    );

    /**
     * ---------------------------------------------------------------------
     * RACE 4
     * ---------------------------------------------------------------------
     */

    console.log(
      "\n4. Racing disjoint periods for the final daily-capacity slot...",
    );

    const capacityResults =
      await Promise.all([
        store
          .putAssignmentIfPeriodsFree(
            capacityAssignmentA,
          ),

        store
          .putAssignmentIfPeriodsFree(
            capacityAssignmentB,
          ),
      ]);

    assert(
      successfulCount(
        capacityResults,
      ) ===
        1,
      `Expected exactly one capacity winner; results were ${JSON.stringify(
        capacityResults,
      )}.`,
    );

    const capacityAssignments =
      await store
        .listAssignmentsByCandidate(
          capacityCandidate.id,
        );

    assert(
      capacityAssignments.length ===
        1,
      `Expected one BeforeBell assignment at final daily capacity but found ${capacityAssignments.length}.`,
    );

    const capacityCounter =
      await getCapacityCount(
        capacityCandidate.id,
        dateOne,
      );

    assert(
      capacityCounter ===
        1,
      `Expected BeforeBell capacity counter 1 but found ${capacityCounter}.`,
    );

    assert(
      capacityCandidate
        .dailyCoverageCount +
        capacityCounter ===
        policy
          .maxDailyCoveragePeriods,
      "Committed capacity does not equal the configured maximum.",
    );

    console.log(
      `Atomic daily capacity: PASS ✅ ${JSON.stringify(
        capacityResults,
      )}`,
    );

    /**
     * ---------------------------------------------------------------------
     * RACE 5
     * ---------------------------------------------------------------------
     */

    console.log(
      "\n5. Racing the same candidate and period on different dates...",
    );

    const crossDateResults =
      await Promise.all([
        store
          .putAssignmentIfPeriodsFree(
            crossDateAssignmentA,
          ),

        store
          .putAssignmentIfPeriodsFree(
            crossDateAssignmentB,
          ),
      ]);

    assert(
      successfulCount(
        crossDateResults,
      ) ===
        2,
      `Expected both cross-date assignments to commit; results were ${JSON.stringify(
        crossDateResults,
      )}.`,
    );

    const crossDateAssignments =
      await store
        .listAssignmentsByCandidate(
          crossDateCandidate.id,
        );

    assert(
      crossDateAssignments.length ===
        2,
      `Expected two candidate assignments across two dates but found ${crossDateAssignments.length}.`,
    );

    const [
      dateOneCapacity,
      dateTwoCapacity,
    ] =
      await Promise.all([
        getCapacityCount(
          crossDateCandidate.id,
          dateOne,
        ),

        getCapacityCount(
          crossDateCandidate.id,
          dateTwo,
        ),
      ]);

    assert(
      dateOneCapacity ===
        1 &&
      dateTwoCapacity ===
        1,
      `Expected independent capacity counters of 1/1 but found ${dateOneCapacity}/${dateTwoCapacity}.`,
    );

    console.log(
      `Cross-date isolation: PASS ✅ ${JSON.stringify(
        crossDateResults,
      )}`,
    );

    console.log(
      "\n=== DynamoDbBeforeBellStore 3D.3 Connected ===\n",
    );

    console.log(
      "Stable assignment ID uniqueness: PASS",
    );

    console.log(
      "Case-period ownership lock: PASS",
    );

    console.log(
      "Candidate/date/period ownership lock: PASS",
    );

    console.log(
      "Atomic daily-capacity enforcement: PASS",
    );

    console.log(
      "Date-scoped candidate isolation: PASS",
    );

    console.log(
      "Transactional materialization: PASS",
    );

    console.log(
      "\nAll assignment race invariants held against real DynamoDB. ✅",
    );
  } finally {
    console.log(
      "\nCleaning synthetic 3D.3 records...",
    );

    let cleanupFailures =
      0;

    /**
     * Delete transaction artifacts before deleting their authoritative
     * policy/candidate/case records.
     */
    const orderedKeys =
      [...cleanupKeyMap.values()]
        .sort(
          (
            left,
            right,
          ) => {
            const leftIsAuthority =
              left.SK ===
                "META" ||
              left.SK ===
                "POLICY#COVERAGE" ||
              left.SK.startsWith(
                "CANDIDATE#",
              );

            const rightIsAuthority =
              right.SK ===
                "META" ||
              right.SK ===
                "POLICY#COVERAGE" ||
              right.SK.startsWith(
                "CANDIDATE#",
              );

            return Number(
              leftIsAuthority,
            ) -
              Number(
                rightIsAuthority,
              );
          },
        );

    for (
      const key of
      orderedKeys
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
        cleanupFailures +=
          1;

        console.error(
          `WARNING: cleanup failed for ${key.PK} / ${key.SK}`,
        );

        console.error(
          cleanupError,
        );
      }
    }

    serviceClient.destroy();

    if (
      cleanupFailures ===
      0
    ) {
      console.log(
        "Cleanup complete. ✅",
      );
    } else {
      console.error(
        `Cleanup completed with ${cleanupFailures} failure(s).`,
      );
    }
  }
}

main().catch(
  (error) => {
    console.error(
      "\nBeforeBell DynamoDbBeforeBellStore 3D.3 assignment race smoke failed.",
    );

    console.error(
      error,
    );

    process.exitCode =
      1;
  },
);