import {
  createBeforeBellAgent,
} from "../src/agent/beforebell-agent";

import {
  InMemoryBeforeBellStore,
} from "../src/application/store/in-memory-beforebell-store";

import {
  riversideCoveragePolicy,
  scenarioCAbsence,
  scenarioCCandidates,
} from "../src/fixtures/riverside";

import type {
  CoverageOffer,
} from "../src/domain/types";

/**
 * Emma was the deterministic first choice for Scenario C.
 *
 * This represents authoritative state AFTER the candidate-facing response
 * endpoint recorded her decline.
 *
 * The agent itself did not manufacture the decline.
 */
const declinedEmmaOffer:
  CoverageOffer = {
    id:
      "offer-scenario-c-emma-declined",

    caseId:
      scenarioCAbsence.id,

    candidateId:
      "candidate-emma-brooks",

    periodIds: [
      "P1",
      "P3",
      "P6",
    ],

    status:
      "declined",

    createdAt:
      "2026-09-14T06:15:00.000Z",

    expiresAt:
      "2026-09-14T06:35:00.000Z",

    respondedAt:
      "2026-09-14T06:18:00.000Z",
  };

async function main() {
  const store =
    new InMemoryBeforeBellStore({
      policies: [
        riversideCoveragePolicy,
      ],

      cases: [
        scenarioCAbsence,
      ],

      candidates:
        scenarioCCandidates,

      offers: [
        declinedEmmaOffer,
      ],
    });

  const agent =
    createBeforeBellAgent(
      store,
    );

  console.log(
    "\n=== BeforeBell Scenario C Decline Fallback Smoke Test ===\n",
  );

  console.log(
    `Case: ${scenarioCAbsence.id}`,
  );

  console.log(
    "Authoritative prior response: Emma Brooks declined",
  );

  console.log(
    "Expected safe fallback: Noah Carter\n",
  );

  const result =
    await agent.invoke(`
Continue coordination for coverage case "${scenarioCAbsence.id}".

An external candidate-response event has already occurred.
One previous coverage offer was declined.

Use authoritative BeforeBell state.

Do not simulate or alter the previous candidate response.
Do not offer the work again to a candidate who has already declined this case.
Do not invent candidate availability or ranking.

If the current deterministic planner produces a safe proposal after accounting
for the decline, create exactly that authoritative proposal.

Do not simulate acceptance.
Do not create an assignment.
Do not request administrator judgment when deterministic planning fully
resolves the remaining coverage.

Stop after the next safe offer is created or authoritatively rejected.

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
    offers,
    assignments,
    decisions,
    activity,
  ] = await Promise.all([
    store.getCase(
      scenarioCAbsence.id,
    ),

    store.listOffersByCase(
      scenarioCAbsence.id,
    ),

    store.listAssignmentsByCase(
      scenarioCAbsence.id,
    ),

    store.listDecisionsByCase(
      scenarioCAbsence.id,
    ),

    store.listActivityByCase(
      scenarioCAbsence.id,
    ),
  ]);

  console.log(
    "Case status:",
    finalCase?.status,
  );

  console.log(
    "Offers:",
    offers.length,
  );

  console.dir(
    offers,
    {
      depth: null,
    },
  );

  console.log(
    "Assignments:",
    assignments.length,
  );

  console.log(
    "Human decisions:",
    decisions.length,
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

  const emmaOffers =
    offers.filter(
      (offer) =>
        offer.candidateId ===
        "candidate-emma-brooks",
    );

  const noahPendingOffers =
    offers.filter(
      (offer) =>
        offer.candidateId ===
          "candidate-noah-carter" &&
        offer.status ===
          "pending",
    );

  /**
   * Turn this smoke run into an executable orchestration assertion rather
   * than relying only on the model's prose.
   */
  if (
    emmaOffers.length !==
      1 ||
    emmaOffers[0]?.status !==
      "declined"
  ) {
    throw new Error(
      "Emma's authoritative declined offer was unexpectedly changed or duplicated.",
    );
  }

  if (
    noahPendingOffers.length !==
    1
  ) {
    throw new Error(
      "Expected exactly one pending fallback offer for Noah Carter.",
    );
  }

  if (
    assignments.length !==
    0
  ) {
    throw new Error(
      "No assignment should exist before Noah accepts the fallback offer.",
    );
  }

  if (
    decisions.length !==
    0
  ) {
    throw new Error(
      "Scenario C should not require administrator judgment.",
    );
  }

  console.log(
    "\n=== Smoke Assertions ===\n",
  );

  console.log(
    "Emma remains declined: PASS",
  );

  console.log(
    "Exactly one Noah fallback offer: PASS",
  );

  console.log(
    "No premature assignment: PASS",
  );

  console.log(
    "No unnecessary human decision: PASS",
  );
}

main().catch((error) => {
  console.error(
    "\nBeforeBell Scenario C fallback smoke test failed.",
  );

  console.error(error);

  process.exitCode = 1;
});