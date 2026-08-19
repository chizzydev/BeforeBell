import {
  InterruptResponseContent,
} from "@strands-agents/sdk";

import {
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

import {
  randomUUID,
} from "node:crypto";

import {
  createInterface,
} from "node:readline/promises";

import {
  stdin as input,
  stdout as output,
} from "node:process";

import {
  config as loadEnvironment,
} from "dotenv";

import {
  createBeforeBellAgent,
} from "../src/agent/beforebell-agent";

import {
  fulfillApprovedExternalSubstitute,
} from "../src/application/actions/fulfill-approved-external-substitute";

import {
  riversideCoveragePolicy,
  scenarioBAbsence,
  scenarioBCandidates,
} from "../src/fixtures/riverside";

import type {
  AbsenceCase,
  CoverageAssignment,
  CoverageCandidate,
  CoverageOffer,
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

loadEnvironment({
  path:
    ".env.local",
});

const DEV_TABLE_NAME =
  "beforebell-dev";

interface DisplayInterruptOption {
  optionId: string;
  kind: string;
  summary: string;
}

interface PhysicalKey {
  PK: string;
  SK: string;
}

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

function isRecord(
  value: unknown,
): value is Record<
  string,
  unknown
> {
  return (
    typeof value ===
      "object" &&
    value !== null &&
    !Array.isArray(
      value,
    )
  );
}

function readInterruptOptions(
  reason: unknown,
): DisplayInterruptOption[] {
  if (!isRecord(reason)) {
    throw new Error(
      "Interrupt reason was not an object.",
    );
  }

  const rawOptions =
    reason.options;

  if (
    !Array.isArray(
      rawOptions,
    )
  ) {
    throw new Error(
      "Interrupt did not contain an options array.",
    );
  }

  return rawOptions.map(
    (
      value,
      index,
    ): DisplayInterruptOption => {
      if (!isRecord(value)) {
        throw new Error(
          `Interrupt option ${index + 1} was not an object.`,
        );
      }

      const {
        optionId,
        kind,
        summary,
      } = value;

      if (
        typeof optionId !==
          "string" ||
        typeof kind !==
          "string" ||
        typeof summary !==
          "string"
      ) {
        throw new Error(
          `Interrupt option ${index + 1} was malformed.`,
        );
      }

      return {
        optionId,
        kind,
        summary,
      };
    },
  );
}

function assertPeriodSet(
  actual:
    readonly PeriodId[],
  expected:
    readonly PeriodId[],
  label: string,
): void {
  const actualSet =
    new Set(
      actual,
    );

  const expectedSet =
    new Set(
      expected,
    );

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
      `Refusing connected HITL smoke against "${config.tableName}". Expected exactly "${DEV_TABLE_NAME}".`,
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
    `school-agent-hitl-${nonce}`;

  const caseId =
    `case-scenario-b-agent-hitl-${nonce}`;

  const policy = {
    ...riversideCoveragePolicy,

    schoolId,
  };

  const candidates:
    CoverageCandidate[] =
      scenarioBCandidates.map(
        (candidate) => ({
          ...candidate,

          id:
            `${candidate.id}-agent-hitl-${nonce}`,

          schoolId,
        }),
      );

  const jordan =
    candidates.find(
      (candidate) =>
        candidate.name ===
        "Jordan Lee",
    );

  const msTaylor =
    candidates.find(
      (candidate) =>
        candidate.name ===
        "Ms. Taylor",
    );

  assert(
    jordan,
    "Synthetic Jordan Lee candidate was not constructed.",
  );

  assert(
    msTaylor,
    "Synthetic Ms. Taylor candidate was not constructed.",
  );

  /**
   * Authoritative event-driven state at the point where routine
   * P2/P3 coverage has already completed.
   */
  const partiallyCoveredCase:
    AbsenceCase = {
      ...scenarioBAbsence,

      id:
        caseId,

      schoolId,

      absentStaffMemberId:
        `staff-daniel-reed-agent-hitl-${nonce}`,

      status:
        "partially_covered",

      updatedAt:
        "2026-09-14T06:05:00.000Z",
    };

  const routineOffer:
    CoverageOffer = {
      id:
        `offer-scenario-b-routine-agent-hitl-${nonce}`,

      caseId,

      candidateId:
        jordan.id,

      periodIds: [
        "P2",
        "P3",
      ],

      status:
        "accepted",

      createdAt:
        "2026-09-14T05:55:00.000Z",

      expiresAt:
        "2026-09-14T06:30:00.000Z",

      respondedAt:
        "2026-09-14T06:00:00.000Z",
    };

  const routineAssignment:
    CoverageAssignment = {
      id:
        `assignment-scenario-b-routine-agent-hitl-${nonce}`,

      caseId,

      candidateId:
        jordan.id,

      periodIds: [
        "P2",
        "P3",
      ],

      source:
        "accepted_offer",

      offerId:
        routineOffer.id,

      createdAt:
        "2026-09-14T06:05:00.000Z",
    };

  const externalSubstituteId =
    `external-substitute-morgan-ellis-${nonce}`;

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

  addCleanupKey(
    dynamoKeys.coveragePolicy(
      schoolId,
    ),
  );

  addCleanupKey(
    dynamoKeys.caseMeta(
      caseId,
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

  /**
   * Dynamic IDs are generated by several application/tool operations.
   * Discover them from authoritative state before cleanup rather than
   * duplicating the production identity algorithms here.
   */
  async function discoverArtifacts() {
    const [
      offers,
      assignments,
      decisions,
      activities,
    ] =
      await Promise.all([
        store.listOffersByCase(
          caseId,
        ),

        store.listAssignmentsByCase(
          caseId,
        ),

        store.listDecisionsByCase(
          caseId,
        ),

        store.listActivityByCase(
          caseId,
        ),
      ]);

    for (
      const offer of
      offers
    ) {
      addCleanupKey(
        dynamoKeys.caseOffer(
          caseId,
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
          caseId,
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
          partiallyCoveredCase.date,
          assignment.id,
        ),
      );

      addCleanupKey(
        dynamoKeys.candidateCapacity(
          assignment.candidateId,
          partiallyCoveredCase.date,
        ),
      );

      for (
        const periodId of
        assignment.periodIds
      ) {
        addCleanupKey(
          dynamoKeys.casePeriodLock(
            caseId,
            periodId,
          ),
        );

        addCleanupKey(
          dynamoKeys.candidatePeriodLock(
            assignment.candidateId,
            partiallyCoveredCase.date,
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
          caseId,
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
      const event of
      activities
    ) {
      addCleanupKey(
        dynamoKeys.caseActivity(
          caseId,
          event.eventId,
        ),
      );
    }
  }

  console.log(
    "\n=== BeforeBell 4A — Strands + Bedrock + DynamoDB HITL ===\n",
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

  console.log(
    `Synthetic case: ${caseId}`,
  );

  console.log(
    `Run nonce: ${nonce}`,
  );

  try {
    /**
     * ================================================================
     * SEED AUTHORITATIVE PRE-INTERRUPT STATE
     * ================================================================
     */

    console.log(
      "\n0. Seeding authoritative Scenario B state...",
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

    await store.putCase(
      partiallyCoveredCase,
    );

    await store.putOffer(
      routineOffer,
    );

    await store.putAssignment(
      routineAssignment,
    );

    const seededAssignments =
      await store.listAssignmentsByCase(
        caseId,
      );

    assert(
      seededAssignments.length ===
        1,
      "Expected exactly one seeded routine assignment.",
    );

    assertPeriodSet(
      seededAssignments[0]
        ?.periodIds ??
        [],
      [
        "P2",
        "P3",
      ],
      "Seeded routine coverage",
    );

    console.log(
      "P2/P3 routine state persisted in real DynamoDB: PASS ✅",
    );

    /**
     * ================================================================
     * REAL STRANDS AGENT
     * ================================================================
     */

    const agent =
      createBeforeBellAgent(
        store,
      );

    console.log(
      "\n1. Invoking real Strands/Bedrock agent...",
    );

    const interruptedResult =
      await agent.invoke(`
Continue coordination for coverage case "${caseId}".

Routine coverage may already exist for part of this absence.

Inspect authoritative BeforeBell state.

Do not duplicate existing coverage.
Do not simulate candidate acceptance.
Do not select an exception yourself.

If deterministic routine planning cannot safely resolve every remaining period,
request the required administrator judgment through the dedicated BeforeBell
human-decision tool.

Do not invent an administrator response.
`);

    console.log(
      "Stop reason:",
      interruptedResult.stopReason,
    );

    assert(
      interruptedResult.stopReason ===
        "interrupt",
      `Expected a real Strands interrupt but received "${interruptedResult.stopReason}".`,
    );

    const interrupt =
      interruptedResult
        .interrupts?.[0];

    assert(
      interrupt,
      "Agent stopped for interrupt but supplied no interrupt payload.",
    );

    console.log(
      "Real Strands interrupt: PASS ✅",
    );

    /**
     * ================================================================
     * HUMAN JUDGMENT
     * ================================================================
     */

    const choices =
      readInterruptOptions(
        interrupt.reason,
      );

    console.log(
      "\n=== Authoritative Administrator Choices ===\n",
    );

    choices.forEach(
      (
        choice,
        index,
      ) => {
        console.log(
          `${index + 1}. ${choice.summary}`,
        );

        console.log(
          `   kind: ${choice.kind}`,
        );

        console.log(
          `   optionId: ${choice.optionId}`,
        );
      },
    );

    const externalChoiceIndex =
      choices.findIndex(
        (choice) =>
          choice.kind ===
            "request_external_substitute",
      );

    assert(
      externalChoiceIndex >=
        0,
      "Authoritative interrupt did not include an external-substitute option.",
    );

    console.log(
      `\nFor the centerpiece path, choose option ${externalChoiceIndex + 1}: external substitute.`,
    );

    const readline =
      createInterface({
        input,
        output,
      });

    const answer =
      await readline.question(
        "\nAdministrator selection: ",
      );

    readline.close();

    const selectedIndex =
      Number.parseInt(
        answer.trim(),
        10,
      ) - 1;

    const selectedChoice =
      choices[selectedIndex];

    assert(
      selectedChoice,
      "Administrator selection was outside the authoritative option range.",
    );

    assert(
      selectedChoice.kind ===
        "request_external_substitute",
      "Checkpoint 4A centerpiece expects the administrator to select the external-substitute option.",
    );

    console.log(
      "\nHuman selected:",
      selectedChoice.summary,
    );

    console.log(
      `Selected authoritative optionId: ${selectedChoice.optionId}`,
    );

    /**
     * ================================================================
     * REAL STRANDS RESUME
     * ================================================================
     */

    console.log(
      "\n2. Resuming the SAME Strands Agent instance...",
    );

    const resumedResult =
      await agent.invoke([
        new InterruptResponseContent({
          interruptId:
            interrupt.id,

          response: {
            optionId:
              selectedChoice.optionId,
          },
        }),
      ]);

    console.log(
      "Stop reason:",
      resumedResult.stopReason,
    );

    assert(
      resumedResult.stopReason ===
        "endTurn",
      `Expected resumed agent to finish with endTurn but received "${resumedResult.stopReason}".`,
    );

    console.log(
      "Real Strands resume: PASS ✅",
    );

    /**
     * ================================================================
     * VERIFY HUMAN DECISION WAS DURABLE BUT NOT EXECUTED
     * ================================================================
     */

    console.log(
      "\n3. Checking authoritative DynamoDB state after HITL...",
    );

    const [
      caseAfterDecision,
      decisionsAfterResume,
      assignmentsAfterResume,
    ] =
      await Promise.all([
        store.getCase(
          caseId,
        ),

        store.listDecisionsByCase(
          caseId,
        ),

        store.listAssignmentsByCase(
          caseId,
        ),
      ]);

    assert(
      caseAfterDecision?.status ===
        "partially_covered",
      `Approval must not claim resolution. Received case status "${caseAfterDecision?.status}".`,
    );

    assert(
      decisionsAfterResume.length ===
        1,
      `Expected exactly one durable human decision but found ${decisionsAfterResume.length}.`,
    );

    const approvedDecision =
      decisionsAfterResume[0];

    assert(
      approvedDecision,
      "Approved decision was missing.",
    );

    assert(
      approvedDecision.status ===
        "approved",
      "Human decision was not stored as approved.",
    );

    assert(
      approvedDecision.kind ===
        "request_external_substitute",
      "Wrong human-decision kind was persisted.",
    );

    assertPeriodSet(
      approvedDecision.periodIds,
      [
        "P5",
      ],
      "Approved decision scope",
    );

    const p5BeforeFulfillment =
      assignmentsAfterResume.filter(
        (assignment) =>
          assignment.periodIds.includes(
            "P5",
          ),
      );

    assert(
      p5BeforeFulfillment.length ===
        0,
      "The agent must not convert administrator approval into a fake P5 assignment.",
    );

    console.log(
      "Administrator decision persisted in DynamoDB: PASS ✅",
    );

    console.log(
      "Approval did NOT fabricate fulfillment: PASS ✅",
    );

    /**
     * ================================================================
     * TRUSTED EXTERNAL FULFILLMENT EVENT
     * ================================================================
     */

    console.log(
      "\n4. Delivering trusted external-substitute fulfillment event...",
    );

    const fulfillment =
      await fulfillApprovedExternalSubstitute(
        store,
        {
          decisionId:
            approvedDecision.id,

          externalSubstituteId,

          now:
            new Date(
              "2026-09-14T06:12:00.000Z",
            ),
        },
      );

    assert(
      fulfillment.success &&
        fulfillment.data,
      `External fulfillment failed [${fulfillment.code}]: ${fulfillment.message}`,
    );

    assert(
      fulfillment.data
        .caseStatus ===
        "resolved",
      `Expected external fulfillment to resolve the case but received "${fulfillment.data.caseStatus}".`,
    );

    console.log(
      "Trusted external fulfillment: PASS ✅",
    );

    /**
     * Exact replay should not create another assignment.
     */
    const fulfillmentReplay =
      await fulfillApprovedExternalSubstitute(
        store,
        {
          decisionId:
            approvedDecision.id,

          externalSubstituteId,

          now:
            new Date(
              "2026-09-14T06:13:00.000Z",
            ),
        },
      );

    assert(
      fulfillmentReplay.success &&
        fulfillmentReplay.data,
      `External fulfillment replay failed [${fulfillmentReplay.code}]: ${fulfillmentReplay.message}`,
    );

    assert(
      fulfillmentReplay.data
        .idempotentReplay ===
        true,
      "Expected exact external fulfillment retry to be idempotent.",
    );

    console.log(
      "External fulfillment replay idempotency: PASS ✅",
    );

    /**
     * ================================================================
     * FINAL AUTHORITATIVE STATE
     * ================================================================
     */

    console.log(
      "\n5. Verifying final authoritative state...",
    );

    const [
      finalCase,
      finalAssignments,
      finalDecisions,
      finalActivity,
    ] =
      await Promise.all([
        store.getCase(
          caseId,
        ),

        store.listAssignmentsByCase(
          caseId,
        ),

        store.listDecisionsByCase(
          caseId,
        ),

        store.listActivityByCase(
          caseId,
        ),
      ]);

    assert(
      finalCase?.status ===
        "resolved",
      "Final authoritative case did not resolve.",
    );

    assert(
      finalAssignments.length ===
        2,
      `Expected exactly two assignments but found ${finalAssignments.length}.`,
    );

    assertPeriodSet(
      finalAssignments.flatMap(
        (assignment) =>
          assignment.periodIds,
      ),
      [
        "P2",
        "P3",
        "P5",
      ],
      "Final covered periods",
    );

    const routineFinal =
      finalAssignments.find(
        (assignment) =>
          assignment.source ===
            "accepted_offer",
      );

    const exceptionFinal =
      finalAssignments.find(
        (assignment) =>
          assignment.source ===
            "approved_exception",
      );

    assert(
      routineFinal,
      "Final state is missing the routine assignment.",
    );

    assert(
      exceptionFinal,
      "Final state is missing the approved-exception assignment.",
    );

    assertPeriodSet(
      routineFinal.periodIds,
      [
        "P2",
        "P3",
      ],
      "Final routine assignment",
    );

    assertPeriodSet(
      exceptionFinal.periodIds,
      [
        "P5",
      ],
      "Final exception assignment",
    );

    assert(
      exceptionFinal.candidateId ===
        externalSubstituteId,
      "P5 assignment does not contain the authoritative external substitute.",
    );

    assert(
      finalDecisions.length ===
        1,
      `Expected exactly one final human decision but found ${finalDecisions.length}.`,
    );

    assert(
      finalActivity.some(
        (event) =>
          event.action ===
            "human_exception_decision_approved",
      ),
      "Activity ledger is missing administrator approval evidence.",
    );

    assert(
      finalActivity.some(
        (event) =>
          event.action ===
            "coverage_assignment_created" &&
          event.summary.includes(
            externalSubstituteId,
          ),
      ),
      "Activity ledger is missing external-substitute assignment evidence.",
    );

    console.log(
      "Final case status: resolved ✅",
    );

    console.log(
      "Covered periods: P2, P3, P5 ✅",
    );

    console.log(
      "Human decisions: 1 approved ✅",
    );

    console.log(
      "Activity evidence: PASS ✅",
    );

    console.log(
      "\n=== BeforeBell 4A Connected Runtime PASS ===\n",
    );

    console.log(
      "Bedrock model invocation: PASS",
    );

    console.log(
      "Strands agent orchestration: PASS",
    );

    console.log(
      "DynamoDB authoritative reads/writes: PASS",
    );

    console.log(
      "Real Strands HITL interrupt: PASS",
    );

    console.log(
      "Same-agent HITL resume: PASS",
    );

    console.log(
      "Administrator decision persistence: PASS",
    );

    console.log(
      "Approval ≠ execution boundary: PASS",
    );

    console.log(
      "Trusted external fulfillment: PASS",
    );

    console.log(
      "Atomic final assignment: PASS",
    );

    console.log(
      "Case resolution 3/3: PASS",
    );

    console.log(
      "\nStrands + Bedrock + DynamoDB are now connected end-to-end. ✅",
    );

    console.log(
      "\n=== Strands Metrics ===\n",
    );

    console.dir(
      agent.metrics,
      {
        depth:
          null,
      },
    );
  } finally {
    console.log(
      "\nDiscovering synthetic 4A artifacts for cleanup...",
    );

    let discoveryFailures =
      0;

    try {
      await discoverArtifacts();
    } catch (
      error
    ) {
      discoveryFailures +=
        1;

      console.error(
        "WARNING: failed to fully discover connected-runtime artifacts.",
      );

      console.error(
        error,
      );
    }

    console.log(
      `Explicit cleanup keys: ${cleanupKeys.size}`,
    );

    console.log(
      "Cleaning synthetic 4A records...",
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
        error
      ) {
        cleanupFailures +=
          1;

        console.error(
          `WARNING: cleanup failed for ${key.PK} / ${key.SK}`,
        );

        console.error(
          error,
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
        `Cleanup finished with ${discoveryFailures} discovery failure(s) and ${cleanupFailures} deletion failure(s).`,
      );
    }
  }
}

main().catch(
  (error) => {
    console.error(
      "\nBeforeBell connected Strands/DynamoDB HITL smoke failed.",
    );

    console.error(
      error,
    );

    process.exitCode =
      1;
  },
);