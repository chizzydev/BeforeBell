import { describe, expect, it } from "vitest";

import {
  planCoverageCase,
} from "@/application/actions/plan-coverage-case";

import { InMemoryBeforeBellStore } from "@/application/store/in-memory-beforebell-store";

import {
  riversideCoveragePolicy,
  scenarioAAbsence,
  scenarioACandidates,
  scenarioCAbsence,
scenarioCCandidates,
} from "@/fixtures/riverside";

import type {
  CoverageAssignment,
  CoverageOffer,
} from "@/domain/types";

function createStore(
  assignments: readonly CoverageAssignment[] = [],
) {
  return new InMemoryBeforeBellStore({
    policies: [riversideCoveragePolicy],
    cases: [scenarioAAbsence],
    candidates: scenarioACandidates,
    assignments,
  });
}

describe("planCoverageCase", () => {
  it("builds Scenario A from authoritative store state and selects Alex", async () => {
    const store = createStore();

    const result = await planCoverageCase(
      store,
      {
        caseId: scenarioAAbsence.id,
      },
    );

    expect(result.success).toBe(true);
    expect(result.code).toBe(
      "coverage_plan_built",
    );

    expect(
      result.data?.plan.proposals,
    ).toEqual([
      {
        candidateId:
          "candidate-alex-johnson",
        candidateName:
          "Alex Johnson",
        periodIds: [
          "P1",
          "P2",
          "P4",
          "P6",
        ],
        subjectQualified: true,
      },
    ]);

    expect(
      result.data?.plan
        .unresolvedPeriodIds,
    ).toEqual([]);

    expect(
      result.data?.plan.fullyPlanned,
    ).toBe(true);
  });

  it("includes assignments from other cases when evaluating candidate conflicts", async () => {
    const otherCaseAssignment: CoverageAssignment = {
      id: "assignment-alex-other-case-p1",
      caseId: "case-other",
      candidateId:
        "candidate-alex-johnson",
      periodIds: ["P1"],
      source: "accepted_offer",
      offerId: "offer-other",
      createdAt:
        "2026-09-14T05:30:00.000Z",
    };

    const store = createStore([
      otherCaseAssignment,
    ]);

    const result = await planCoverageCase(
      store,
      {
        caseId: scenarioAAbsence.id,
      },
    );

    expect(result.success).toBe(true);

    const alexEvaluation =
      result.data?.plan
        .candidateEvaluations
        .find(
          (candidate) =>
            candidate.candidateId ===
            "candidate-alex-johnson",
        );

    const p1 =
      alexEvaluation?.periodEvaluations.find(
        (period) =>
          period.periodId === "P1",
      );

    expect(
      p1?.automaticallyEligible,
    ).toBe(false);

    expect(
      p1?.exclusionCodes,
    ).toContain("already_assigned");

    expect(
      alexEvaluation?.canCoverEntireAbsence,
    ).toBe(false);
  });

  it("returns an explicit result for an unknown case", async () => {
    const store = createStore();

    const result = await planCoverageCase(
      store,
      {
        caseId: "case-does-not-exist",
      },
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe(
      "case_not_found",
    );
  });
});

describe("planCoverageCase after a candidate decline", () => {
  it("does not immediately reselect a candidate who already declined the case", async () => {
    const declinedOffer: CoverageOffer = {
      id: "offer-scenario-c-emma",
      caseId: scenarioCAbsence.id,
      candidateId:
        "candidate-emma-brooks",
      periodIds: ["P1", "P3", "P6"],
      status: "declined",
      createdAt:
        "2026-09-14T06:12:00.000Z",
      expiresAt:
        "2026-09-14T06:30:00.000Z",
      respondedAt:
        "2026-09-14T06:15:00.000Z",
    };

    const store =
      new InMemoryBeforeBellStore({
        policies: [
          riversideCoveragePolicy,
        ],
        cases: [scenarioCAbsence],
        candidates: scenarioCCandidates,
        offers: [declinedOffer],
      });

    const result =
      await planCoverageCase(
        store,
        {
          caseId:
            scenarioCAbsence.id,
        },
      );

    expect(result.success).toBe(true);

    expect(
      result.data?.plan.proposals,
    ).toEqual([
      {
        candidateId:
          "candidate-noah-carter",
        candidateName:
          "Noah Carter",
        periodIds: [
          "P1",
          "P3",
          "P6",
        ],
        subjectQualified: true,
      },
    ]);

    expect(
      result.data?.plan.fullyPlanned,
    ).toBe(true);
  });
});