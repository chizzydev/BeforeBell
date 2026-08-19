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
    "\n=== BeforeBell Strands Smoke Test ===\n",
  );

  console.log(
    `Case: ${scenarioAAbsence.id}`,
  );

  console.log(
    "Mode: READ ONLY\n",
  );

  const result =
    await agent.invoke(`
Assess coverage case "${scenarioAAbsence.id}".

This is a read-only assessment.

Use the authoritative BeforeBell tools required by your instructions.
Do not create, simulate, or claim any mutation.

Determine:
- what periods require coverage,
- what policy matters,
- which candidate is the deterministic planner's policy-safe first offer target,
- whether any administrator judgment is currently required,
- and the current authoritative case status.

Keep the final answer concise and operational.
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

  console.log(
    "Assignments:",
    assignments.length,
  );

  console.log(
    "Human decisions:",
    decisions.length,
  );
}

main().catch((error) => {
  console.error(
    "\nBeforeBell agent smoke test failed.",
  );

  console.error(error);

  process.exitCode = 1;
});