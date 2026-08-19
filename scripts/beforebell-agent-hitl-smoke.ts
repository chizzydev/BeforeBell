import {
  InterruptResponseContent,
} from "@strands-agents/sdk";

import {
  createInterface,
} from "node:readline/promises";

import {
  stdin as input,
  stdout as output,
} from "node:process";

import {
  createBeforeBellAgent,
} from "../src/agent/beforebell-agent";

import {
  InMemoryBeforeBellStore,
} from "../src/application/store/in-memory-beforebell-store";

import {
  riversideCoveragePolicy,
  scenarioBAbsence,
  scenarioBCandidates,
} from "../src/fixtures/riverside";

import type {
  AbsenceCase,
  CoverageAssignment,
  CoverageOffer,
} from "../src/domain/types";

interface DisplayInterruptOption {
  optionId: string;
  kind: string;
  summary: string;
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

const routineAcceptedOffer:
  CoverageOffer = {
    id:
      "offer-scenario-b-routine-accepted",

    caseId:
      scenarioBAbsence.id,

    candidateId:
      "candidate-jordan-lee",

    periodIds: [
      "P2",
      "P3",
    ],

    status:
      "accepted",

    createdAt:
      "2026-09-14T05:55:00.000Z",

    expiresAt:
      "2026-09-14T06:20:00.000Z",

    respondedAt:
      "2026-09-14T06:00:00.000Z",
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
      routineAcceptedOffer.id,

    createdAt:
      "2026-09-14T06:05:00.000Z",
  };

async function main() {
  /**
   * This is the authoritative event-driven state after routine P2/P3
   * coverage has completed.
   *
   * P5 remains unresolved.
   */
  const partiallyCoveredCase:
    AbsenceCase = {
      ...scenarioBAbsence,

      status:
        "partially_covered",

      updatedAt:
        "2026-09-14T06:05:00.000Z",
    };

  const store =
    new InMemoryBeforeBellStore({
      policies: [
        riversideCoveragePolicy,
      ],

      cases: [
        partiallyCoveredCase,
      ],

      candidates:
        scenarioBCandidates,

      offers: [
        routineAcceptedOffer,
      ],

      assignments: [
        routineAssignment,
      ],
    });

  /**
   * IMPORTANT:
   * This exact same Agent instance is used for interruption and resumption.
   */
  const agent =
    createBeforeBellAgent(
      store,
    );

  console.log(
    "\n=== BeforeBell Scenario B HITL Resume Test ===\n",
  );

  console.log(
    `Case: ${scenarioBAbsence.id}`,
  );

  console.log(
    "Routine coverage already authoritative: P2, P3",
  );

  console.log(
    "Remaining period: P5",
  );

  console.log(
    "\n=== Invocation 1: Agent Coordinates Until Judgment Boundary ===\n",
  );

  const interruptedResult =
    await agent.invoke(`
Continue coordination for coverage case "${scenarioBAbsence.id}".

Routine coverage may already exist for part of this absence.

Inspect authoritative BeforeBell state.

Do not duplicate existing coverage.
Do not simulate candidate acceptance.
Do not select an exception yourself.

If routine deterministic planning cannot safely resolve every remaining period,
request the required administrator judgment through the dedicated BeforeBell
human-decision tool.

Do not invent an administrator response.
`);

  console.log(
    "Stop reason:",
    interruptedResult.stopReason,
  );

  if (
    interruptedResult.stopReason !==
    "interrupt"
  ) {
    throw new Error(
      `Expected Strands interrupt but received ${interruptedResult.stopReason}.`,
    );
  }

  const interrupt =
    interruptedResult
      .interrupts?.[0];

  if (!interrupt) {
    throw new Error(
      "Agent stopped for interrupt but returned no interrupt payload.",
    );
  }

  console.log(
    "\n=== Authoritative Administrator Choices ===\n",
  );

  const choices =
    readInterruptOptions(
      interrupt.reason,
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

  console.log(
    "\nFor the centerpiece Scenario B path, choose option 2: external substitute.",
  );

  /**
   * This prompt is intentionally outside the model.
   *
   * The person running the smoke test is the administrator making the
   * judgment. Claude does not answer this prompt.
   */
  const readline =
    createInterface({
      input,
      output,
    });

  const answer =
    await readline.question(
      "\nAdministrator selection (1-3): ",
    );

  readline.close();

  const selectedIndex =
    Number.parseInt(
      answer.trim(),
      10,
    ) - 1;

  const selectedChoice =
    choices[selectedIndex];

  if (!selectedChoice) {
    throw new Error(
      "Administrator selection was outside the available option range.",
    );
  }

  console.log(
    "\n=== Human Selection ===\n",
  );

  console.log(
    selectedChoice.summary,
  );

  console.log(
    `Selected optionId: ${selectedChoice.optionId}`,
  );

  console.log(
    "\n=== Invocation 2: Resume SAME Strands Agent ===\n",
  );

  /**
   * This is the actual Strands HITL resume mechanism.
   *
   * Only the selected option ID is returned. We do not send kind, candidate,
   * periods, or summary back as authoritative client data.
   */
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

  console.log(
    "\n=== Final Agent Result ===\n",
  );

  console.dir(
    resumedResult.lastMessage,
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
      scenarioBAbsence.id,
    ),

    store.listOffersByCase(
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
    "Offers:",
    offers.length,
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
    "Activity events:",
    activity.length,
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

  console.log(
    "\nIMPORTANT:",
  );

  console.log(
    "The administrator decision may now be durable, but P5 must still have zero assignments because approval is not execution.",
  );
}

main().catch((error) => {
  console.error(
    "\nBeforeBell Scenario B HITL resume test failed.",
  );

  console.error(error);

  process.exitCode = 1;
});