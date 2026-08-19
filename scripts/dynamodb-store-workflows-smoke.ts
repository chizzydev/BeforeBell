import {
  randomUUID,
} from "node:crypto";

import {
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

import {
  config as loadEnvironment,
} from "dotenv";

import {
  assignAcceptedCoverage,
} from "../src/application/actions/assign-accepted-coverage";

import {
  createCoverageOffer,
} from "../src/application/actions/create-coverage-offer";

import {
  fulfillApprovedExternalSubstitute,
} from "../src/application/actions/fulfill-approved-external-substitute";

import {
  planCoverageCase,
} from "../src/application/actions/plan-coverage-case";

import {
  reconcileCoverageCase,
} from "../src/application/actions/reconcile-coverage-case";

import {
  recordApprovedExceptionDecision,
} from "../src/application/actions/record-approved-exception-decision";

import {
  respondToCoverageOffer,
} from "../src/application/actions/respond-to-coverage-offer";

import {
  buildExceptionDecisionRequest,
} from "../src/agent/tools/request-exception-decision";

import type {
  AbsenceCase,
  CoverageCandidate,
  PeriodId,
} from "../src/domain/types";

import {
  riversideCoveragePolicy,
  scenarioAAbsence,
  scenarioACandidates,
  scenarioBAbsence,
  scenarioBCandidates,
  scenarioCAbsence,
  scenarioCCandidates,
} from "../src/fixtures/riverside";

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

function requireData<T>(
  result: {
    success: boolean;
    code: string;
    message: string;
    data?: T;
  },
  label: string,
): T {
  if (
    !result.success ||
    result.data ===
      undefined
  ) {
    throw new Error(
      `${label} failed [${result.code}]: ${result.message}`,
    );
  }

  return result.data;
}

function assertPeriodSet(
  actual:
    readonly PeriodId[],
  expected:
    readonly PeriodId[],
  label: string,
): void {
  const actualSet =
    new Set(actual);

  const expectedSet =
    new Set(expected);

  assert(
    actualSet.size ===
      expectedSet.size &&
      [...expectedSet].every(
        (periodId) =>
          actualSet.has(
            periodId,
          ),
      ),
    `${label}: expected ${[
      ...expectedSet,
    ].join(
      ", ",
    )} but received ${[
      ...actualSet,
    ].join(
      ", ",
    )}.`,
  );
}

function cloneCase(
  source:
    AbsenceCase,
  schoolId: string,
  nonce: string,
): AbsenceCase {
  return {
    ...source,

    id:
      `${source.id}-ddb-${nonce}`,

    schoolId,

    absentStaffMemberId:
      `${source.absentStaffMemberId}-ddb-${nonce}`,
  };
}

function cloneCandidates(
  candidates:
    readonly CoverageCandidate[],
  schoolId: string,
  nonce: string,
): CoverageCandidate[] {
  return candidates.map(
    (candidate) => ({
      ...candidate,

      id:
        `${candidate.id}-ddb-${nonce}`,

      schoolId,
    }),
  );
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
      `Refusing to run DynamoDB 3E smoke against "${config.tableName}".`,
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
    `school-riverside-3e-${nonce}`;

  const policy = {
    ...riversideCoveragePolicy,

    schoolId,
  };

  const caseA =
    cloneCase(
      scenarioAAbsence,
      schoolId,
      nonce,
    );

  const caseB =
    cloneCase(
      scenarioBAbsence,
      schoolId,
      nonce,
    );

  const caseC =
    cloneCase(
      scenarioCAbsence,
      schoolId,
      nonce,
    );

  const candidatesA =
    cloneCandidates(
      scenarioACandidates,
      schoolId,
      nonce,
    );

  const candidatesB =
    cloneCandidates(
      scenarioBCandidates,
      schoolId,
      nonce,
    );

  const candidatesC =
    cloneCandidates(
      scenarioCCandidates,
      schoolId,
      nonce,
    );

  const alex =
    candidatesA[0];

  const jordan =
    candidatesB[0];

  const emma =
    candidatesC[0];

  const noah =
    candidatesC[1];

  assert(
    alex &&
      jordan &&
      emma &&
      noah,
    "Synthetic scenario candidates were not constructed correctly.",
  );

  const allCases = [
    caseA,
    caseB,
    caseC,
  ];

  const allCandidates = [
    ...candidatesA,
    ...candidatesB,
    ...candidatesC,
  ];

  /**
   * Stable operation identities for this isolated smoke run.
   */
  const offerAId =
    `offer-scenario-a-${nonce}`;

  const assignmentAId =
    `assignment-scenario-a-${nonce}`;

  const offerBRoutineId =
    `offer-scenario-b-routine-${nonce}`;

  const assignmentBRoutineId =
    `assignment-scenario-b-routine-${nonce}`;

  const decisionBId =
    `decision-scenario-b-external-${nonce}`;

  const externalSubstituteId =
    `external-substitute-morgan-ellis-${nonce}`;

  const offerCEmmaId =
    `offer-scenario-c-emma-${nonce}`;

  const offerCNoahId =
    `offer-scenario-c-noah-${nonce}`;

  const assignmentCId =
    `assignment-scenario-c-noah-${nonce}`;

  const cleanupKeys =
    new Map<
      string,
      PhysicalKey
    >();

  const addCleanupKey = (
    key: PhysicalKey,
  ) => {
    cleanupKeys.set(
      keyIdentity(
        key,
      ),
      key,
    );
  };

  /**
   * Authoritative seed records.
   */
  addCleanupKey(
    dynamoKeys.coveragePolicy(
      schoolId,
    ),
  );

  for (
    const candidate of
    allCandidates
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
    allCases
  ) {
    addCleanupKey(
      dynamoKeys.caseMeta(
        absenceCase.id,
      ),
    );
  }

  /**
   * Discover every dynamic case artifact before deletion.
   *
   * This catches internally-generated assignment/activity IDs from the
   * approved external-substitute fulfillment path without duplicating its
   * identity algorithm in this smoke script.
   */
  async function discoverCaseArtifacts(
    absenceCase:
      AbsenceCase,
  ): Promise<void> {
    const [
      offers,
      assignments,
      decisions,
      activities,
    ] =
      await Promise.all([
        store.listOffersByCase(
          absenceCase.id,
        ),

        store.listAssignmentsByCase(
          absenceCase.id,
        ),

        store.listDecisionsByCase(
          absenceCase.id,
        ),

        store.listActivityByCase(
          absenceCase.id,
        ),
      ]);

    for (
      const offer of
      offers
    ) {
      addCleanupKey(
        dynamoKeys.caseOffer(
          absenceCase.id,
          offer.id,
        ),
      );

      addCleanupKey(
        dynamoKeys.offerLookup(
          offer.id,
        ),
      );
    }

    for (
      const assignment of
      assignments
    ) {
      addCleanupKey(
        dynamoKeys.caseAssignment(
          absenceCase.id,
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
          absenceCase.date,
          assignment.id,
        ),
      );

      addCleanupKey(
        dynamoKeys.candidateCapacity(
          assignment.candidateId,
          absenceCase.date,
        ),
      );

      for (
        const periodId of
        assignment.periodIds
      ) {
        addCleanupKey(
          dynamoKeys.casePeriodLock(
            absenceCase.id,
            periodId,
          ),
        );

        addCleanupKey(
          dynamoKeys.candidatePeriodLock(
            assignment.candidateId,
            absenceCase.date,
            periodId,
          ),
        );
      }
    }

    for (
      const decision of
      decisions
    ) {
      addCleanupKey(
        dynamoKeys.caseDecision(
          absenceCase.id,
          decision.id,
        ),
      );

      addCleanupKey(
        dynamoKeys.decisionLookup(
          decision.id,
        ),
      );
    }

    for (
      const activity of
      activities
    ) {
      addCleanupKey(
        dynamoKeys.caseActivity(
          absenceCase.id,
          activity.eventId,
        ),
      );
    }
  }

  console.log(
    "\n=== BeforeBell DynamoDB 3E Full Workflow Smoke ===\n",
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
    /**
     * =====================================================================
     * SEED
     * =====================================================================
     */

    console.log(
      "\n0. Seeding Riverside policy, three cases and seven candidates...",
    );

    await store.putPolicy(
      policy,
    );

    for (
      const candidate of
      allCandidates
    ) {
      await store.putCandidate(
        candidate,
      );
    }

    for (
      const absenceCase of
      allCases
    ) {
      await store.putCase(
        absenceCase,
      );
    }

    console.log(
      "Seed: PASS ✅",
    );

    /**
     * =====================================================================
     * SCENARIO A
     * =====================================================================
     */

    console.log(
      "\n=== Scenario A: Fully Autonomous Routine Coverage ===",
    );

    console.log(
      "\nA1. Deterministic planning...",
    );

    const planA =
      requireData(
        await planCoverageCase(
          store,
          {
            caseId:
              caseA.id,
          },
        ),
        "Scenario A planning",
      );

    assert(
      planA.plan
        .unresolvedPeriodIds
        .length ===
        0,
      "Scenario A should have no unresolved periods.",
    );

    console.log(
      "Planner found complete routine coverage: PASS ✅",
    );

    console.log(
      "\nA2. Creating Alex Johnson offer...",
    );

    requireData(
      await createCoverageOffer(
        store,
        {
          offerId:
            offerAId,

          caseId:
            caseA.id,

          candidateId:
            alex.id,

          periodIds: [
            "P1",
            "P2",
            "P4",
            "P6",
          ],

          now:
            new Date(
              "2026-09-14T05:44:00.000Z",
            ),

          expiresAt:
            new Date(
              "2026-09-14T06:30:00.000Z",
            ),

          activityEventId:
            `activity-a-offer-${nonce}`,

          correlationId:
            `correlation-a-${nonce}`,
        },
      ),
      "Scenario A offer creation",
    );

    console.log(
      "Offer creation: PASS ✅",
    );

    requireData(
      await reconcileCoverageCase(
        store,
        {
          caseId:
            caseA.id,

          now:
            new Date(
              "2026-09-14T05:45:00.000Z",
            ),

          activityEventId:
            `activity-a-reconcile-offering-${nonce}`,

          correlationId:
            `correlation-a-${nonce}`,
        },
      ),
      "Scenario A offering reconciliation",
    );

    console.log(
      "\nA3. Alex accepts...",
    );

    requireData(
      await respondToCoverageOffer(
        store,
        {
          offerId:
            offerAId,

          response:
            "accepted",

          now:
            new Date(
              "2026-09-14T05:48:00.000Z",
            ),

          activityEventId:
            `activity-a-accepted-${nonce}`,

          correlationId:
            `correlation-a-${nonce}`,
        },
      ),
      "Scenario A acceptance",
    );

    console.log(
      "Offer acceptance: PASS ✅",
    );

    console.log(
      "\nA4. Revalidating and assigning all four periods...",
    );

    requireData(
      await assignAcceptedCoverage(
        store,
        {
          assignmentId:
            assignmentAId,

          offerId:
            offerAId,

          now:
            new Date(
              "2026-09-14T05:50:00.000Z",
            ),

          activityEventId:
            `activity-a-assignment-${nonce}`,

          correlationId:
            `correlation-a-${nonce}`,
        },
      ),
      "Scenario A assignment",
    );

    const reconcileA =
      requireData(
        await reconcileCoverageCase(
          store,
          {
            caseId:
              caseA.id,

            now:
              new Date(
                "2026-09-14T05:51:00.000Z",
              ),

            activityEventId:
              `activity-a-reconcile-resolved-${nonce}`,

            correlationId:
              `correlation-a-${nonce}`,
          },
        ),
        "Scenario A final reconciliation",
      );

    assert(
      reconcileA.currentStatus ===
        "resolved",
      `Scenario A expected resolved but received ${reconcileA.currentStatus}.`,
    );

    const [
      finalCaseA,
      assignmentsA,
      decisionsA,
    ] =
      await Promise.all([
        store.getCase(
          caseA.id,
        ),

        store.listAssignmentsByCase(
          caseA.id,
        ),

        store.listDecisionsByCase(
          caseA.id,
        ),
      ]);

    assert(
      finalCaseA?.status ===
        "resolved",
      "Scenario A authoritative case did not resolve.",
    );

    assert(
      assignmentsA.length ===
        1,
      `Scenario A expected one assignment but found ${assignmentsA.length}.`,
    );

    assertPeriodSet(
      assignmentsA[0]
        ?.periodIds ??
        [],
      [
        "P1",
        "P2",
        "P4",
        "P6",
      ],
      "Scenario A covered periods",
    );

    assert(
      assignmentsA[0]
        ?.candidateId ===
        alex.id,
      "Scenario A was not assigned to Alex Johnson.",
    );

    assert(
      decisionsA.length ===
        0,
      "Scenario A should require zero human decisions.",
    );

    console.log(
      "Scenario A: PASS ✅ 4/4 covered, zero administrator decisions",
    );

    /**
     * =====================================================================
     * SCENARIO B
     * =====================================================================
     */

    console.log(
      "\n=== Scenario B: Routine Coverage + Human Judgment ===",
    );

    console.log(
      "\nB1. Deterministic planning...",
    );

    const planBInitial =
      requireData(
        await planCoverageCase(
          store,
          {
            caseId:
              caseB.id,
          },
        ),
        "Scenario B initial planning",
      );

    assertPeriodSet(
      planBInitial.plan
        .unresolvedPeriodIds,
      [
        "P5",
      ],
      "Scenario B initial unresolved periods",
    );

    console.log(
      "Planner isolated P5 as the judgment boundary: PASS ✅",
    );

    console.log(
      "\nB2. Creating routine Jordan Lee offer for P2/P3...",
    );

    requireData(
      await createCoverageOffer(
        store,
        {
          offerId:
            offerBRoutineId,

          caseId:
            caseB.id,

          candidateId:
            jordan.id,

          periodIds: [
            "P2",
            "P3",
          ],

          now:
            new Date(
              "2026-09-14T05:54:00.000Z",
            ),

          expiresAt:
            new Date(
              "2026-09-14T06:30:00.000Z",
            ),

          activityEventId:
            `activity-b-offer-${nonce}`,

          correlationId:
            `correlation-b-${nonce}`,
        },
      ),
      "Scenario B routine offer creation",
    );

    requireData(
      await reconcileCoverageCase(
        store,
        {
          caseId:
            caseB.id,

          now:
            new Date(
              "2026-09-14T05:55:00.000Z",
            ),

          activityEventId:
            `activity-b-reconcile-offering-${nonce}`,

          correlationId:
            `correlation-b-${nonce}`,
        },
      ),
      "Scenario B offering reconciliation",
    );

    console.log(
      "\nB3. Jordan accepts and BeforeBell assigns P2/P3...",
    );

    requireData(
      await respondToCoverageOffer(
        store,
        {
          offerId:
            offerBRoutineId,

          response:
            "accepted",

          now:
            new Date(
              "2026-09-14T05:58:00.000Z",
            ),

          activityEventId:
            `activity-b-accepted-${nonce}`,

          correlationId:
            `correlation-b-${nonce}`,
        },
      ),
      "Scenario B routine acceptance",
    );

    requireData(
      await assignAcceptedCoverage(
        store,
        {
          assignmentId:
            assignmentBRoutineId,

          offerId:
            offerBRoutineId,

          now:
            new Date(
              "2026-09-14T06:00:00.000Z",
            ),

          activityEventId:
            `activity-b-routine-assignment-${nonce}`,

          correlationId:
            `correlation-b-${nonce}`,
        },
      ),
      "Scenario B routine assignment",
    );

    const partialB =
      requireData(
        await reconcileCoverageCase(
          store,
          {
            caseId:
              caseB.id,

            now:
              new Date(
                "2026-09-14T06:01:00.000Z",
              ),

            activityEventId:
              `activity-b-reconcile-partial-${nonce}`,

            correlationId:
              `correlation-b-${nonce}`,
          },
        ),
        "Scenario B partial reconciliation",
      );

    assert(
      partialB.currentStatus ===
        "partially_covered",
      `Scenario B should be partially covered after P2/P3 but received ${partialB.currentStatus}.`,
    );

    console.log(
      "Routine P2/P3 assignment: PASS ✅",
    );

    console.log(
      "\nB4. Re-planning remaining coverage...",
    );

    const planBAfterRoutine =
      requireData(
        await planCoverageCase(
          store,
          {
            caseId:
              caseB.id,
          },
        ),
        "Scenario B post-routine planning",
      );

    assertPeriodSet(
      planBAfterRoutine.plan
        .unresolvedPeriodIds,
      [
        "P5",
      ],
      "Scenario B remaining unresolved periods",
    );

    console.log(
      "P5 remains unresolved: PASS ✅",
    );

    console.log(
      "\nB5. Building authoritative administrator choices...",
    );

    const decisionRequest =
      requireData(
        await buildExceptionDecisionRequest(
          store,
          {
            caseId:
              caseB.id,
          },
        ),
        "Scenario B exception decision request",
      );

    assertPeriodSet(
      decisionRequest
        .unresolvedPeriodIds,
      [
        "P5",
      ],
      "Scenario B decision-request periods",
    );

    const externalOption =
      decisionRequest.options.find(
        (option) =>
          option.kind ===
            "request_external_substitute",
      );

    assert(
      externalOption,
      "Scenario B did not produce the approved external-substitute option.",
    );

    assertPeriodSet(
      externalOption.periodIds,
      [
        "P5",
      ],
      "Scenario B external-substitute option",
    );

    console.log(
      "Authoritative external-substitute option: PASS ✅",
    );

    console.log(
      "\nB6. Persisting administrator approval...",
    );

    const recordedDecision =
      requireData(
        await recordApprovedExceptionDecision(
          store,
          {
            decisionId:
              decisionBId,

            caseId:
              caseB.id,

            kind:
              externalOption.kind,

            periodIds:
              externalOption.periodIds,

            summary:
              externalOption.summary,

            now:
              new Date(
                "2026-09-14T06:05:00.000Z",
              ),

            decidedBy:
              "administrator-demo",

            activityEventId:
              `activity-b-decision-${nonce}`,

            correlationId:
              `correlation-b-${nonce}`,
          },
        ),
        "Scenario B decision persistence",
      );

    assert(
      recordedDecision
        .decision.status ===
        "approved",
      "Scenario B human decision was not persisted as approved.",
    );

    assert(
      recordedDecision
        .decision.kind ===
        "request_external_substitute",
      "Scenario B persisted the wrong exception kind.",
    );

    const caseBAfterDecision =
      await store.getCase(
        caseB.id,
      );

    assert(
      caseBAfterDecision
        ?.status ===
        "partially_covered",
      "Administrator approval must not falsely claim that P5 is already covered.",
    );

    console.log(
      "Human approval recorded without pretending fulfillment occurred: PASS ✅",
    );

    console.log(
      "\nB7. Trusted external fulfillment assigns P5...",
    );

    const fulfillment =
      requireData(
        await fulfillApprovedExternalSubstitute(
          store,
          {
            decisionId:
              decisionBId,

            externalSubstituteId,

            now:
              new Date(
                "2026-09-14T06:08:00.000Z",
              ),
          },
        ),
        "Scenario B external-substitute fulfillment",
      );

    assert(
      fulfillment.caseStatus ===
        "resolved",
      `Scenario B fulfillment expected resolved but received ${fulfillment.caseStatus}.`,
    );

    const [
      finalCaseB,
      assignmentsB,
      decisionsB,
    ] =
      await Promise.all([
        store.getCase(
          caseB.id,
        ),

        store.listAssignmentsByCase(
          caseB.id,
        ),

        store.listDecisionsByCase(
          caseB.id,
        ),
      ]);

    assert(
      finalCaseB?.status ===
        "resolved",
      "Scenario B authoritative case did not resolve.",
    );

    assert(
      assignmentsB.length ===
        2,
      `Scenario B expected two assignment records but found ${assignmentsB.length}.`,
    );

    assertPeriodSet(
      assignmentsB.flatMap(
        (assignment) =>
          assignment.periodIds,
      ),
      [
        "P2",
        "P3",
        "P5",
      ],
      "Scenario B covered periods",
    );

    const routineB =
      assignmentsB.find(
        (assignment) =>
          assignment.source ===
            "accepted_offer",
      );

    const exceptionB =
      assignmentsB.find(
        (assignment) =>
          assignment.source ===
            "approved_exception",
      );

    assert(
      routineB &&
        exceptionB,
      "Scenario B must contain both routine and approved-exception assignments.",
    );

    assertPeriodSet(
      routineB.periodIds,
      [
        "P2",
        "P3",
      ],
      "Scenario B routine periods",
    );

    assertPeriodSet(
      exceptionB.periodIds,
      [
        "P5",
      ],
      "Scenario B exception period",
    );

    assert(
      exceptionB.candidateId ===
        externalSubstituteId,
      "Scenario B P5 was not fulfilled by the authoritative external substitute.",
    );

    assert(
      decisionsB.length ===
        1 &&
      decisionsB[0]
        ?.status ===
        "approved",
      "Scenario B expected exactly one approved administrator decision.",
    );

    console.log(
      "Scenario B: PASS ✅ 3/3 covered, 2 routine periods + 1 approved exception",
    );

    /**
     * =====================================================================
     * SCENARIO C
     * =====================================================================
     */

    console.log(
      "\n=== Scenario C: Decline → Automatic Fallback ===",
    );

    console.log(
      "\nC1. Initial planning...",
    );

    const planCInitial =
      requireData(
        await planCoverageCase(
          store,
          {
            caseId:
              caseC.id,
          },
        ),
        "Scenario C initial planning",
      );

    assert(
      planCInitial.plan
        .unresolvedPeriodIds
        .length ===
        0,
      "Scenario C should initially have a complete routine option.",
    );

    console.log(
      "Complete routine coverage available: PASS ✅",
    );

    console.log(
      "\nC2. Offering Emma Brooks...",
    );

    requireData(
      await createCoverageOffer(
        store,
        {
          offerId:
            offerCEmmaId,

          caseId:
            caseC.id,

          candidateId:
            emma.id,

          periodIds: [
            "P1",
            "P3",
            "P6",
          ],

          now:
            new Date(
              "2026-09-14T06:11:00.000Z",
            ),

          expiresAt:
            new Date(
              "2026-09-14T06:45:00.000Z",
            ),

          activityEventId:
            `activity-c-emma-offer-${nonce}`,

          correlationId:
            `correlation-c-${nonce}`,
        },
      ),
      "Scenario C Emma offer",
    );

    requireData(
      await reconcileCoverageCase(
        store,
        {
          caseId:
            caseC.id,

          now:
            new Date(
              "2026-09-14T06:12:00.000Z",
            ),

          activityEventId:
            `activity-c-reconcile-emma-offering-${nonce}`,

          correlationId:
            `correlation-c-${nonce}`,
        },
      ),
      "Scenario C Emma offering reconciliation",
    );

    console.log(
      "\nC3. Emma declines...",
    );

    requireData(
      await respondToCoverageOffer(
        store,
        {
          offerId:
            offerCEmmaId,

          response:
            "declined",

          now:
            new Date(
              "2026-09-14T06:14:00.000Z",
            ),

          activityEventId:
            `activity-c-emma-declined-${nonce}`,

          correlationId:
            `correlation-c-${nonce}`,
        },
      ),
      "Scenario C Emma decline",
    );

    requireData(
      await reconcileCoverageCase(
        store,
        {
          caseId:
            caseC.id,

          now:
            new Date(
              "2026-09-14T06:15:00.000Z",
            ),

          activityEventId:
            `activity-c-reconcile-after-decline-${nonce}`,

          correlationId:
            `correlation-c-${nonce}`,
        },
      ),
      "Scenario C decline reconciliation",
    );

    console.log(
      "Decline persisted: PASS ✅",
    );

    console.log(
      "\nC4. Re-planning excludes Emma and retains a safe fallback...",
    );

    const planCFallback =
      requireData(
        await planCoverageCase(
          store,
          {
            caseId:
              caseC.id,
          },
        ),
        "Scenario C fallback planning",
      );

    assert(
      planCFallback.plan
        .unresolvedPeriodIds
        .length ===
        0,
      "Scenario C fallback should still have complete routine coverage through Noah.",
    );

    console.log(
      "Fallback planning: PASS ✅",
    );

    console.log(
      "\nC5. Offering Noah Carter...",
    );

    requireData(
      await createCoverageOffer(
        store,
        {
          offerId:
            offerCNoahId,

          caseId:
            caseC.id,

          candidateId:
            noah.id,

          periodIds: [
            "P1",
            "P3",
            "P6",
          ],

          now:
            new Date(
              "2026-09-14T06:17:00.000Z",
            ),

          expiresAt:
            new Date(
              "2026-09-14T06:50:00.000Z",
            ),

          activityEventId:
            `activity-c-noah-offer-${nonce}`,

          correlationId:
            `correlation-c-${nonce}`,
        },
      ),
      "Scenario C Noah offer",
    );

    console.log(
      "\nC6. Noah accepts and is assigned...",
    );

    requireData(
      await respondToCoverageOffer(
        store,
        {
          offerId:
            offerCNoahId,

          response:
            "accepted",

          now:
            new Date(
              "2026-09-14T06:19:00.000Z",
            ),

          activityEventId:
            `activity-c-noah-accepted-${nonce}`,

          correlationId:
            `correlation-c-${nonce}`,
        },
      ),
      "Scenario C Noah acceptance",
    );

    requireData(
      await assignAcceptedCoverage(
        store,
        {
          assignmentId:
            assignmentCId,

          offerId:
            offerCNoahId,

          now:
            new Date(
              "2026-09-14T06:21:00.000Z",
            ),

          activityEventId:
            `activity-c-noah-assignment-${nonce}`,

          correlationId:
            `correlation-c-${nonce}`,
        },
      ),
      "Scenario C Noah assignment",
    );

    const reconcileC =
      requireData(
        await reconcileCoverageCase(
          store,
          {
            caseId:
              caseC.id,

            now:
              new Date(
                "2026-09-14T06:22:00.000Z",
              ),

            activityEventId:
              `activity-c-reconcile-resolved-${nonce}`,

            correlationId:
              `correlation-c-${nonce}`,
          },
        ),
        "Scenario C final reconciliation",
      );

    assert(
      reconcileC.currentStatus ===
        "resolved",
      `Scenario C expected resolved but received ${reconcileC.currentStatus}.`,
    );

    const [
      finalCaseC,
      offersC,
      assignmentsC,
      decisionsC,
    ] =
      await Promise.all([
        store.getCase(
          caseC.id,
        ),

        store.listOffersByCase(
          caseC.id,
        ),

        store.listAssignmentsByCase(
          caseC.id,
        ),

        store.listDecisionsByCase(
          caseC.id,
        ),
      ]);

    assert(
      finalCaseC?.status ===
        "resolved",
      "Scenario C authoritative case did not resolve.",
    );

    assert(
      offersC.length ===
        2,
      `Scenario C expected two offers but found ${offersC.length}.`,
    );

    const emmaOffer =
      offersC.find(
        (offer) =>
          offer.id ===
            offerCEmmaId,
      );

    const noahOffer =
      offersC.find(
        (offer) =>
          offer.id ===
            offerCNoahId,
      );

    assert(
      emmaOffer?.status ===
        "declined",
      "Scenario C must retain Emma's authoritative decline.",
    );

    assert(
      noahOffer?.status ===
        "accepted",
      "Scenario C must retain Noah's authoritative acceptance.",
    );

    assert(
      assignmentsC.length ===
        1,
      `Scenario C expected one assignment but found ${assignmentsC.length}.`,
    );

    assert(
      assignmentsC[0]
        ?.candidateId ===
        noah.id,
      "Scenario C final assignment was not Noah Carter.",
    );

    assertPeriodSet(
      assignmentsC[0]
        ?.periodIds ??
        [],
      [
        "P1",
        "P3",
        "P6",
      ],
      "Scenario C covered periods",
    );

    assert(
      decisionsC.length ===
        0,
      "Scenario C fallback should not require administrator judgment.",
    );

    console.log(
      "Scenario C: PASS ✅ Emma declined → Noah accepted → 3/3 resolved",
    );

    /**
     * =====================================================================
     * FINAL LEDGER / AUTHORITATIVE STATE
     * =====================================================================
     */

    console.log(
      "\n=== Final Authoritative Verification ===",
    );

    const [
      activityA,
      activityB,
      activityC,
    ] =
      await Promise.all([
        store.listActivityByCase(
          caseA.id,
        ),

        store.listActivityByCase(
          caseB.id,
        ),

        store.listActivityByCase(
          caseC.id,
        ),
      ]);

    assert(
      activityA.length >
        0 &&
      activityB.length >
        0 &&
      activityC.length >
        0,
      "Every workflow must leave operational evidence in the activity ledger.",
    );

    assert(
      activityB.some(
        (event) =>
          event.action ===
            "human_exception_decision_approved",
      ),
      "Scenario B ledger is missing administrator-decision evidence.",
    );

    assert(
      activityB.some(
        (event) =>
          event.action ===
            "coverage_assignment_created" &&
          event.summary.includes(
            externalSubstituteId,
          ),
      ),
      "Scenario B ledger is missing external-substitute assignment evidence.",
    );

    assert(
      activityC.some(
        (event) =>
          event.action ===
            "coverage_offer_declined",
      ),
      "Scenario C ledger is missing Emma's decline evidence.",
    );

    console.log(
      "Activity-ledger evidence: PASS ✅",
    );

    console.log(
      "\n=== DynamoDbBeforeBellStore 3E Connected ===\n",
    );

    console.log(
      "Scenario A — full autonomous resolution: PASS",
    );

    console.log(
      "Scenario B — routine + approved exception: PASS",
    );

    console.log(
      "Scenario C — decline + automatic fallback: PASS",
    );

    console.log(
      "Application action layer → DynamoDB: PASS",
    );

    console.log(
      "Case reconciliation → authoritative terminal state: PASS",
    );

    console.log(
      "Operational activity ledger: PASS",
    );

    console.log(
      "\nAll three BeforeBell workflows completed against real DynamoDB. ✅",
    );
  } finally {
    console.log(
      "\nDiscovering synthetic 3E artifacts for cleanup...",
    );

    let discoveryFailures =
      0;

    for (
      const absenceCase of
      allCases
    ) {
      try {
        await discoverCaseArtifacts(
          absenceCase,
        );
      } catch (
        discoveryError
      ) {
        discoveryFailures +=
          1;

        console.error(
          `WARNING: could not fully discover artifacts for ${absenceCase.id}.`,
        );

        console.error(
          discoveryError,
        );
      }
    }

    console.log(
      `Explicit cleanup keys: ${cleanupKeys.size}`,
    );

    console.log(
      "Cleaning synthetic 3E records...",
    );

    let cleanupFailures =
      0;

    for (
      const key of
      cleanupKeys.values()
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
      discoveryFailures ===
        0 &&
      cleanupFailures ===
        0
    ) {
      console.log(
        "Cleanup complete. ✅",
      );
    } else {
      console.error(
        `Cleanup finished with ${discoveryFailures} discovery failure(s) and ${cleanupFailures} delete failure(s).`,
      );
    }
  }
}

main().catch(
  (error) => {
    console.error(
      "\nBeforeBell DynamoDB 3E workflow smoke failed.",
    );

    console.error(
      error,
    );

    process.exitCode =
      1;
  },
);