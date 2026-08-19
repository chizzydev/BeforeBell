import { describe, expect, it } from "vitest";

import {
  acceptedOfferCanCreateAssignment,
  candidateAlreadyAssignedForPeriod,
  candidateCanTakeAdditionalPeriods,
  candidateHasConflictForPeriod,
  candidateIsAvailableForPeriod,
  caseAlreadyAssignedForPeriod,
  hasDuplicatePeriods,
  offerIsActive,
  periodIsProtectedPlanning,
} from "@/domain/coverage/invariants";

import type {
  CoverageAssignment,
  CoverageCandidate,
  CoverageOffer,
} from "@/domain/types";

const candidate: CoverageCandidate = {
  id: "candidate-alex",
  schoolId: "school-riverside",
  name: "Alex Johnson",
  qualifiedSubjects: ["Math"],
  availablePeriods: ["P1", "P2", "P4", "P6"],
  conflictingPeriods: ["P3"],
  protectedPlanningPeriods: ["P5"],
  dailyCoverageCount: 1,
  active: true,
};

describe("coverage invariants", () => {
  it("detects duplicate periods", () => {
    expect(hasDuplicatePeriods(["P1", "P2", "P1"])).toBe(true);
    expect(hasDuplicatePeriods(["P1", "P2", "P4"])).toBe(false);
  });

  it("checks authoritative candidate availability", () => {
    expect(candidateIsAvailableForPeriod(candidate, "P1")).toBe(true);
    expect(candidateIsAvailableForPeriod(candidate, "P7")).toBe(false);
  });

  it("detects candidate conflicts", () => {
    expect(candidateHasConflictForPeriod(candidate, "P3")).toBe(true);
    expect(candidateHasConflictForPeriod(candidate, "P2")).toBe(false);
  });

  it("identifies protected planning periods", () => {
    expect(periodIsProtectedPlanning(candidate, "P5")).toBe(true);
    expect(periodIsProtectedPlanning(candidate, "P4")).toBe(false);
  });

  it("enforces the maximum daily coverage limit", () => {
    expect(candidateCanTakeAdditionalPeriods(candidate, 4, 5)).toBe(true);
    expect(candidateCanTakeAdditionalPeriods(candidate, 5, 5)).toBe(false);
  });

  it("rejects negative additional period counts", () => {
    expect(candidateCanTakeAdditionalPeriods(candidate, -1, 5)).toBe(false);
  });

  it("treats a pending unexpired offer as active", () => {
    const offer: CoverageOffer = {
      id: "offer-1",
      caseId: "case-1",
      candidateId: candidate.id,
      periodIds: ["P1"],
      status: "pending",
      createdAt: "2026-08-15T06:40:00.000Z",
      expiresAt: "2026-08-15T07:00:00.000Z",
    };

    expect(
      offerIsActive(
        offer,
        new Date("2026-08-15T06:50:00.000Z"),
      ),
    ).toBe(true);
  });

  it("treats an expired offer as inactive", () => {
    const offer: CoverageOffer = {
      id: "offer-1",
      caseId: "case-1",
      candidateId: candidate.id,
      periodIds: ["P1"],
      status: "pending",
      createdAt: "2026-08-15T06:40:00.000Z",
      expiresAt: "2026-08-15T07:00:00.000Z",
    };

    expect(
      offerIsActive(
        offer,
        new Date("2026-08-15T07:01:00.000Z"),
      ),
    ).toBe(false);
  });

  it("requires an accepted active offer for normal assignment", () => {
    const offer: CoverageOffer = {
      id: "offer-accepted",
      caseId: "case-1",
      candidateId: candidate.id,
      periodIds: ["P1"],
      status: "accepted",
      createdAt: "2026-08-15T06:40:00.000Z",
      expiresAt: "2026-08-15T07:00:00.000Z",
      respondedAt: "2026-08-15T06:45:00.000Z",
    };

    expect(
      acceptedOfferCanCreateAssignment(
        offer,
        new Date("2026-08-15T06:50:00.000Z"),
      ),
    ).toBe(true);
  });

  it("does not allow an expired accepted offer to create an assignment", () => {
    const offer: CoverageOffer = {
      id: "offer-expired",
      caseId: "case-1",
      candidateId: candidate.id,
      periodIds: ["P1"],
      status: "accepted",
      createdAt: "2026-08-15T06:40:00.000Z",
      expiresAt: "2026-08-15T07:00:00.000Z",
      respondedAt: "2026-08-15T06:45:00.000Z",
    };

    expect(
      acceptedOfferCanCreateAssignment(
        offer,
        new Date("2026-08-15T07:01:00.000Z"),
      ),
    ).toBe(false);
  });

  it("detects an existing candidate assignment for a period", () => {
    const assignments: CoverageAssignment[] = [
      {
        id: "assignment-1",
        caseId: "case-other",
        candidateId: candidate.id,
        periodIds: ["P2"],
        source: "accepted_offer",
        offerId: "offer-other",
        createdAt: "2026-08-15T06:30:00.000Z",
      },
    ];

    expect(
      candidateAlreadyAssignedForPeriod(
        assignments,
        candidate.id,
        "P2",
      ),
    ).toBe(true);

    expect(
      candidateAlreadyAssignedForPeriod(
        assignments,
        candidate.id,
        "P4",
      ),
    ).toBe(false);
  });

  it("detects when a case period is already covered", () => {
    const assignments: CoverageAssignment[] = [
      {
        id: "assignment-1",
        caseId: "case-1",
        candidateId: candidate.id,
        periodIds: ["P1"],
        source: "accepted_offer",
        offerId: "offer-1",
        createdAt: "2026-08-15T06:30:00.000Z",
      },
    ];

    expect(
      caseAlreadyAssignedForPeriod(
        assignments,
        "case-1",
        "P1",
      ),
    ).toBe(true);

    expect(
      caseAlreadyAssignedForPeriod(
        assignments,
        "case-1",
        "P2",
      ),
    ).toBe(false);
  });
});