import { describe, expect, it } from "vitest";

import { buildCoveragePlan } from "@/domain/coverage/planner";

import {
  riversideCoveragePolicy,
  scenarioAAbsence,
  scenarioACandidates,
} from "@/fixtures/riverside";

import type {
  CoverageAssignment,
  CoverageCandidate,
} from "@/domain/types";

describe("coverage planner", () => {
  it("creates one full-absence proposal for Alex in Scenario A", () => {
    const plan = buildCoveragePlan({
      absence: scenarioAAbsence,
      candidates: scenarioACandidates,
      policy: riversideCoveragePolicy,
      existingAssignments: [],
    });

    expect(plan.fullyPlanned).toBe(true);
    expect(plan.unresolvedPeriodIds).toEqual([]);

    expect(plan.proposals).toEqual([
      {
        candidateId: "candidate-alex-johnson",
        candidateName: "Alex Johnson",
        periodIds: ["P1", "P2", "P4", "P6"],
        subjectQualified: true,
      },
    ]);
  });

  it("does not attempt to cover a period already assigned for the case", () => {
    const existingAssignments: CoverageAssignment[] = [
      {
        id: "assignment-existing-p1",
        caseId: scenarioAAbsence.id,
        candidateId: "candidate-existing",
        periodIds: ["P1"],
        source: "accepted_offer",
        offerId: "offer-existing",
        createdAt: "2026-09-14T05:35:00.000Z",
      },
    ];

    const plan = buildCoveragePlan({
      absence: scenarioAAbsence,
      candidates: scenarioACandidates,
      policy: riversideCoveragePolicy,
      existingAssignments,
    });

    expect(plan.requestedPeriodIds).toEqual(["P2", "P4", "P6"]);

    expect(plan.proposals).toEqual([
      {
        candidateId: "candidate-alex-johnson",
        candidateName: "Alex Johnson",
        periodIds: ["P2", "P4", "P6"],
        subjectQualified: true,
      },
    ]);
  });

  it("can deterministically split normal coverage across multiple candidates", () => {
    const candidates: CoverageCandidate[] = [
      {
        id: "candidate-one",
        schoolId: "school-riverside",
        name: "Candidate One",
        qualifiedSubjects: ["Math"],
        availablePeriods: ["P1", "P2"],
        conflictingPeriods: [],
        protectedPlanningPeriods: [],
        dailyCoverageCount: 0,
        active: true,
      },
      {
        id: "candidate-two",
        schoolId: "school-riverside",
        name: "Candidate Two",
        qualifiedSubjects: ["Math"],
        availablePeriods: ["P4", "P6"],
        conflictingPeriods: [],
        protectedPlanningPeriods: [],
        dailyCoverageCount: 0,
        active: true,
      },
    ];

    const plan = buildCoveragePlan({
      absence: scenarioAAbsence,
      candidates,
      policy: riversideCoveragePolicy,
      existingAssignments: [],
    });

    expect(plan.fullyPlanned).toBe(true);
    expect(plan.unresolvedPeriodIds).toEqual([]);

    expect(plan.proposals).toEqual([
      {
        candidateId: "candidate-one",
        candidateName: "Candidate One",
        periodIds: ["P1", "P2"],
        subjectQualified: true,
      },
      {
        candidateId: "candidate-two",
        candidateName: "Candidate Two",
        periodIds: ["P4", "P6"],
        subjectQualified: true,
      },
    ]);
  });

  it("leaves periods unresolved when no normal candidate can cover them", () => {
    const candidates: CoverageCandidate[] = [
      {
        id: "candidate-partial",
        schoolId: "school-riverside",
        name: "Partial Candidate",
        qualifiedSubjects: ["Math"],
        availablePeriods: ["P1", "P2"],
        conflictingPeriods: [],
        protectedPlanningPeriods: [],
        dailyCoverageCount: 0,
        active: true,
      },
    ];

    const plan = buildCoveragePlan({
      absence: scenarioAAbsence,
      candidates,
      policy: riversideCoveragePolicy,
      existingAssignments: [],
    });

    expect(plan.fullyPlanned).toBe(false);

    expect(plan.proposals).toEqual([
      {
        candidateId: "candidate-partial",
        candidateName: "Partial Candidate",
        periodIds: ["P1", "P2"],
        subjectQualified: true,
      },
    ]);

    expect(plan.unresolvedPeriodIds).toEqual(["P4", "P6"]);
  });

  it("respects remaining daily coverage capacity while planning", () => {
    const limitedCandidate: CoverageCandidate = {
      id: "candidate-limited",
      schoolId: "school-riverside",
      name: "Limited Candidate",
      qualifiedSubjects: ["Math"],
      availablePeriods: ["P1", "P2", "P4", "P6"],
      conflictingPeriods: [],
      protectedPlanningPeriods: [],
      dailyCoverageCount: 3,
      active: true,
    };

    const plan = buildCoveragePlan({
      absence: scenarioAAbsence,
      candidates: [limitedCandidate],
      policy: riversideCoveragePolicy,
      existingAssignments: [],
    });

    expect(plan.proposals).toEqual([
      {
        candidateId: "candidate-limited",
        candidateName: "Limited Candidate",
        periodIds: ["P1", "P2"],
        subjectQualified: true,
      },
    ]);

    expect(plan.unresolvedPeriodIds).toEqual(["P4", "P6"]);
    expect(plan.fullyPlanned).toBe(false);
  });

  it("never proposes the same period to multiple candidates", () => {
    const candidates: CoverageCandidate[] = [
      {
        id: "candidate-a",
        schoolId: "school-riverside",
        name: "Candidate A",
        qualifiedSubjects: ["Math"],
        availablePeriods: ["P1", "P2", "P4"],
        conflictingPeriods: [],
        protectedPlanningPeriods: [],
        dailyCoverageCount: 3,
        active: true,
      },
      {
        id: "candidate-b",
        schoolId: "school-riverside",
        name: "Candidate B",
        qualifiedSubjects: ["Math"],
        availablePeriods: ["P2", "P4", "P6"],
        conflictingPeriods: [],
        protectedPlanningPeriods: [],
        dailyCoverageCount: 2,
        active: true,
      },
    ];

    const plan = buildCoveragePlan({
      absence: scenarioAAbsence,
      candidates,
      policy: riversideCoveragePolicy,
      existingAssignments: [],
    });

    const proposedPeriods = plan.proposals.flatMap(
      (proposal) => proposal.periodIds,
    );

    expect(new Set(proposedPeriods).size).toBe(
      proposedPeriods.length,
    );
  });
});