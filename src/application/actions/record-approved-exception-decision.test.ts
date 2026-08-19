import {
  describe,
  expect,
  it,
} from "vitest";

import {
  recordApprovedExceptionDecision,
} from "@/application/actions/record-approved-exception-decision";

import {
  InMemoryBeforeBellStore,
} from "@/application/store/in-memory-beforebell-store";

import {
  riversideCoveragePolicy,
  scenarioBAbsence,
  scenarioBCandidates,
} from "@/fixtures/riverside";

function createStore() {
  return new InMemoryBeforeBellStore({
    policies: [
      riversideCoveragePolicy,
    ],

    cases: [
      scenarioBAbsence,
    ],

    candidates:
      scenarioBCandidates,
  });
}

function externalSubInput(
  now =
    new Date(
      "2026-09-14T06:10:00.000Z",
    ),
) {
  return {
    decisionId:
      "decision-scenario-b-external-p5",

    caseId:
      scenarioBAbsence.id,

    kind:
      "request_external_substitute" as const,

    periodIds: [
      "P5",
    ] as const,

    summary:
      "Request an external substitute for P5.",

    now,

    decidedBy:
      "administrator-demo",

    activityEventId:
      "activity-scenario-b-external-p5",

    correlationId:
      "correlation-scenario-b",
  };
}

describe("recordApprovedExceptionDecision", () => {
  it("records an approved external-substitute decision and activity", async () => {
    const store =
      createStore();

    const result =
      await recordApprovedExceptionDecision(
        store,
        externalSubInput(),
      );

    expect(result.success).toBe(
      true,
    );

    expect(result.code).toBe(
      "human_exception_decision_recorded",
    );

    expect(
      result.data?.idempotentReplay,
    ).toBe(false);

    expect(
      result.data?.decision,
    ).toMatchObject({
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
    });

    expect(
      await store.listDecisionsByCase(
        scenarioBAbsence.id,
      ),
    ).toHaveLength(1);

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
      actorType:
        "administrator",

      action:
        "human_exception_decision_approved",

      toolName:
        "request_exception_decision",

      status:
        "succeeded",
    });
  });

  it("preserves the exact candidate for an approved protected-planning decision", async () => {
    const store =
      createStore();

    const result =
      await recordApprovedExceptionDecision(
        store,
        {
          decisionId:
            "decision-scenario-b-protected-p5",

          caseId:
            scenarioBAbsence.id,

          kind:
            "use_protected_planning_period",

          periodIds: [
            "P5",
          ],

          candidateId:
            "candidate-ms-taylor",

          summary:
            "Use Ms. Taylor's protected planning period for P5.",

          now:
            new Date(
              "2026-09-14T06:10:00.000Z",
            ),

          decidedBy:
            "administrator-demo",

          activityEventId:
            "activity-scenario-b-protected-p5",

          correlationId:
            "correlation-scenario-b",
        },
      );

    expect(result.success).toBe(
      true,
    );

    expect(
      result.data?.decision,
    ).toMatchObject({
      kind:
        "use_protected_planning_period",

      candidateId:
        "candidate-ms-taylor",

      periodIds: [
        "P5",
      ],

      status:
        "approved",
    });
  });

  it("rejects protected planning without the exact candidate", async () => {
    const store =
      createStore();

    const result =
      await recordApprovedExceptionDecision(
        store,
        {
          decisionId:
            "decision-invalid-protected",

          caseId:
            scenarioBAbsence.id,

          kind:
            "use_protected_planning_period",

          periodIds: [
            "P5",
          ],

          summary:
            "Use protected planning for P5.",

          now:
            new Date(
              "2026-09-14T06:10:00.000Z",
            ),

          decidedBy:
            "administrator-demo",

          activityEventId:
            "activity-invalid-protected",

          correlationId:
            "correlation-scenario-b",
        },
      );

    expect(result.success).toBe(
      false,
    );

    expect(result.code).toBe(
      "protected_planning_candidate_required",
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

  it("replays the same logical administrator decision idempotently after wall-clock time advances", async () => {
    const store =
      createStore();

    const first =
      await recordApprovedExceptionDecision(
        store,
        externalSubInput(
          new Date(
            "2026-09-14T06:10:00.000Z",
          ),
        ),
      );

    const replay =
      await recordApprovedExceptionDecision(
        store,
        externalSubInput(
          new Date(
            "2026-09-14T06:15:00.000Z",
          ),
        ),
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

    const decisions =
      await store.listDecisionsByCase(
        scenarioBAbsence.id,
      );

    expect(decisions).toHaveLength(
      1,
    );

    /**
     * Retry time must not rewrite the original authoritative decision time.
     */
    expect(
      decisions[0]?.decidedAt,
    ).toBe(
      "2026-09-14T06:10:00.000Z",
    );

    expect(
      await store.listActivityByCase(
        scenarioBAbsence.id,
      ),
    ).toHaveLength(1);
  });

  it("rejects reuse of a decision ID for a different logical decision", async () => {
    const store =
      createStore();

    const first =
      await recordApprovedExceptionDecision(
        store,
        externalSubInput(),
      );

    expect(first.success).toBe(
      true,
    );

    const conflict =
      await recordApprovedExceptionDecision(
        store,
        {
          ...externalSubInput(),

          kind:
            "combine_coverage_groups",

          summary:
            "Combine coverage groups for P5.",
        },
      );

    expect(conflict.success).toBe(
      false,
    );

    expect(conflict.code).toBe(
      "decision_idempotency_conflict",
    );

    const decisions =
      await store.listDecisionsByCase(
        scenarioBAbsence.id,
      );

    expect(decisions).toHaveLength(
      1,
    );

    expect(
      decisions[0]?.kind,
    ).toBe(
      "request_external_substitute",
    );
  });
});