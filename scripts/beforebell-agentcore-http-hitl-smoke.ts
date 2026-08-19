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
  path: ".env.local",
});


const DEV_TABLE_NAME =
  "beforebell-dev";

const RUNTIME_URL =
  "http://127.0.0.1:8080/invocations";

const SESSION_HEADER =
  "X-Amzn-Bedrock-AgentCore-Runtime-Session-Id";


interface PhysicalKey {
  PK: string;
  SK: string;
}


interface InterruptOption {
  optionId: string;
  kind: string;
  summary: string;
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
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}


function assertPeriodSet(
  actual: readonly PeriodId[],
  expected: readonly PeriodId[],
  label: string,
): void {
  const actualSet =
    new Set(actual);

  const expectedSet =
    new Set(expected);

  assert(
    actualSet.size === expectedSet.size &&
      [...expectedSet].every(
        (periodId) =>
          actualSet.has(periodId),
      ),
    `${label}: expected ${[
      ...expectedSet,
    ].join(", ")} but received ${[
      ...actualSet,
    ].join(", ")}.`,
  );
}


function keyIdentity(
  key: PhysicalKey,
): string {
  return `${key.PK}\u0000${key.SK}`;
}


async function postRuntime(
  sessionId: string,
  body: unknown,
): Promise<unknown> {
  const response =
    await fetch(
      RUNTIME_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          [SESSION_HEADER]:
            sessionId,
        },

        body:
          JSON.stringify(body),
      },
    );

  const text =
    await response.text();

  let parsed: unknown;

  try {
    parsed =
      JSON.parse(text) as unknown;
  } catch {
    throw new Error(
      `Runtime returned non-JSON HTTP ${response.status}: ${text}`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `Runtime returned HTTP ${response.status}: ${JSON.stringify(parsed)}`,
    );
  }

  return parsed;
}


function readInterrupt(
  response: unknown,
): {
  id: string;
  options: InterruptOption[];
} {
  assert(
    isRecord(response),
    "Runtime interrupt response was not an object.",
  );

  assert(
    response.status === "interrupt",
    `Expected runtime status "interrupt" but received "${String(response.status)}".`,
  );

  assert(
    response.stopReason === "interrupt",
    `Expected stopReason "interrupt" but received "${String(response.stopReason)}".`,
  );

  const interrupt =
    response.interrupt;

  assert(
    isRecord(interrupt),
    "Runtime response did not contain an interrupt object.",
  );

  assert(
    typeof interrupt.id === "string" &&
      interrupt.id.length > 0,
    "Runtime interrupt did not contain an ID.",
  );

  assert(
    Array.isArray(interrupt.options),
    "Runtime interrupt did not contain authoritative options.",
  );

  const options =
    interrupt.options.map(
      (
        value,
        index,
      ): InterruptOption => {
        assert(
          isRecord(value),
          `Interrupt option ${index + 1} was not an object.`,
        );

        assert(
          typeof value.optionId === "string" &&
            typeof value.kind === "string" &&
            typeof value.summary === "string",
          `Interrupt option ${index + 1} was malformed.`,
        );

        return {
          optionId:
            value.optionId,

          kind:
            value.kind,

          summary:
            value.summary,
        };
      },
    );

  return {
    id:
      interrupt.id,

    options,
  };
}


