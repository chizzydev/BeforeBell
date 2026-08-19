import { describe, expect, it } from "vitest";

import {
  reconcileCoverageCase,
} from "@/application/actions/reconcile-coverage-case";

import { InMemoryBeforeBellStore } from "@/application/store/in-memory-beforebell-store";

import {
  riversideCoveragePolicy,
  scenarioAAbsence,
  scenarioACandidates,
} from "@/fixtures/riverside";

import type {
  AbsenceCase,
  CoverageAssignment,
  CoverageOffer,
  HumanDecision,
} from "@/domain/types";

function createStore({
  absenceCase = scenarioAAbsence,
  offers = [],
  assignments = [],
  decisions = [],
}: {
  absenceCase?: AbsenceCase;
  offers?: readonly CoverageOffer[];
  assignments?: readonly CoverageAssignment[];
  decisions?: readonly HumanDecision[];
} = {}) {
  return new InMemoryBeforeBellStore({
    policies: [riversideCoveragePolicy],
    cases: [absenceCase],
    candidates: scenarioACandidates,
    offers,
    assignments,
    decisions,
  });
}

function reconcileInput(
  overrides: Partial<{
    now: Date;
    activityEventId: string;
    correlationId: string;
  }> = {},
) {
  return {
    caseId: scenarioAAbsence.id,
    now: new Date(
      "2026-09-14T06:05:00.000Z",
    ),
    activityEventId:
      "event-reconcile-scenario-a",
    correlationId:
      "correlation-scenario-a",
    ...overrides,
  };
}

