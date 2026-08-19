import {
  BedrockAgentCoreClient,
  InvokeAgentRuntimeCommand,
} from "@aws-sdk/client-bedrock-agentcore";

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

const REGION =
  "us-east-1";

const RUNTIME_ARN =
  process.env.BEFOREBELL_AGENTCORE_RUNTIME_ARN?.trim();

if (!RUNTIME_ARN) {
  throw new Error(
    "BEFOREBELL_AGENTCORE_RUNTIME_ARN is required for the remote AgentCore smoke test.",
  );
}

interface DisplayInterruptOption {
  optionId: string;
  kind: string;
  summary: string;
}


interface RemoteInterrupt {
  id: string;
  reason: unknown;
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
      "Remote interrupt reason was not an object.",
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
      "Remote interrupt did not contain an options array.",
    );
  }

  return rawOptions.map(
    (
      value,
      index,
    ): DisplayInterruptOption => {
      if (!isRecord(value)) {
        throw new Error(
          `Remote interrupt option ${index + 1} was not an object.`,
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
          `Remote interrupt option ${index + 1} was malformed.`,
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


function readRemoteInterrupt(
  payload: unknown,
  expectedSessionId: string,
): RemoteInterrupt {
  assert(
    isRecord(payload),
    "Remote AgentCore interrupt response was not a JSON object.",
  );

  assert(
    payload.sessionId ===
      expectedSessionId,
    `Remote response session mismatch. Expected "${expectedSessionId}".`,
  );

  assert(
    payload.stopReason ===
      "interrupt",
    `Expected remote stopReason "interrupt" but received "${String(
      payload.stopReason,
    )}".`,
  );

  let rawInterrupt:
    unknown;

  if (
    isRecord(
      payload.interrupt,
    )
  ) {
    rawInterrupt =
      payload.interrupt;
  } else if (
    Array.isArray(
      payload.interrupts,
    )
  ) {
    assert(
      payload.interrupts.length ===
        1,
      `Expected exactly one remote interrupt but received ${payload.interrupts.length}.`,
    );

    rawInterrupt =
      payload.interrupts[0];
  }

  assert(
    isRecord(
      rawInterrupt,
    ),
    "Remote AgentCore response did not contain a usable interrupt payload.",
  );

  assert(
    typeof rawInterrupt.id ===
      "string" &&
      rawInterrupt.id.length >
        0,
    "Remote interrupt did not contain a valid interrupt ID.",
  );

  return {
    id:
      rawInterrupt.id,

    reason:
      rawInterrupt.reason,
  };
}


function assertRemoteCompleted(
  payload: unknown,
  expectedSessionId: string,
): void {
  assert(
    isRecord(payload),
    "Remote AgentCore completion response was not a JSON object.",
  );

  assert(
    payload.sessionId ===
      expectedSessionId,
    `Remote completion session mismatch. Expected "${expectedSessionId}".`,
  );

  assert(
    payload.stopReason ===
      "endTurn",
    `Expected remote stopReason "endTurn" but received "${String(
      payload.stopReason,
    )}".`,
  );

  assert(
    payload.status ===
      "completed",
    `Expected remote status "completed" but received "${String(
      payload.status,
    )}".`,
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


async function invokeRemoteAgent(
  client:
    BedrockAgentCoreClient,
  runtimeSessionId:
    string,
  payload:
    Record<
      string,
      unknown
    >,
): Promise<unknown> {
  const response =
    await client.send(
      new InvokeAgentRuntimeCommand({
        agentRuntimeArn:
          RUNTIME_ARN,

        runtimeSessionId,

        qualifier:
          "DEFAULT",

        contentType:
          "application/json",

        accept:
          "application/json",

        payload:
          JSON.stringify(
            payload,
          ),
      }),
    );

  assert(
    response.$metadata
      .httpStatusCode ===
      200,
    `AgentCore invocation returned HTTP ${String(
      response.$metadata
        .httpStatusCode,
    )}.`,
  );

  assert(
    response.runtimeSessionId ===
      runtimeSessionId,
    `AgentCore returned unexpected runtime session "${String(
      response.runtimeSessionId,
    )}".`,
  );

  assert(
    response.response,
    "AgentCore invocation returned no response body.",
  );

  const responseText =
    await response.response
      .transformToString();

  assert(
    responseText.trim()
      .length >
      0,
    "AgentCore invocation returned an empty response body.",
  );

  try {
    return JSON.parse(
      responseText,
    ) as unknown;
  } catch {
    throw new Error(
      `AgentCore returned non-JSON content: ${responseText}`,
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
      `Refusing remote HITL smoke against "${config.tableName}". Expected exactly "${DEV_TABLE_NAME}".`,
    );
  }

  if (
    config.region !==
    REGION
  ) {
    throw new Error(
      `Refusing remote HITL smoke in region "${config.region}". Expected exactly "${REGION}".`,
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

  const agentCoreClient =
    new BedrockAgentCoreClient({
      region:
        REGION,
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
    `school-agentcore-remote-hitl-${nonce}`;

  const caseId =
    `case-scenario-b-agentcore-remote-hitl-${nonce}`;

  const runtimeSessionId =
    `beforebell-remote-hitl-${randomUUID().replaceAll(
      "-",
      "",
    )}`;

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
            `${candidate.id}-agentcore-remote-${nonce}`,

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

  const partiallyCoveredCase:
    AbsenceCase = {
      ...scenarioBAbsence,

      id:
        caseId,

      schoolId,

      absentStaffMemberId:
        `staff-daniel-reed-agentcore-remote-${nonce}`,

      status:
        "partially_covered",

      updatedAt:
        "2026-09-14T06:05:00.000Z",
    };

  const routineOffer:
    CoverageOffer = {
      id:
        `offer-scenario-b-routine-agentcore-remote-${nonce}`,

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
        `assignment-scenario-b-routine-agentcore-remote-${nonce}`,

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
    `external-substitute-morgan-ellis-agentcore-remote-${nonce}`;

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

  const addOfferCleanupKeys = (
    offer:
      CoverageOffer,
  ) => {
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
  };

  const addAssignmentCleanupKeys = (
    assignment:
      CoverageAssignment,
  ) => {
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

  addOfferCleanupKeys(
    routineOffer,
  );

  addAssignmentCleanupKeys(
    routineAssignment,
  );

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
      addOfferCleanupKeys(
        offer,
      );
    }

    for (
      const assignment of
      assignments
    ) {
      addAssignmentCleanupKeys(
        assignment,
      );
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
    "\n=== BeforeBell 4C.3 — REMOTE AgentCore Scenario B HITL ===\n",
  );

  console.log(
    `Region:          ${config.region}`,
  );

  console.log(
    `DynamoDB table:  ${config.tableName}`,
  );

  console.log(
    `Runtime ARN:     ${RUNTIME_ARN}`,
  );

  console.log(
    `Runtime session: ${runtimeSessionId}`,
  );

  console.log(
    `Synthetic school: ${schoolId}`,
  );

  console.log(
    `Synthetic case:   ${caseId}`,
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


    console.log(
      "\n1. NETWORK CALL #1 — invoking deployed AgentCore Runtime...",
    );

    const firstResponse =
      await invokeRemoteAgent(
        agentCoreClient,
        runtimeSessionId,
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
      readRemoteInterrupt(
        firstResponse,
        runtimeSessionId,
      );

    console.log(
      "Remote AgentCore invocation: PASS ✅",
    );

    console.log(
      "Real Strands interrupt crossed AgentCore network boundary: PASS ✅",
    );

    const preDecisionState =
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
      ]);

    const [
      caseAtInterrupt,
      assignmentsAtInterrupt,
      decisionsAtInterrupt,
    ] =
      preDecisionState;

    assert(
      caseAtInterrupt?.status ===
        "partially_covered",
      `Expected partially_covered at interrupt boundary but received "${caseAtInterrupt?.status}".`,
    );

    assert(
      assignmentsAtInterrupt.length ===
        1,
      `Interrupt boundary unexpectedly had ${assignmentsAtInterrupt.length} assignments.`,
    );

    assert(
      decisionsAtInterrupt.length ===
        0,
      "A HumanDecision was persisted before an administrator actually responded.",
    );

    assertPeriodSet(
      assignmentsAtInterrupt.flatMap(
        (assignment) =>
          assignment.periodIds,
      ),
      [
        "P2",
        "P3",
      ],
      "Coverage at interrupt boundary",
    );

    console.log(
      "Interrupt itself created no fake decision or P5 assignment: PASS ✅",
    );


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
      "Remote authoritative interrupt did not include an external-substitute option.",
    );

    console.log(
      `\nCENTERPIECE PATH: choose option ${externalChoiceIndex + 1} — external substitute.`,
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
      "Checkpoint 4C.3 centerpiece requires the administrator to select the external-substitute option.",
    );

    console.log(
      "\nHuman selected:",
      selectedChoice.summary,
    );

    console.log(
      `Selected authoritative optionId: ${selectedChoice.optionId}`,
    );


    console.log(
      "\n2. NETWORK CALL #2 — resuming SAME AgentCore runtime session...",
    );

    const secondResponse =
      await invokeRemoteAgent(
        agentCoreClient,
        runtimeSessionId,
        {
          type:
            "resume",

          interruptId:
            interrupt.id,

          optionId:
            selectedChoice.optionId,
        },
      );

    assertRemoteCompleted(
      secondResponse,
      runtimeSessionId,
    );

    console.log(
      "Same AgentCore runtimeSessionId: PASS ✅",
    );

    console.log(
      "Same Strands Agent HITL resume across network boundary: PASS ✅",
    );


    console.log(
      "\n3. Verifying authoritative state after remote administrator decision...",
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
      `Expected exactly one durable human decision but found ${decisionsAfterResume.length}.`,
    );

    const approvedDecision =
      decisionsAfterResume[0];

    assert(
      approvedDecision,
      "Approved remote HumanDecision was missing.",
    );

    assert(
      approvedDecision.status ===
        "approved",
      "Remote HumanDecision was not stored as approved.",
    );

    assert(
      approvedDecision.kind ===
        "request_external_substitute",
      `Expected request_external_substitute but received "${approvedDecision.kind}".`,
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
      "Administrator approval was incorrectly converted into a fake P5 assignment.",
    );

    assert(
      assignmentsAfterResume.length ===
        1,
      `Expected only the routine assignment after approval but found ${assignmentsAfterResume.length}.`,
    );

    console.log(
      "Administrator decision persisted in real DynamoDB: PASS ✅",
    );

    console.log(
      "Approval ≠ execution boundary: PASS ✅",
    );


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


    console.log(
      "\n5. Replaying exact trusted fulfillment event...",
    );

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
      "Exact external fulfillment retry was not idempotent.",
    );

    console.log(
      "External fulfillment replay idempotency: PASS ✅",
    );


    console.log(
      "\n6. Verifying final authoritative Scenario B state...",
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
      `Expected exactly two final assignments but found ${finalAssignments.length}.`,
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
      "\n=== FINAL AUTHORITATIVE STATE ===\n",
    );

    console.log(
      "Final case status: resolved ✅",
    );

    console.log(
      "Covered periods: P2, P3, P5 ✅",
    );

    console.log(
      "Routine coverage: P2/P3 ✅",
    );

    console.log(
      "Human-approved external coverage: P5 ✅",
    );

    console.log(
      "Human decisions: exactly 1 approved ✅",
    );

    console.log(
      "Activity evidence: PASS ✅",
    );


    console.log(
      "\n=== BEFOREBELL 4C.3 REMOTE AGENTCORE HITL PASS ===\n",
    );

    console.log(
      "Remote AgentCore invocation: PASS",
    );

    console.log(
      "Real deployed NODE_22 Runtime: PASS",
    );

    console.log(
      "Real Strands + Bedrock orchestration: PASS",
    );

    console.log(
      "Real DynamoDB authoritative state: PASS",
    );

    console.log(
      "Real HITL interrupt across network boundary: PASS",
    );

    console.log(
      "Same AgentCore runtimeSessionId resume: PASS",
    );

    console.log(
      "Same-agent Strands HITL resume: PASS",
    );

    console.log(
      "Administrator optionId validation: PASS",
    );

    console.log(
      "Approval ≠ execution boundary: PASS",
    );

    console.log(
      "Trusted external fulfillment: PASS",
    );

    console.log(
      "Idempotent fulfillment replay: PASS",
    );

    console.log(
      "Activity evidence: PASS",
    );

    console.log(
      "Scenario B resolution 3/3: PASS",
    );

    console.log(
      "\nBeforeBell Scenario B is proven through the deployed Amazon Bedrock AgentCore Runtime. ✅",
    );
  } finally {
    console.log(
      "\nDiscovering synthetic remote-HITL artifacts for cleanup...",
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
        "WARNING: failed to fully discover remote-HITL artifacts.",
      );

      console.error(
        error,
      );
    }

    console.log(
      `Explicit cleanup keys: ${cleanupKeys.size}`,
    );

    console.log(
      "Cleaning synthetic remote-HITL records...",
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

    agentCoreClient.destroy();
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
      "\nBeforeBell remote AgentCore Scenario B HITL smoke failed.",
    );

    console.error(
      error,
    );

    process.exitCode =
      1;
  },
);