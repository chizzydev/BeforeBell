import {
  describe,
  expect,
  it,
} from "vitest";

import {
  buildExceptionDecisionRequest,
  recordExceptionDecisionWaitingActivity,
  recordValidatedExceptionSelection,
} from "@/agent/tools/request-exception-decision";

import {
  InMemoryBeforeBellStore,
} from "@/application/store/in-memory-beforebell-store";

import {
  riversideCoveragePolicy,
  scenarioAAbsence,
  scenarioACandidates,
  scenarioBAbsence,
  scenarioBCandidates,
} from "@/fixtures/riverside";

import type {
  CoverageAssignment,
} from "@/domain/types";

const scenarioBRoutineAssignment:
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

function createScenarioBStore() {
  return new InMemoryBeforeBellStore({
    policies: [
      riversideCoveragePolicy,
    ],

    cases: [
      scenarioBAbsence,
    ],

    candidates:
      scenarioBCandidates,

    assignments: [
      scenarioBRoutineAssignment,
    ],
  });
}

describe("buildExceptionDecisionRequest", () => {
  it("builds the three authoritative Scenario B choices for unresolved P5", async () => {
    const store =
      createScenarioBStore();

    const result =
      await buildExceptionDecisionRequest(
        store,
        {
          caseId:
            scenarioBAbsence.id,
        },
      );

    expect(result.success).toBe(
      true,
    );

    expect(result.code).toBe(
      "exception_decision_required",
    );

    expect(
      result.data
        ?.unresolvedPeriodIds,
    ).toEqual([
      "P5",
    ]);

    expect(
      result.data?.options.map(
        (option) =>
          option.kind,
      ),
    ).toEqual([
      "use_protected_planning_period",
      "request_external_substitute",
      "combine_coverage_groups",
    ]);

    const protectedPlanning =
      result.data?.options.find(
        (option) =>
          option.kind ===
          "use_protected_planning_period",
      );

    expect(
      protectedPlanning,
    ).toMatchObject({
      periodIds: [
        "P5",
      ],

      candidateId:
        "candidate-ms-taylor",

      candidateName:
        "Ms. Taylor",

      requiresAdministratorApproval:
        true,
    });

    expect(
      result.data?.options.every(
        (option) =>
          option
            .requiresAdministratorApproval ===
          true,
      ),
    ).toBe(true);
  });

it("records the human-judgment waiting boundary exactly once across resume-style replay", async () => {
  const store =
    createScenarioBStore();

  const request =
    await buildExceptionDecisionRequest(
      store,
      {
        caseId:
          scenarioBAbsence.id,
      },
    );

  if (
    !request.success ||
    !request.data
  ) {
    throw new Error(
      "Expected authoritative Scenario B exception request.",
    );
  }

  await recordExceptionDecisionWaitingActivity(
    store,
    request.data,
    new Date(
      "2026-09-14T06:09:00.000Z",
    ),
  );

  /**
   * Strands re-enters the tool on resume.
   * A later wall clock must not produce duplicate waiting evidence
   * or rewrite the timestamp of the original boundary.
   */
  await recordExceptionDecisionWaitingActivity(
    store,
    request.data,
    new Date(
      "2026-09-14T06:11:00.000Z",
    ),
  );

  const activity =
    await store.listActivityByCase(
      scenarioBAbsence.id,
    );

  expect(activity).toHaveLength(
    1,
  );

  expect(
    activity[0],
  ).toMatchObject({
    caseId:
      scenarioBAbsence.id,

    timestamp:
      "2026-09-14T06:09:00.000Z",

    actorType:
      "agent",

    action:
      "human_exception_decision_requested",

    toolName:
      "request_exception_decision",

    status:
      "waiting",

    summary:
      "BeforeBell reached a policy boundary for P5 and is waiting for administrator judgment.",
  });
});

  it("does not mutate assignments, decisions, offers, or activity while preparing human judgment", async () => {
    const store =
      createScenarioBStore();

    const assignmentsBefore =
      await store.listAssignmentsByCase(
        scenarioBAbsence.id,
      );

    const result =
      await buildExceptionDecisionRequest(
        store,
        {
          caseId:
            scenarioBAbsence.id,
        },
      );

    expect(result.success).toBe(
      true,
    );

    expect(
      await store.listAssignmentsByCase(
        scenarioBAbsence.id,
      ),
    ).toEqual(
      assignmentsBefore,
    );

    expect(
      await store.listOffersByCase(
        scenarioBAbsence.id,
      ),
    ).toEqual([]);

    expect(
      await store.listDecisionsByCase(
        scenarioBAbsence.id,
      ),
    ).toEqual([]);

    expect(
      await store.listActivityByCase(
        scenarioBAbsence.id,
      ),
    ).toEqual([]);
  });

  it("generates stable option identities from the same authoritative state", async () => {
    const store =
      createScenarioBStore();

    const first =
      await buildExceptionDecisionRequest(
        store,
        {
          caseId:
            scenarioBAbsence.id,
        },
      );

    const second =
      await buildExceptionDecisionRequest(
        store,
        {
          caseId:
            scenarioBAbsence.id,
        },
      );

    expect(first.success).toBe(
      true,
    );

    expect(second.success).toBe(
      true,
    );

    expect(
      first.data?.options.map(
        (option) =>
          option.optionId,
      ),
    ).toEqual(
      second.data?.options.map(
        (option) =>
          option.optionId,
      ),
    );

    expect(
      new Set(
        first.data?.options.map(
          (option) =>
            option.optionId,
        ),
      ).size,
    ).toBe(3);
  });

  it("does not request human judgment when deterministic planning fully resolves Scenario A", async () => {
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

    const result =
      await buildExceptionDecisionRequest(
        store,
        {
          caseId:
            scenarioAAbsence.id,
        },
      );

    expect(result.success).toBe(
      false,
    );

    expect(result.code).toBe(
      "no_exception_decision_required",
    );

    expect(
      await store.listDecisionsByCase(
        scenarioAAbsence.id,
      ),
    ).toEqual([]);
  });
});

