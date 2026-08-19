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

async function main() {
  const store =
    new InMemoryBeforeBellStore({
      policies: [
        riversideCoveragePolicy,
      ],

      cases: [
        scenarioAAbsence,
      ],

      candidates:
        scenarioACandidates,
    });

  const agent =
    createBeforeBellAgent(
      store,
    );

  console.log(
    "\n=== BeforeBell Controlled Mutation Smoke Test ===\n",
  );

  console.log(
    `Case: ${scenarioAAbsence.id}`,
  );

  console.log(
    "Allowed mutation: CREATE COVERAGE OFFER ONLY\n",
  );

  const result =
    await agent.invoke(`
Coordinate the next safe step for coverage case "${scenarioAAbsence.id}".

Use the authoritative BeforeBell tools required by your instructions.

If the deterministic planner produces a policy-safe proposal, create the
coverage offer for exactly that proposal.

Do not simulate candidate acceptance.
Do not create an assignment.
Do not claim that coverage is assigned.
Do not invent an administrator decision.

Stop after the offer has either been created successfully or authoritatively
rejected.

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
    offers,
    assignments,
    decisions,
  ] = await Promise.all([
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
    "\nBeforeBell controlled mutation smoke test failed.",
  );

  console.error(error);

  process.exitCode = 1;
});