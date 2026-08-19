import {
  createBeforeBellAgent,
} from "../src/agent/beforebell-agent";

import {
  InMemoryBeforeBellStore,
} from "../src/application/store/in-memory-beforebell-store";

import {
  riversideCoveragePolicy,
  scenarioAAbsence,
  scenarioACandidates,
} from "../src/fixtures/riverside";

import type {
  AbsenceCase,
  CoverageOffer,
} from "../src/domain/types";

async function main() {
  /**
   * Simulate the state AFTER the candidate-facing response endpoint has
   * authoritatively recorded an acceptance.
   *
   * The agent itself is not accepting the offer.
   */
  const now =
    new Date();

  const offeringCase: AbsenceCase = {
    ...scenarioAAbsence,
    status: "offering",
    updatedAt:
      now.toISOString(),
  };

  const acceptedOffer: CoverageOffer = {
    id:
      "offer-live-accepted-scenario-a",

    caseId:
      scenarioAAbsence.id,

    candidateId:
      "candidate-alex-johnson",

    periodIds: [
      "P1",
      "P2",
      "P4",
      "P6",
    ],

    status: "accepted",

    createdAt:
      new Date(
        now.getTime() -
          5 * 60_000,
      ).toISOString(),

    expiresAt:
      new Date(
        now.getTime() +
          15 * 60_000,
      ).toISOString(),

    respondedAt:
      now.toISOString(),
  };

  const store =
    new InMemoryBeforeBellStore({
      policies: [
        riversideCoveragePolicy,
      ],

      cases: [
        offeringCase,
      ],

      candidates:
        scenarioACandidates,

      offers: [
        acceptedOffer,
      ],
    });

  const agent =
    createBeforeBellAgent(
      store,
    );

  console.log(
    "\n=== BeforeBell Accepted Offer Smoke Test ===\n",
  );

  console.log(
    `Case: ${scenarioAAbsence.id}`,
  );

  console.log(
    `Accepted offer: ${acceptedOffer.id}`,
  );

  console.log(
    "Candidate response is already authoritative.\n",
  );

  const result =
    await agent.invoke(`
Continue coordination for coverage case "${scenarioAAbsence.id}".

An external candidate-response event has already occurred.
Do not invent or simulate any response.

Use the authoritative BeforeBell tools to inspect the current state.

If there is an authoritative accepted offer that is eligible for assignment,
perform the next permitted safe step.

Do not notify anyone.
Do not create or approve a human decision.
Do not claim success unless the mutation tool confirms it.

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
  ] = await Promise.all([
    store.getCase(
      scenarioAAbsence.id,
    ),

    store.listOffersByCase(
      scenarioAAbsence.id,
    ),

    store.listAssignmentsByCase(
      scenarioAAbsence.id,
    ),

    store.listDecisionsByCase(
      scenarioAAbsence.id,
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

  const activity =
    await store.listActivityByCase(
      scenarioAAbsence.id,
    );

  console.log(
    "\nActivity:",
  );

  console.dir(
    activity,
    {
      depth: null,
    },
  );
}

main().catch((error) => {
  console.error(
    "\nBeforeBell accepted-offer smoke test failed.",
  );

  console.error(error);

  process.exitCode = 1;
});