describe("recordValidatedExceptionSelection", () => {
  it("records the authoritative external-substitute option selected by the administrator", async () => {
    const store =
      createScenarioBStore();

    const request =
      await buildExceptionDecisionRequest(
        store,
        {
          caseId:
            scenarioBAbsence.id,
        },
      );

    const externalSubstitute =
      request.data?.options.find(
        (option) =>
          option.kind ===
          "request_external_substitute",
      );

    if (!externalSubstitute) {
      throw new Error(
        "Expected authoritative external-substitute option.",
      );
    }

    const result =
      await recordValidatedExceptionSelection(
        store,
        {
          caseId:
            scenarioBAbsence.id,

          optionId:
            externalSubstitute.optionId,

          now:
            new Date(
              "2026-09-14T06:10:00.000Z",
            ),

          decidedBy:
            "administrator-demo",
        },
      );

    expect(result.success).toBe(
      true,
    );

    expect(result.code).toBe(
      "human_exception_decision_recorded",
    );

    expect(
      result.data?.decision,
    ).toMatchObject({
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

      decidedBy:
        "administrator-demo",
    });

    expect(
      await store.listDecisionsByCase(
        scenarioBAbsence.id,
      ),
    ).toHaveLength(1);

    /**
     * Approval is not execution.
     */
    expect(
      await store.listAssignmentsByCase(
        scenarioBAbsence.id,
      ),
    ).toEqual([
      scenarioBRoutineAssignment,
    ]);
  });

  it("rejects an option ID that is not currently authoritative", async () => {
    const store =
      createScenarioBStore();

    const result =
      await recordValidatedExceptionSelection(
        store,
        {
          caseId:
            scenarioBAbsence.id,

          optionId:
            "exception-option-not-real",

          now:
            new Date(
              "2026-09-14T06:10:00.000Z",
            ),

          decidedBy:
            "administrator-demo",
        },
      );

    expect(result.success).toBe(
      false,
    );

    expect(result.code).toBe(
      "human_exception_selection_not_authoritative",
    );

    expect(
      await store.listDecisionsByCase(
        scenarioBAbsence.id,
      ),
    ).toEqual([]);

    expect(
      await store.listActivityByCase(
        scenarioBAbsence.id,
      ),
    ).toEqual([]);
  });

  it("replays the same validated selection without duplicating decision or activity", async () => {
    const store =
      createScenarioBStore();

    const request =
      await buildExceptionDecisionRequest(
        store,
        {
          caseId:
            scenarioBAbsence.id,
        },
      );

    const externalSubstitute =
      request.data?.options.find(
        (option) =>
          option.kind ===
          "request_external_substitute",
      );

    if (!externalSubstitute) {
      throw new Error(
        "Expected authoritative external-substitute option.",
      );
    }

    const first =
      await recordValidatedExceptionSelection(
        store,
        {
          caseId:
            scenarioBAbsence.id,

          optionId:
            externalSubstitute.optionId,

          now:
            new Date(
              "2026-09-14T06:10:00.000Z",
            ),

          decidedBy:
            "administrator-demo",
        },
      );

    const replay =
      await recordValidatedExceptionSelection(
        store,
        {
          caseId:
            scenarioBAbsence.id,

          optionId:
            externalSubstitute.optionId,

          now:
            new Date(
              "2026-09-14T06:15:00.000Z",
            ),

          decidedBy:
            "administrator-demo",
        },
      );

    expect(first.success).toBe(
      true,
    );

    expect(first.code).toBe(
      "human_exception_decision_recorded",
    );

    expect(replay.success).toBe(
      true,
    );

    expect(replay.code).toBe(
      "human_exception_decision_already_recorded",
    );

    expect(
      replay.data?.idempotentReplay,
    ).toBe(true);

    expect(
      await store.listDecisionsByCase(
        scenarioBAbsence.id,
      ),
    ).toHaveLength(1);

    expect(
      await store.listActivityByCase(
        scenarioBAbsence.id,
      ),
    ).toHaveLength(1);

    expect(
      await store.listAssignmentsByCase(
        scenarioBAbsence.id,
      ),
    ).toHaveLength(1);
  });
});