import { describe, expect, it } from "vitest";

import {
  buildCoverageExceptionOptions,
} from "@/domain/coverage/exceptions";

import {
  evaluateCoverageCandidate,
} from "@/domain/coverage/eligibility";

import { buildCoveragePlan } from "@/domain/coverage/planner";

import {
  riversideCoveragePolicy,
  scenarioBAbsence,
  scenarioBCandidates,
} from "@/fixtures/riverside";

import type {
  CoverageCandidate,
  CoveragePolicy,
} from "@/domain/types";

function getScenarioBCandidate(name: string): CoverageCandidate {
  const candidate = scenarioBCandidates.find(
    (item) => item.name === name,
  );

  if (!candidate) {
    throw new Error(`Scenario B candidate not found: ${name}`);
  }

  return candidate;
}

describe("Scenario B automatic coverage boundary", () => {
  it("automatically plans P2 and P3 while leaving P5 unresolved", () => {
    const plan = buildCoveragePlan({
      absence: scenarioBAbsence,
      candidates: scenarioBCandidates,
      policy: riversideCoveragePolicy,
      existingAssignments: [],
    });

    expect(plan.proposals).toEqual([
      {
        candidateId: "candidate-jordan-lee",
        candidateName: "Jordan Lee",
        periodIds: ["P2", "P3"],
        subjectQualified: true,
      },
    ]);

    expect(plan.unresolvedPeriodIds).toEqual(["P5"]);
    expect(plan.fullyPlanned).toBe(false);
  });

  it("does not automatically treat Ms. Taylor's protected P5 as normal coverage", () => {
    const evaluation = evaluateCoverageCandidate({
      candidate: getScenarioBCandidate("Ms. Taylor"),
      absence: scenarioBAbsence,
      policy: riversideCoveragePolicy,
      existingAssignments: [],
    });

    const p5 = evaluation.periodEvaluations.find(
      (period) => period.periodId === "P5",
    );

    expect(p5?.automaticallyEligible).toBe(false);

    expect(p5?.exclusionCodes).toContain(
      "protected_planning_requires_approval",
    );
  });
});

describe("coverage exception options", () => {
  it("surfaces the three administrator-controlled options for Scenario B P5", () => {
    const options = buildCoverageExceptionOptions({
      unresolvedPeriodIds: ["P5"],
      candidates: scenarioBCandidates,
      policy: riversideCoveragePolicy,
      existingAssignments: [],
    });

    expect(options).toEqual([
      {
        kind: "use_protected_planning_period",
        periodIds: ["P5"],
        candidateId: "candidate-ms-taylor",
        candidateName: "Ms. Taylor",
        requiresAdministratorApproval: true,
        summary: "Use Ms. Taylor's protected planning period for P5.",
      },
      {
        kind: "request_external_substitute",
        periodIds: ["P5"],
        requiresAdministratorApproval: true,
        summary: "Request an external substitute for P5.",
      },
      {
        kind: "combine_coverage_groups",
        periodIds: ["P5"],
        requiresAdministratorApproval: true,
        summary: "Combine coverage groups for P5.",
      },
    ]);
  });

  it("marks every exception option as requiring administrator approval", () => {
    const options = buildCoverageExceptionOptions({
      unresolvedPeriodIds: ["P5"],
      candidates: scenarioBCandidates,
      policy: riversideCoveragePolicy,
      existingAssignments: [],
    });

    expect(options.length).toBeGreaterThan(0);

    expect(
      options.every(
        (option) => option.requiresAdministratorApproval === true,
      ),
    ).toBe(true);
  });

  it("returns no exception choices when there are no unresolved periods", () => {
    const options = buildCoverageExceptionOptions({
      unresolvedPeriodIds: [],
      candidates: scenarioBCandidates,
      policy: riversideCoveragePolicy,
      existingAssignments: [],
    });

    expect(options).toEqual([]);
  });

  it("respects school policy when an exception path is disabled", () => {
    const policyWithoutExternalSubstitute: CoveragePolicy = {
      ...riversideCoveragePolicy,
      externalSubstituteRequiresApproval: false,
    };

    const options = buildCoverageExceptionOptions({
      unresolvedPeriodIds: ["P5"],
      candidates: scenarioBCandidates,
      policy: policyWithoutExternalSubstitute,
      existingAssignments: [],
    });

    expect(
      options.some(
        (option) => option.kind === "request_external_substitute",
      ),
    ).toBe(false);

    expect(
      options.some(
        (option) => option.kind === "use_protected_planning_period",
      ),
    ).toBe(true);

    expect(
      options.some(
        (option) => option.kind === "combine_coverage_groups",
      ),
    ).toBe(true);
  });
});