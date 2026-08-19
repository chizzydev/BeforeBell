import {
  describe,
  expect,
  it,
} from "vitest";

import {
  fulfillApprovedExternalSubstitute,
} from "@/application/actions/fulfill-approved-external-substitute";

import {
  InMemoryBeforeBellStore,
} from "@/application/store/in-memory-beforebell-store";

import {
  scenarioBAbsence,
} from "@/fixtures/riverside";

import type {
  AbsenceCase,
  CoverageAssignment,
  HumanDecision,
} from "@/domain/types";

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

const approvedExternalDecision:
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

function createStore(
  decision: HumanDecision =
    approvedExternalDecision,
) {
  return new InMemoryBeforeBellStore({
    cases: [
      partiallyCoveredCase,
    ],

    assignments: [
      routineAssignment,
    ],

    decisions: [
      decision,
    ],
  });
}

describe("fulfillApprovedExternalSubstitute", () => {
  it("fulfills approved P5 external coverage and resolves Scenario B", async () => {
    const store =
      createStore();

    const result =
      await fulfillApprovedExternalSubstitute(
        store,
        {
          decisionId:
            approvedExternalDecision.id,

          externalSubstituteId:
            "external-substitute-morgan-ellis",

          now:
            new Date(
              "2026-09-14T06:20:00.000Z",
            ),
        },
      );

    expect(result.success).toBe(
      true,
    );

    expect(result.code).toBe(
      "external_substitute_fulfilled",
    );

    expect(
      result.data?.caseStatus,
    ).toBe("resolved");

    expect(
      result.data?.caseStatusChanged,
    ).toBe(true);

    const assignments =
      await store.listAssignmentsByCase(
        scenarioBAbsence.id,
      );

    expect(assignments).toHaveLength(
      2,
    );

    const p5Assignment =
      assignments.find(
        (assignment) =>
          assignment.periodIds.includes(
            "P5",
          ),
      );

    expect(
      p5Assignment,
    ).toMatchObject({
      caseId:
        scenarioBAbsence.id,

      candidateId:
        "external-substitute-morgan-ellis",

      periodIds: [
        "P5",
      ],

      source:
        "approved_exception",

      decisionId:
        approvedExternalDecision.id,

      createdAt:
        "2026-09-14T06:20:00.000Z",
    });

    expect(
      (
        await store.getCase(
          scenarioBAbsence.id,
        )
      )?.status,
    ).toBe("resolved");

    expect(
      (
        await store.listActivityByCase(
          scenarioBAbsence.id,
        )
      ).map(
        (event) =>
          event.action,
      ),
    ).toEqual([
      "coverage_assignment_created",
      "coverage_case_status_updated",
    ]);
  });

  it("rejects a human decision that is not approved", async () => {
    const store =
      createStore({
        ...approvedExternalDecision,

        status:
          "pending",

        decidedAt:
          undefined,

        decidedBy:
          undefined,
      });

    const result =
      await fulfillApprovedExternalSubstitute(
        store,
        {
          decisionId:
            approvedExternalDecision.id,

          externalSubstituteId:
            "external-substitute-morgan-ellis",

          now:
            new Date(
              "2026-09-14T06:20:00.000Z",
            ),
        },
      );

    expect(result.success).toBe(
      false,
    );

    expect(result.code).toBe(
      "decision_not_approved",
    );

    expect(
      await store.listAssignmentsByCase(
        scenarioBAbsence.id,
      ),
    ).toEqual([
      routineAssignment,
    ]);
  });

  it("rejects an approved decision of the wrong exception kind", async () => {
    const store =
      createStore({
        ...approvedExternalDecision,

        kind:
          "combine_coverage_groups",

        summary:
          "Combine coverage groups for P5.",
      });

    const result =
      await fulfillApprovedExternalSubstitute(
        store,
        {
          decisionId:
            approvedExternalDecision.id,

          externalSubstituteId:
            "external-substitute-morgan-ellis",

          now:
            new Date(
              "2026-09-14T06:20:00.000Z",
            ),
        },
      );

    expect(result.success).toBe(
      false,
    );

    expect(result.code).toBe(
      "decision_kind_not_external_substitute",
    );

    expect(
      await store.listAssignmentsByCase(
        scenarioBAbsence.id,
      ),
    ).toHaveLength(1);
  });

  it("replays the same fulfillment idempotently after the case has resolved", async () => {
    const store =
      createStore();

    const first =
      await fulfillApprovedExternalSubstitute(
        store,
        {
          decisionId:
            approvedExternalDecision.id,

          externalSubstituteId:
            "external-substitute-morgan-ellis",

          now:
            new Date(
              "2026-09-14T06:20:00.000Z",
            ),
        },
      );

    const replay =
      await fulfillApprovedExternalSubstitute(
        store,
        {
          decisionId:
            approvedExternalDecision.id,

          externalSubstituteId:
            "external-substitute-morgan-ellis",

          now:
            new Date(
              "2026-09-14T06:25:00.000Z",
            ),
        },
      );

    expect(first.success).toBe(
      true,
    );

    expect(first.code).toBe(
      "external_substitute_fulfilled",
    );

    expect(replay.success).toBe(
      true,
    );

    expect(replay.code).toBe(
      "external_substitute_fulfillment_already_recorded",
    );

    expect(
      replay.data?.idempotentReplay,
    ).toBe(true);

    expect(
      replay.data?.caseStatus,
    ).toBe("resolved");

    expect(
      replay.data?.caseStatusChanged,
    ).toBe(false);

    expect(
      await store.listAssignmentsByCase(
        scenarioBAbsence.id,
      ),
    ).toHaveLength(2);

    expect(
      await store.listActivityByCase(
        scenarioBAbsence.id,
      ),
    ).toHaveLength(2);
  });

  it("rejects a second external substitute for the same approved decision", async () => {
    const store =
      createStore();

    const first =
      await fulfillApprovedExternalSubstitute(
        store,
        {
          decisionId:
            approvedExternalDecision.id,

          externalSubstituteId:
            "external-substitute-morgan-ellis",

          now:
            new Date(
              "2026-09-14T06:20:00.000Z",
            ),
        },
      );

    expect(first.success).toBe(
      true,
    );

    const conflictingFulfillment =
      await fulfillApprovedExternalSubstitute(
        store,
        {
          decisionId:
            approvedExternalDecision.id,

          externalSubstituteId:
            "external-substitute-another-person",

          now:
            new Date(
              "2026-09-14T06:21:00.000Z",
            ),
        },
      );

    expect(
      conflictingFulfillment.success,
    ).toBe(false);

    expect(
      conflictingFulfillment.code,
    ).toBe(
      "external_substitute_fulfillment_conflict",
    );

    const assignments =
      await store.listAssignmentsByCase(
        scenarioBAbsence.id,
      );

    expect(assignments).toHaveLength(
      2,
    );

    expect(
      assignments.filter(
        (assignment) =>
          assignment.periodIds.includes(
            "P5",
          ),
      ),
    ).toHaveLength(1);
  });
});