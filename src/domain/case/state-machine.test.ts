import { describe, expect, it } from "vitest";

import {
  canTransitionCaseStatus,
  deriveCaseOperationalStatus,
  transitionCaseStatus,
} from "@/domain/case/state-machine";

import { scenarioAAbsence } from "@/fixtures/riverside";

describe("case operational status derivation", () => {
  it("derives open when nothing has happened yet", () => {
    expect(
      deriveCaseOperationalStatus({
        affectedPeriodIds: ["P1", "P2", "P4", "P6"],
        coveredPeriodIds: [],
        pendingOfferCount: 0,
        pendingDecisionCount: 0,
      }),
    ).toBe("open");
  });

  it("derives offering when an offer is pending and nothing is covered", () => {
    expect(
      deriveCaseOperationalStatus({
        affectedPeriodIds: ["P1", "P2", "P4", "P6"],
        coveredPeriodIds: [],
        pendingOfferCount: 1,
        pendingDecisionCount: 0,
      }),
    ).toBe("offering");
  });

  it("derives partially covered when some affected periods are covered", () => {
    expect(
      deriveCaseOperationalStatus({
        affectedPeriodIds: ["P1", "P2", "P4", "P6"],
        coveredPeriodIds: ["P1", "P2"],
        pendingOfferCount: 0,
        pendingDecisionCount: 0,
      }),
    ).toBe("partially_covered");
  });

  it("prioritizes a pending human decision for an unresolved case", () => {
    expect(
      deriveCaseOperationalStatus({
        affectedPeriodIds: ["P2", "P3", "P5"],
        coveredPeriodIds: ["P2", "P3"],
        pendingOfferCount: 0,
        pendingDecisionCount: 1,
      }),
    ).toBe("awaiting_human_decision");
  });

  it("derives resolved when every affected period is covered", () => {
    expect(
      deriveCaseOperationalStatus({
        affectedPeriodIds: ["P2", "P3", "P5"],
        coveredPeriodIds: ["P2", "P3", "P5"],
        pendingOfferCount: 0,
        pendingDecisionCount: 0,
      }),
    ).toBe("resolved");
  });

  it("does not count coverage for unrelated periods", () => {
    expect(
      deriveCaseOperationalStatus({
        affectedPeriodIds: ["P1", "P2"],
        coveredPeriodIds: ["P3", "P4"],
        pendingOfferCount: 0,
        pendingDecisionCount: 0,
      }),
    ).toBe("open");
  });

  it("handles duplicate covered-period observations safely", () => {
    expect(
      deriveCaseOperationalStatus({
        affectedPeriodIds: ["P1", "P2"],
        coveredPeriodIds: ["P1", "P1"],
        pendingOfferCount: 0,
        pendingDecisionCount: 0,
      }),
    ).toBe("partially_covered");
  });
});

describe("case state transitions", () => {
  it("allows an open case to begin offering coverage", () => {
    expect(canTransitionCaseStatus("open", "offering")).toBe(true);
  });

  it("allows a resolved case to be closed", () => {
    expect(canTransitionCaseStatus("resolved", "closed")).toBe(true);
  });

  it("rejects closing a case directly from open", () => {
    expect(canTransitionCaseStatus("open", "closed")).toBe(false);
  });

  it("rejects reopening a closed case", () => {
    expect(canTransitionCaseStatus("closed", "open")).toBe(false);
  });

  it("applies a valid transition and updates the timestamp", () => {
    const result = transitionCaseStatus(
      scenarioAAbsence,
      "offering",
      new Date("2026-09-14T05:45:00.000Z"),
    );

    expect(result.success).toBe(true);
    expect(result.changed).toBe(true);
    expect(result.code).toBe("transition_applied");

    expect(result.case.status).toBe("offering");
    expect(result.case.updatedAt).toBe(
      "2026-09-14T05:45:00.000Z",
    );
  });

  it("treats a repeated transition as an idempotent success", () => {
    const offeringCase = {
      ...scenarioAAbsence,
      status: "offering" as const,
    };

    const result = transitionCaseStatus(
      offeringCase,
      "offering",
      new Date("2026-09-14T05:50:00.000Z"),
    );

    expect(result.success).toBe(true);
    expect(result.changed).toBe(false);
    expect(result.code).toBe("already_in_status");

    expect(result.case).toBe(offeringCase);
  });

  it("rejects an invalid transition without modifying the case", () => {
    const result = transitionCaseStatus(
      scenarioAAbsence,
      "closed",
      new Date("2026-09-14T05:50:00.000Z"),
    );

    expect(result.success).toBe(false);
    expect(result.changed).toBe(false);
    expect(result.code).toBe("invalid_transition");

    expect(result.case).toBe(scenarioAAbsence);
    expect(result.case.status).toBe("open");
  });
});