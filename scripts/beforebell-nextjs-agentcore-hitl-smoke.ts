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
  path:
    ".env.local",
});


const DEV_TABLE_NAME =
  "beforebell-dev";

const EXPECTED_REGION =
  "us-east-1";

const DEFAULT_WEB_BASE_URL =
  "http://127.0.0.1:3000";


interface PhysicalKey {
  PK: string;
  SK: string;
}


interface InterruptOption {
  optionId: string;
  kind: string;
  summary: string;
}


interface WebInterrupt {
  sessionId: string;
  interruptId: string;
  options:
    InterruptOption[];
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
    value !==
      null &&
    !Array.isArray(
      value,
    )
  );
}


function assertPeriodSet(
  actual:
    readonly PeriodId[],
  expected:
    readonly PeriodId[],
  label:
    string,
): void {
  const actualSet =
    new Set(
      actual,
    );

  const expectedSet =
    new Set(
      expected,
    );

  const matches =
    actualSet.size ===
      expectedSet.size &&
    [...expectedSet].every(
      (periodId) =>
        actualSet.has(
          periodId,
        ),
    );

  assert(
    matches,
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
  key:
    PhysicalKey,
): string {
  return `${key.PK}\u0000${key.SK}`;
}


function readInterruptOptions(
  reason:
    unknown,
): InterruptOption[] {
  assert(
    isRecord(
      reason,
    ),
    "Web interrupt reason was not an object.",
  );

  const rawOptions =
    reason.options;

  assert(
    Array.isArray(
      rawOptions,
    ),
    "Web interrupt did not contain an options array.",
  );

  return rawOptions.map(
    (
      rawOption,
      index,
    ): InterruptOption => {
      assert(
        isRecord(
          rawOption,
        ),
        `Interrupt option ${index + 1} was not an object.`,
      );

      const optionId =
        rawOption.optionId;

      const kind =
        rawOption.kind;

      const summary =
        rawOption.summary;

      assert(
        typeof optionId ===
          "string" &&
        optionId.length >
          0,
        `Interrupt option ${index + 1} has no valid optionId.`,
      );

      assert(
        typeof kind ===
          "string" &&
        kind.length >
          0,
        `Interrupt option ${index + 1} has no valid kind.`,
      );

      assert(
        typeof summary ===
          "string" &&
        summary.length >
          0,
        `Interrupt option ${index + 1} has no valid summary.`,
      );

      return {
        optionId,
        kind,
        summary,
      };
    },
  );
}


function readWebInterrupt(
  payload:
    unknown,
): WebInterrupt {
  assert(
    isRecord(
      payload,
    ),
    "Next.js response was not a JSON object.",
  );

  assert(
    payload.status ===
      "interrupt",
    `Expected web response status "interrupt" but received "${String(
      payload.status,
    )}".`,
  );

  assert(
    payload.stopReason ===
      "interrupt",
    `Expected web stopReason "interrupt" but received "${String(
      payload.stopReason,
    )}".`,
  );

  assert(
    typeof payload.sessionId ===
      "string" &&
    payload.sessionId.length >=
      33,
    "Web response did not return a valid AgentCore runtime session ID.",
  );

  assert(
    isRecord(
      payload.interrupt,
    ),
    "Web response did not contain an interrupt object.",
  );

  assert(
    typeof payload.interrupt.id ===
      "string" &&
    payload.interrupt.id.length >
      0,
    "Web response interrupt did not contain a valid interrupt ID.",
  );

  return {
    sessionId:
      payload.sessionId,

    interruptId:
      payload.interrupt.id,

    options:
      readInterruptOptions(
        payload.interrupt
          .reason,
      ),
  };
}


function assertWebCompletion(
  payload:
    unknown,
  expectedSessionId:
    string,
): void {
  assert(
    isRecord(
      payload,
    ),
    "Next.js resume response was not a JSON object.",
  );

  assert(
    payload.status ===
      "completed",
    `Expected web completion status "completed" but received "${String(
      payload.status,
    )}".`,
  );

  assert(
    payload.stopReason ===
      "endTurn",
    `Expected web completion stopReason "endTurn" but received "${String(
      payload.stopReason,
    )}".`,
  );

  assert(
    payload.sessionId ===
      expectedSessionId,
    `Next.js resume returned a different AgentCore session. Expected "${expectedSessionId}", received "${String(
      payload.sessionId,
    )}".`,
  );
}


async function postCoverageRequest({
  routeUrl,
  payload,
}: {
  routeUrl:
    string;

  payload:
    Record<
      string,
      unknown
    >;
}): Promise<unknown> {
  const response =
    await fetch(
      routeUrl,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        cache:
          "no-store",

        body:
          JSON.stringify(
            payload,
          ),

        signal:
          AbortSignal.timeout(
            180_000,
          ),
      },
    );

  const responseText =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `Next.js AgentCore route returned HTTP ${response.status}: ${responseText}`,
    );
  }

  assert(
    responseText.trim()
      .length >
      0,
    "Next.js AgentCore route returned an empty response body.",
  );

  try {
    return JSON.parse(
      responseText,
    ) as unknown;
  } catch {
    throw new Error(
      `Next.js AgentCore route returned invalid JSON: ${responseText}`,
    );
  }
}


