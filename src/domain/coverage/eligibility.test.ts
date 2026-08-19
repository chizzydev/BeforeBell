import { describe, expect, it } from "vitest";

import {
  evaluateCoverageCandidate,
  rankCoverageCandidates,
} from "@/domain/coverage/eligibility";

import {
  riversideCoveragePolicy,
  scenarioAAbsence,
  scenarioACandidates,
} from "@/fixtures/riverside";

import type {
  CoverageAssignment,
  CoverageCandidate,
} from "@/domain/types";

function getScenarioACandidate(name: string): CoverageCandidate {
  const candidate = scenarioACandidates.find(
    (item) => item.name === name,
  );

  if (!candidate) {
    throw new Error(`Scenario A candidate not found: ${name}`);
  }

  return candidate;
}

describe("coverage candidate eligibility", () => {
  it("ranks Alex first and identifies him as the only full-absence candidate", () => {
    const ranked = rankCoverageCandidates({
      candidates: scenarioACandidates,
      absence: scenarioAAbsence,
      policy: riversideCoveragePolicy,
      existingAssignments: [],
    });

    expect(ranked.map((candidate) => candidate.candidateName)).toEqual([
      "Alex Johnson",
      "Maria Patel",
      "David Kim",
    ]);

    expect(ranked[0]?.canCoverEntireAbsence).toBe(true);
    expect(ranked[0]?.automaticallyCoverablePeriodCount).toBe(4);

    expect(
      ranked.filter((candidate) => candidate.canCoverEntireAbsence),
    ).toHaveLength(1);
  });

  it("excludes Maria from P1 because she is unavailable", () => {
    const evaluation = evaluateCoverageCandidate({
      candidate: getScenarioACandidate("Maria Patel"),
      absence: scenarioAAbsence,
      policy: riversideCoveragePolicy,
      existingAssignments: [],
    });

    const p1 = evaluation.periodEvaluations.find(
      (period) => period.periodId === "P1",
    );

    expect(p1?.automaticallyEligible).toBe(false);
    expect(p1?.exclusionCodes).toContain("candidate_unavailable");

    expect(evaluation.safePeriods).toEqual(["P2", "P4", "P6"]);
    expect(evaluation.automaticallyCoverablePeriodCount).toBe(3);
    expect(evaluation.canCoverEntireAbsence).toBe(false);
  });

  it("recognizes that David can safely cover only P1 and P4", () => {
    const evaluation = evaluateCoverageCandidate({
      candidate: getScenarioACandidate("David Kim"),
      absence: scenarioAAbsence,
      policy: riversideCoveragePolicy,
      existingAssignments: [],
    });

    expect(evaluation.safePeriods).toEqual(["P1", "P4"]);
    expect(evaluation.automaticallyCoverablePeriodCount).toBe(2);
    expect(evaluation.subjectQualified).toBe(false);
    expect(evaluation.canCoverEntireAbsence).toBe(false);
  });

  it("does not automatically use a protected planning period", () => {
    const alex = getScenarioACandidate("Alex Johnson");

    const candidateWithProtectedPlanning: CoverageCandidate = {
      ...alex,
      protectedPlanningPeriods: ["P2"],
    };

    const evaluation = evaluateCoverageCandidate({
      candidate: candidateWithProtectedPlanning,
      absence: scenarioAAbsence,
      policy: riversideCoveragePolicy,
      existingAssignments: [],
    });

    const p2 = evaluation.periodEvaluations.find(
      (period) => period.periodId === "P2",
    );

    expect(p2?.automaticallyEligible).toBe(false);
    expect(p2?.exclusionCodes).toContain(
      "protected_planning_requires_approval",
    );

    expect(evaluation.canCoverEntireAbsence).toBe(false);
  });

  it("excludes a period when the candidate already has another assignment", () => {
    const alex = getScenarioACandidate("Alex Johnson");

    const existingAssignments: CoverageAssignment[] = [
      {
        id: "assignment-existing",
        caseId: "case-other",
        candidateId: alex.id,
        periodIds: ["P2"],
        source: "accepted_offer",
        offerId: "offer-existing",
        createdAt: "2026-09-14T05:30:00.000Z",
      },
    ];

    const evaluation = evaluateCoverageCandidate({
      candidate: alex,
      absence: scenarioAAbsence,
      policy: riversideCoveragePolicy,
      existingAssignments,
    });

    const p2 = evaluation.periodEvaluations.find(
      (period) => period.periodId === "P2",
    );

    expect(p2?.automaticallyEligible).toBe(false);
    expect(p2?.exclusionCodes).toContain("already_assigned");

    expect(evaluation.automaticallyCoverablePeriodCount).toBe(3);
    expect(evaluation.canCoverEntireAbsence).toBe(false);
  });

  it("enforces remaining daily coverage capacity", () => {
    const alex = getScenarioACandidate("Alex Johnson");

    const nearlyAtDailyMaximum: CoverageCandidate = {
      ...alex,
      dailyCoverageCount: 4,
    };

    const evaluation = evaluateCoverageCandidate({
      candidate: nearlyAtDailyMaximum,
      absence: scenarioAAbsence,
      policy: riversideCoveragePolicy,
      existingAssignments: [],
    });

    expect(evaluation.remainingDailyCapacity).toBe(1);
    expect(evaluation.safePeriods).toEqual([
      "P1",
      "P2",
      "P4",
      "P6",
    ]);

    expect(evaluation.automaticallyCoverablePeriodCount).toBe(1);
    expect(evaluation.canCoverEntireAbsence).toBe(false);
  });

  it("does not return automatic capacity for an inactive candidate", () => {
    const alex = getScenarioACandidate("Alex Johnson");

    const inactiveCandidate: CoverageCandidate = {
      ...alex,
      active: false,
    };

    const evaluation = evaluateCoverageCandidate({
      candidate: inactiveCandidate,
      absence: scenarioAAbsence,
      policy: riversideCoveragePolicy,
      existingAssignments: [],
    });

    expect(evaluation.automaticallyCoverablePeriodCount).toBe(0);
    expect(evaluation.canCoverEntireAbsence).toBe(false);

    expect(
      evaluation.periodEvaluations.every((period) =>
        period.exclusionCodes.includes("candidate_inactive"),
      ),
    ).toBe(true);
  });
});