import {
  createBeforeBellAgent,
} from "../src/agent/beforebell-agent";

import {
  fulfillApprovedExternalSubstitute,
} from "../src/application/actions/fulfill-approved-external-substitute";

import {
  InMemoryBeforeBellStore,
} from "../src/application/store/in-memory-beforebell-store";

import {
  scenarioBAbsence,
} from "../src/fixtures/riverside";

import type {
  AbsenceCase,
  CoverageAssignment,
  HumanDecision,
} from "../src/domain/types";

const partiallyCoveredCase:
  AbsenceCase = {
    ...scenarioBAbsence,

    status:
      "partially_covered",

    updatedAt:
      "2026-09-14T06:10:00.000Z",
  };

const routineAssignment:
  CoverageAssignment = {
    id:
      "assignment-scenario-b-routine",

    caseId:
      scenarioBAbsence.id,

    candidateId:
      "candidate-jordan-lee",

    periodIds: [
      "P2",
      "P3",
    ],

    source:
      "accepted_offer",

    offerId:
      "offer-scenario-b-routine-accepted",

    createdAt:
      "2026-09-14T06:05:00.000Z",
  };

const approvedDecision:
  HumanDecision = {
    id:
      "decision-scenario-b-external-p5",

    caseId:
      scenarioBAbsence.id,

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

async function main() {
  const store =
    new InMemoryBeforeBellStore({
      cases: [
        partiallyCoveredCase,
      ],

      assignments: [
        routineAssignment,
      ],

      decisions: [
        approvedDecision,
      ],
    });

  console.log(
    "\n=== BeforeBell External Substitute Fulfillment Smoke Test ===\n",
  );

  console.log(
    "Starting authoritative state:",
  );

  console.log(
    "P2/P3 covered routinely",
  );

  console.log(
    "P5 external substitute approved by administrator",
  );

  console.log(
    "P5 not yet assigned\n",
  );

  /**
   * Simulate the trusted external-substitute integration confirming that
   * an actual substitute has been obtained.
   *
   * Claude does not create this event.
   */
  const fulfillmentResult =
    await fulfillApprovedExternalSubstitute(
      store,
      {
        decisionId:
          approvedDecision.id,

        externalSubstituteId:
          "external-substitute-morgan-ellis",

        now:
          new Date(
            "2026-09-14T06:20:00.000Z",
          ),
      },
    );

  console.log(
    "=== Trusted Fulfillment Event Result ===\n",
  );

  console.dir(
    fulfillmentResult,
    {
      depth: null,
    },
  );

  if (
    !fulfillmentResult.success
  ) {
    throw new Error(
      `External-substitute fulfillment failed: ${fulfillmentResult.code}`,
    );
  }

  /**
   * Wake BeforeBell after the trusted event.
   *
   * At this stage the agent should only observe authoritative state and
   * report the resolution. It must not manufacture further mutations.
   */
  const agent =
    createBeforeBellAgent(
      store,
    );

  console.log(
    "\n=== Wake BeforeBell After Fulfillment ===\n",
  );

  const result =
    await agent.invoke(`
Inspect authoritative state for coverage case "${scenarioBAbsence.id}".

A trusted external-substitute fulfillment event has already been processed by
the application layer.

Do not create an offer.
Do not create another assignment.
Do not request another human decision.
Do not simulate any external event.

Use BeforeBell's authoritative read tools and report whether all affected
periods are now covered and whether the case is resolved.

Keep the final response concise and operational.
`);

  console.log(
    "\n=== Final Agent Result ===\n",
  );

  console.log(
    "Stop reason:",
    result.stopReason,
  );

  console.dir(
    result.lastMessage,
    {
      depth: null,
    },
  );

  console.log(
    "\n=== Strands Metrics ===\n",
  );

  console.dir(
    agent.metrics,
    {
      depth: null,
    },
  );

  console.log(
    "\n=== Authoritative Store Check ===\n",
  );

  const [
    finalCase,
    assignments,
    decisions,
    activity,
  ] = await Promise.all([
    store.getCase(
      scenarioBAbsence.id,
    ),

    store.listAssignmentsByCase(
      scenarioBAbsence.id,
    ),

    store.listDecisionsByCase(
      scenarioBAbsence.id,
    ),

    store.listActivityByCase(
      scenarioBAbsence.id,
    ),
  ]);

  console.log(
    "Case status:",
    finalCase?.status,
  );

  console.log(
    "Assignments:",
    assignments.length,
  );

  console.dir(
    assignments,
    {
      depth: null,
    },
  );

  console.log(
    "Human decisions:",
    decisions.length,
  );

  console.dir(
    decisions,
    {
      depth: null,
    },
  );

  console.log(
    "Activity:",
  );

  console.dir(
    activity,
    {
      depth: null,
    },
  );

  const p5Assignments =
    assignments.filter(
      (assignment) =>
        assignment.periodIds.includes(
          "P5",
        ),
    );

  console.log(
    "\nP5 assignments:",
    p5Assignments.length,
  );
}

main().catch((error) => {
  console.error(
    "\nBeforeBell external-substitute smoke test failed.",
  );

  console.error(error);

  process.exitCode = 1;
});