async function verifyWebServer(
  baseUrl:
    string,
): Promise<void> {
  const response =
    await fetch(
      `${baseUrl}/`,
      {
        signal:
          AbortSignal.timeout(
            15_000,
          ),
      },
    );

  assert(
    response.ok,
    `BeforeBell web server returned HTTP ${response.status}.`,
  );
}


async function main() {
  const config =
    getBeforeBellDynamoConfig();

  assert(
    config.tableName ===
      DEV_TABLE_NAME,
    `Refusing Scenario B web smoke against DynamoDB table "${config.tableName}". Expected "${DEV_TABLE_NAME}".`,
  );

  assert(
    config.region ===
      EXPECTED_REGION,
    `Refusing Scenario B web smoke in region "${config.region}". Expected "${EXPECTED_REGION}".`,
  );

  const webBaseUrl =
    (
      process.env
        .BEFOREBELL_WEB_BASE_URL ??
      DEFAULT_WEB_BASE_URL
    )
      .replace(
        /\/+$/,
        "",
      );

  const routeUrl =
    `${webBaseUrl}/api/agentcore/coverage`;

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
    `school-nextjs-hitl-${nonce}`;

  const caseId =
    `case-scenario-b-nextjs-hitl-${nonce}`;

  const policy = {
    ...riversideCoveragePolicy,

    schoolId,
  };

  const candidates:
    CoverageCandidate[] =
      scenarioBCandidates.map(
        (
          candidate,
        ) => ({
          ...candidate,

          id:
            `${candidate.id}-nextjs-${nonce}`,

          schoolId,
        }),
      );

  const jordan =
    candidates.find(
      (
        candidate,
      ) =>
        candidate.name ===
        "Jordan Lee",
    );

  const msTaylor =
    candidates.find(
      (
        candidate,
      ) =>
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

  const absenceCase:
    AbsenceCase = {
      ...scenarioBAbsence,

      id:
        caseId,

      schoolId,

      absentStaffMemberId:
        `staff-daniel-reed-nextjs-${nonce}`,

      status:
        "partially_covered",

      updatedAt:
        "2026-09-14T06:05:00.000Z",
    };

  const routineOffer:
    CoverageOffer = {
      id:
        `offer-scenario-b-routine-nextjs-${nonce}`,

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
        `assignment-scenario-b-routine-nextjs-${nonce}`,

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
    `external-substitute-morgan-ellis-nextjs-${nonce}`;

  const cleanupKeys =
    new Map<
      string,
      PhysicalKey
    >();


  const addCleanupKey = (
    key:
      PhysicalKey,
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
          caseId,
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
    "\n=== BeforeBell 4D.3 — Next.js → AgentCore Scenario B HITL ===\n",
  );

  console.log(
    `Web server:      ${webBaseUrl}`,
  );

  console.log(
    `Route:           ${routeUrl}`,
  );

  console.log(
    `Region:          ${config.region}`,
  );

  console.log(
    `DynamoDB table:  ${config.tableName}`,
  );

  console.log(
    `Synthetic school: ${schoolId}`,
  );

  console.log(
    `Synthetic case:   ${caseId}`,
  );


  try {
    console.log(
      "\n0. Verifying BeforeBell web server...",
    );

    await verifyWebServer(
      webBaseUrl,
    );

    console.log(
      "Next.js web server reachable: PASS ✅",
    );


    console.log(
      "\n1. Seeding authoritative Scenario B state...",
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
      absenceCase,
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
      `Expected one seeded routine assignment but found ${seededAssignments.length}.`,
    );

    assertPeriodSet(
      seededAssignments[0]
        ?.periodIds ??
        [],
      [
        "P2",
        "P3",
      ],
      "Seeded routine assignment",
    );

    console.log(
      "P2/P3 routine state persisted in real DynamoDB: PASS ✅",
    );


    console.log(
      "\n2. WEB CALL #1 — POST coordinate_case through Next.js...",
    );

    const firstResponse =
      await postCoverageRequest({
        routeUrl,

        payload: {
          type:
            "coordinate_case",

          caseId,
        },
      });

    const webInterrupt =
      readWebInterrupt(
        firstResponse,
      );

    console.log(
      "Next.js Route Handler: PASS ✅",
    );

    console.log(
      "Server-only AgentCore gateway: PASS ✅",
    );

    console.log(
      "Deployed AgentCore Runtime interrupt: PASS ✅",
    );

    console.log(
      `Runtime session preserved by web response: ${webInterrupt.sessionId}`,
    );


    const [
      caseAtInterrupt,
      assignmentsAtInterrupt,
      decisionsAtInterrupt,
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
      ]);

    assert(
      caseAtInterrupt?.status ===
        "partially_covered",
      `Expected partially_covered at HITL boundary but received "${caseAtInterrupt?.status}".`,
    );

    assert(
      assignmentsAtInterrupt.length ===
        1,
      `Expected only one assignment at HITL boundary but found ${assignmentsAtInterrupt.length}.`,
    );

    assertPeriodSet(
      assignmentsAtInterrupt.flatMap(
        (
          assignment,
        ) =>
          assignment.periodIds,
      ),
      [
        "P2",
        "P3",
      ],
      "Coverage at HITL boundary",
    );

    assert(
      decisionsAtInterrupt.length ===
        0,
      "A HumanDecision was persisted before the administrator actually selected an option.",
    );

    console.log(
      "Interrupt created no fake HumanDecision: PASS ✅",
    );

    console.log(
      "Interrupt created no fake P5 assignment: PASS ✅",
    );


    console.log(
      "\n=== AUTHORITATIVE ADMINISTRATOR OPTIONS ===\n",
    );

    webInterrupt.options.forEach(
      (
        option,
        index,
      ) => {
        console.log(
          `${index + 1}. ${option.summary}`,
        );

        console.log(
          `   kind: ${option.kind}`,
        );

        console.log(
          `   optionId: ${option.optionId}`,
        );
      },
    );


    const externalOptionIndex =
      webInterrupt.options
        .findIndex(
          (
            option,
          ) =>
            option.kind ===
            "request_external_substitute",
        );

    assert(
      externalOptionIndex >=
        0,
      "Authoritative web interrupt did not contain an external-substitute option.",
    );

    console.log(
      `\nCENTERPIECE PATH: choose option ${externalOptionIndex + 1} — external substitute.`,
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

    const selectedOption =
      webInterrupt.options[
        selectedIndex
      ];

    assert(
      selectedOption,
      "Administrator selection was outside the authoritative option range.",
    );

    assert(
      selectedOption.kind ===
        "request_external_substitute",
      "Checkpoint 4D.3 centerpiece requires the external-substitute option.",
    );


    console.log(
      "\nAdministrator selected:",
      selectedOption.summary,
    );

    console.log(
      `Selected optionId: ${selectedOption.optionId}`,
    );


    console.log(
      "\n3. WEB CALL #2 — POST resume_exception through Next.js...",
    );

    const secondResponse =
      await postCoverageRequest({
        routeUrl,

        payload: {
          type:
            "resume_exception",

          runtimeSessionId:
            webInterrupt.sessionId,

          interruptId:
            webInterrupt.interruptId,

          optionId:
            selectedOption.optionId,
        },
      });

    assertWebCompletion(
      secondResponse,
      webInterrupt.sessionId,
    );

    console.log(
      "Second Next.js Route Handler call: PASS ✅",
    );

    console.log(
      "Same AgentCore runtimeSessionId preserved: PASS ✅",
    );

    console.log(
      "Same Strands HITL execution resumed: PASS ✅",
    );


    console.log(
      "\n4. Verifying authoritative state after administrator approval...",
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
      `Approval incorrectly resolved the case. Received "${caseAfterDecision?.status}".`,
    );

    assert(
      decisionsAfterResume.length ===
        1,
      `Expected exactly one HumanDecision but found ${decisionsAfterResume.length}.`,
    );

    const approvedDecision =
      decisionsAfterResume[0];

    assert(
      approvedDecision,
      "Approved HumanDecision was missing.",
    );

    assert(
      approvedDecision.status ===
        "approved",
      `Expected approved HumanDecision but received "${approvedDecision.status}".`,
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
      "Approved HumanDecision periods",
    );

    assert(
      assignmentsAfterResume.length ===
        1,
      `Approval created an unexpected assignment. Found ${assignmentsAfterResume.length}.`,
    );

    assert(
      !assignmentsAfterResume.some(
        (
          assignment,
        ) =>
          assignment.periodIds
            .includes(
              "P5",
            ),
      ),
      "Administrator approval was incorrectly treated as P5 execution.",
    );

    console.log(
      "Administrator decision persisted in DynamoDB: PASS ✅",
    );

    console.log(
      "Approval ≠ execution boundary: PASS ✅",
    );


    console.log(
      "\n5. Delivering trusted external-substitute fulfillment...",
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
      `Trusted fulfillment failed [${fulfillment.code}]: ${fulfillment.message}`,
    );

    assert(
      fulfillment.data
        .caseStatus ===
        "resolved",
      `Expected fulfillment to resolve case but received "${fulfillment.data.caseStatus}".`,
    );

    console.log(
      "Trusted external fulfillment: PASS ✅",
    );


    console.log(
      "\n6. Replaying trusted fulfillment...",
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
      `Trusted fulfillment replay failed [${fulfillmentReplay.code}]: ${fulfillmentReplay.message}`,
    );

    assert(
      fulfillmentReplay.data
        .idempotentReplay ===
        true,
      "Trusted fulfillment replay was not idempotent.",
    );

    console.log(
      "Trusted fulfillment idempotent replay: PASS ✅",
    );


    console.log(
      "\n7. Verifying final authoritative Scenario B state...",
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
      `Expected resolved final case but received "${finalCase?.status}".`,
    );

    assert(
      finalAssignments.length ===
        2,
      `Expected exactly two final assignments but found ${finalAssignments.length}.`,
    );

    assertPeriodSet(
      finalAssignments.flatMap(
        (
          assignment,
        ) =>
          assignment.periodIds,
      ),
      [
        "P2",
        "P3",
        "P5",
      ],
      "Final coverage",
    );

    const routineFinal =
      finalAssignments.find(
        (
          assignment,
        ) =>
          assignment.source ===
          "accepted_offer",
      );

    const exceptionFinal =
      finalAssignments.find(
        (
          assignment,
        ) =>
          assignment.source ===
          "approved_exception",
      );

    assert(
      routineFinal,
      "Final routine assignment was missing.",
    );

    assert(
      exceptionFinal,
      "Final approved-exception assignment was missing.",
    );

    assertPeriodSet(
      routineFinal.periodIds,
      [
        "P2",
        "P3",
      ],
      "Final routine coverage",
    );

    assertPeriodSet(
      exceptionFinal.periodIds,
      [
        "P5",
      ],
      "Final exception coverage",
    );

    assert(
      exceptionFinal.candidateId ===
        externalSubstituteId,
      "P5 assignment did not contain the authoritative external substitute.",
    );

    assert(
      finalDecisions.length ===
        1,
      `Expected exactly one final HumanDecision but found ${finalDecisions.length}.`,
    );

    assert(
      finalActivity.some(
        (
          event,
        ) =>
          event.action ===
          "human_exception_decision_approved",
      ),
      "Activity ledger is missing administrator-approval evidence.",
    );

    assert(
      finalActivity.some(
        (
          event,
        ) =>
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
      "Case status: resolved ✅",
    );

    console.log(
      "Covered periods: P2, P3, P5 ✅",
    );

    console.log(
      "Routine coverage P2/P3: PASS ✅",
    );

    console.log(
      "Human-approved P5 path: PASS ✅",
    );

    console.log(
      "Human decisions: exactly 1 approved ✅",
    );

    console.log(
      "Activity evidence: PASS ✅",
    );


    console.log(
      "\n=== BEFOREBELL 4D.3 WEB-LAYER HITL PASS ===\n",
    );

    console.log(
      "Browser-style HTTP transport: PASS",
    );

    console.log(
      "Next.js Route Handler: PASS",
    );

    console.log(
      "Strict domain-only gateway: PASS",
    );

    console.log(
      "Server-only AWS SDK invocation: PASS",
    );

    console.log(
      "Deployed AgentCore Runtime: PASS",
    );

    console.log(
      "Real Strands + Bedrock orchestration: PASS",
    );

    console.log(
      "Real DynamoDB authoritative state: PASS",
    );

    console.log(
      "HITL interrupt returned through Next.js: PASS",
    );

    console.log(
      "runtimeSessionId returned to web client: PASS",
    );

    console.log(
      "Administrator optionId returned through web client: PASS",
    );

    console.log(
      "Same-session resume through Next.js: PASS",
    );

    console.log(
      "Approval ≠ execution boundary: PASS",
    );

    console.log(
      "Trusted external fulfillment: PASS",
    );

    console.log(
      "Idempotent replay: PASS",
    );

    console.log(
      "Scenario B resolution 3/3: PASS",
    );

    console.log(
      "\nBeforeBell Scenario B is proven end-to-end through the real Next.js web boundary. ✅",
    );
  } finally {
    console.log(
      "\nDiscovering synthetic Next.js HITL artifacts for cleanup...",
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
        "WARNING: failed to fully discover Next.js HITL artifacts.",
      );

      console.error(
        error,
      );
    }

    console.log(
      `Explicit cleanup keys: ${cleanupKeys.size}`,
    );

    console.log(
      "Cleaning synthetic Next.js HITL records...",
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
  (
    error,
  ) => {
    console.error(
      "\nBeforeBell Next.js → AgentCore Scenario B HITL smoke failed.",
    );

    console.error(
      error,
    );

    process.exitCode =
      1;
  },
);