async function main() {
  const config =
    getBeforeBellDynamoConfig();

  assert(
    config.tableName ===
      DEV_TABLE_NAME,
    `Refusing HTTP HITL smoke against "${config.tableName}". Expected exactly "${DEV_TABLE_NAME}".`,
  );

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

  const sessionId =
    `beforebell-agentcore-hitl-${randomUUID()}`;

  const schoolId =
    `school-agentcore-hitl-${nonce}`;

  const caseId =
    `case-agentcore-hitl-${nonce}`;

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
            `${candidate.id}-agentcore-hitl-${nonce}`,

          schoolId,
        }),
      );

  const jordan =
    candidates.find(
      (candidate) =>
        candidate.name ===
        "Jordan Lee",
    );

  assert(
    jordan,
    "Synthetic Jordan Lee candidate was not constructed.",
  );

  const partiallyCoveredCase:
    AbsenceCase = {
      ...scenarioBAbsence,

      id:
        caseId,

      schoolId,

      absentStaffMemberId:
        `staff-daniel-reed-agentcore-hitl-${nonce}`,

      status:
        "partially_covered",

      updatedAt:
        "2026-09-14T06:05:00.000Z",
    };

  const routineOffer:
    CoverageOffer = {
      id:
        `offer-agentcore-routine-${nonce}`,

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
        `assignment-agentcore-routine-${nonce}`,

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
    `external-substitute-agentcore-${nonce}`;

  const cleanupKeys =
    new Map<
      string,
      PhysicalKey
    >();

  const addCleanupKey = (
    key: PhysicalKey,
  ) => {
    cleanupKeys.set(
      keyIdentity(key),
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
    "\n=== BeforeBell 4B.9 — HTTP HITL Smoke ===\n",
  );

  console.log(
    `Runtime: ${RUNTIME_URL}`,
  );

  console.log(
    `Session: ${sessionId}`,
  );

  console.log(
    `Case: ${caseId}`,
  );

  try {
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

    console.log(
      "P2/P3 routine coverage persisted: PASS ✅",
    );


    console.log(
      "\n1. Invoking BeforeBell through HTTP /invocations...",
    );

    const firstResponse =
      await postRuntime(
        sessionId,
        {
          type:
            "invoke",

          prompt: `
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
`.trim(),
        },
      );

    const interrupt =
      readInterrupt(
        firstResponse,
      );

    console.log(
      "HTTP → Strands interrupt: PASS ✅",
    );

    console.log(
      "\n=== Authoritative Administrator Choices ===\n",
    );

    interrupt.options.forEach(
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
      interrupt.options.findIndex(
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
      interrupt.options[
        selectedIndex
      ];

    assert(
      selectedChoice,
      "Administrator selection was outside the authoritative option range.",
    );

    assert(
      selectedChoice.kind ===
        "request_external_substitute",
      "Checkpoint 4B.9 expects the external-substitute centerpiece path.",
    );

    console.log(
      `Selected authoritative optionId: ${selectedChoice.optionId}`,
    );


    console.log(
      "\n2. Resuming through a SECOND HTTP request with the SAME session...",
    );

    const resumedResponse =
      await postRuntime(
        sessionId,
        {
          type:
            "resume",

          interruptId:
            interrupt.id,

          optionId:
            selectedChoice.optionId,
        },
      );

    assert(
      isRecord(
        resumedResponse,
      ),
      "Runtime resume response was not an object.",
    );

    assert(
      resumedResponse.status ===
        "completed",
      `Expected completed resume but received "${String(resumedResponse.status)}".`,
    );

    assert(
      resumedResponse.stopReason ===
        "endTurn",
      `Expected endTurn after resume but received "${String(resumedResponse.stopReason)}".`,
    );

    assert(
      resumedResponse.sessionId ===
        sessionId,
      "Runtime resume did not preserve the expected session ID.",
    );

    console.log(
      "Same-session HTTP resume: PASS ✅",
    );


    console.log(
      "\n3. Verifying durable human decision in DynamoDB...",
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
      `Approval must not claim resolution. Received "${caseAfterDecision?.status}".`,
    );

    assert(
      decisionsAfterResume.length ===
        1,
      `Expected exactly one human decision but found ${decisionsAfterResume.length}.`,
    );

    const approvedDecision =
      decisionsAfterResume[0];

    assert(
      approvedDecision,
      "Approved human decision was missing.",
    );

    assert(
      approvedDecision.status ===
        "approved",
      "Human decision was not persisted as approved.",
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
      "Administrator approval incorrectly fabricated a P5 assignment.",
    );

    console.log(
      "Human decision persistence: PASS ✅",
    );

    console.log(
      "Approval ≠ execution boundary: PASS ✅",
    );


    console.log(
      "\n4. Delivering trusted external-substitute fulfillment...",
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
      fulfillment.data.caseStatus ===
        "resolved",
      `Expected resolved case but received "${fulfillment.data.caseStatus}".`,
    );

    console.log(
      "Trusted fulfillment: PASS ✅",
    );


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

    assert(
      finalDecisions.length ===
        1,
      `Expected one final human decision but found ${finalDecisions.length}.`,
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
      "Final case: resolved ✅",
    );

    console.log(
      "Covered periods: P2, P3, P5 ✅",
    );

    console.log(
      "Activity evidence: PASS ✅",
    );


    console.log(
      "\n=== BeforeBell 4B.9 HTTP HITL PASS ===\n",
    );

    console.log(
      "HTTP /invocations: PASS",
    );

    console.log(
      "Strands + Bedrock: PASS",
    );

    console.log(
      "DynamoDB authoritative state: PASS",
    );

    console.log(
      "Real HITL interrupt over HTTP: PASS",
    );

    console.log(
      "Manual administrator choice: PASS",
    );

    console.log(
      "Second HTTP request: PASS",
    );

    console.log(
      "Same runtime session resume: PASS",
    );

    console.log(
      "Durable human decision: PASS",
    );

    console.log(
      "Approval ≠ execution: PASS",
    );

    console.log(
      "Trusted fulfillment: PASS",
    );

    console.log(
      "Scenario B resolved 3/3: PASS",
    );
  } finally {
    console.log(
      "\nDiscovering synthetic 4B.9 artifacts...",
    );

    let discoveryFailures =
      0;

    try {
      await discoverArtifacts();
    } catch (error) {
      discoveryFailures +=
        1;

      console.error(
        "WARNING: artifact discovery failed.",
      );

      console.error(
        error,
      );
    }

    console.log(
      `Cleanup keys: ${cleanupKeys.size}`,
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
      } catch (error) {
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
      "\nBeforeBell AgentCore HTTP HITL smoke failed.",
    );

    console.error(
      error,
    );

    process.exitCode =
      1;
  },
);