describe("reconcileCoverageCase", () => {
  it("moves an open case to offering when a pending active offer exists", async () => {
    const offer: CoverageOffer = {
      id: "offer-pending",
      caseId: scenarioAAbsence.id,
      candidateId:
        "candidate-alex-johnson",
      periodIds: ["P1", "P2", "P4", "P6"],
      status: "pending",
      createdAt:
        "2026-09-14T05:55:00.000Z",
      expiresAt:
        "2026-09-14T06:15:00.000Z",
    };

    const store = createStore({
      offers: [offer],
    });

    const result =
      await reconcileCoverageCase(
        store,
        reconcileInput(),
      );

    expect(result.success).toBe(true);
    expect(result.code).toBe(
      "case_status_updated",
    );

    expect(
      result.data?.currentStatus,
    ).toBe("offering");

    expect(
      (
        await store.getCase(
          scenarioAAbsence.id,
        )
      )?.status,
    ).toBe("offering");
  });

  it("treats an accepted active offer as in-flight coverage work", async () => {
    const offer: CoverageOffer = {
      id: "offer-accepted",
      caseId: scenarioAAbsence.id,
      candidateId:
        "candidate-alex-johnson",
      periodIds: ["P1", "P2", "P4", "P6"],
      status: "accepted",
      createdAt:
        "2026-09-14T05:55:00.000Z",
      expiresAt:
        "2026-09-14T06:15:00.000Z",
      respondedAt:
        "2026-09-14T06:00:00.000Z",
    };

    const store = createStore({
      offers: [offer],
    });

    const result =
      await reconcileCoverageCase(
        store,
        reconcileInput(),
      );

    expect(
      result.data?.currentStatus,
    ).toBe("offering");
  });

  it("derives partially covered from authoritative assignments", async () => {
    const assignment: CoverageAssignment = {
      id: "assignment-partial",
      caseId: scenarioAAbsence.id,
      candidateId:
        "candidate-alex-johnson",
      periodIds: ["P1", "P2"],
      source: "accepted_offer",
      offerId: "offer-partial",
      createdAt:
        "2026-09-14T06:03:00.000Z",
    };

    const store = createStore({
      assignments: [assignment],
    });

    const result =
      await reconcileCoverageCase(
        store,
        reconcileInput(),
      );

    expect(
      result.data?.currentStatus,
    ).toBe("partially_covered");
  });

  it("prioritizes a pending administrator decision for an unresolved case", async () => {
    const assignment: CoverageAssignment = {
      id: "assignment-partial",
      caseId: scenarioAAbsence.id,
      candidateId:
        "candidate-alex-johnson",
      periodIds: ["P1", "P2"],
      source: "accepted_offer",
      offerId: "offer-partial",
      createdAt:
        "2026-09-14T06:03:00.000Z",
    };

    const decision: HumanDecision = {
      id: "decision-p4",
      caseId: scenarioAAbsence.id,
      kind:
        "request_external_substitute",
      status: "pending",
      periodIds: ["P4"],
      summary:
        "Administrator decision required for P4.",
      requestedAt:
        "2026-09-14T06:04:00.000Z",
    };

    const store = createStore({
      assignments: [assignment],
      decisions: [decision],
    });

    const result =
      await reconcileCoverageCase(
        store,
        reconcileInput(),
      );

    expect(
      result.data?.currentStatus,
    ).toBe(
      "awaiting_human_decision",
    );
  });

  it("resolves Scenario A only when all affected periods are actually assigned", async () => {
    const assignment: CoverageAssignment = {
      id: "assignment-scenario-a",
      caseId: scenarioAAbsence.id,
      candidateId:
        "candidate-alex-johnson",
      periodIds: ["P1", "P2", "P4", "P6"],
      source: "accepted_offer",
      offerId:
        "offer-scenario-a-alex",
      createdAt:
        "2026-09-14T06:05:00.000Z",
    };

    const store = createStore({
      assignments: [assignment],
    });

    const result =
      await reconcileCoverageCase(
        store,
        reconcileInput(),
      );

    expect(result.success).toBe(true);
    expect(result.code).toBe(
      "case_status_updated",
    );

    expect(
      result.data?.previousStatus,
    ).toBe("open");

    expect(
      result.data?.currentStatus,
    ).toBe("resolved");

    expect(
      (
        await store.getCase(
          scenarioAAbsence.id,
        )
      )?.status,
    ).toBe("resolved");
  });

  it("does not treat an expired pending offer as active work", async () => {
    const expiredOffer: CoverageOffer = {
      id: "offer-expired",
      caseId: scenarioAAbsence.id,
      candidateId:
        "candidate-alex-johnson",
      periodIds: ["P1"],
      status: "pending",
      createdAt:
        "2026-09-14T05:30:00.000Z",
      expiresAt:
        "2026-09-14T05:45:00.000Z",
    };

    const store = createStore({
      offers: [expiredOffer],
    });

    const result =
      await reconcileCoverageCase(
        store,
        reconcileInput(),
      );

    expect(result.success).toBe(true);
    expect(result.code).toBe(
      "case_status_current",
    );

    expect(
      result.data?.currentStatus,
    ).toBe("open");
  });

  it("makes repeated reconciliation idempotent and avoids duplicate activity", async () => {
    const offer: CoverageOffer = {
      id: "offer-pending",
      caseId: scenarioAAbsence.id,
      candidateId:
        "candidate-alex-johnson",
      periodIds: ["P1", "P2", "P4", "P6"],
      status: "pending",
      createdAt:
        "2026-09-14T05:55:00.000Z",
      expiresAt:
        "2026-09-14T06:15:00.000Z",
    };

    const store = createStore({
      offers: [offer],
    });

    const first =
      await reconcileCoverageCase(
        store,
        reconcileInput(),
      );

    const second =
      await reconcileCoverageCase(
        store,
        reconcileInput({
          now: new Date(
            "2026-09-14T06:06:00.000Z",
          ),
          activityEventId:
            "event-reconcile-replay",
        }),
      );

    expect(first.code).toBe(
      "case_status_updated",
    );

    expect(second.success).toBe(true);
    expect(second.code).toBe(
      "case_status_current",
    );

    expect(
      await store.listActivityByCase(
        scenarioAAbsence.id,
      ),
    ).toHaveLength(1);
  });

  it("never reopens a closed case during operational reconciliation", async () => {
    const closedCase: AbsenceCase = {
      ...scenarioAAbsence,
      status: "closed",
    };

    const store = createStore({
      absenceCase: closedCase,
    });

    const result =
      await reconcileCoverageCase(
        store,
        reconcileInput(),
      );

    expect(result.success).toBe(true);
    expect(result.code).toBe(
      "case_already_closed",
    );

    expect(
      result.data?.currentStatus,
    ).toBe("closed");

    expect(
      (
        await store.getCase(
          scenarioAAbsence.id,
        )
      )?.status,
    ).toBe("closed");

    expect(
      await store.listActivityByCase(
        scenarioAAbsence.id,
      ),
    ).toEqual([]);
  });
});