import { describe, expect, it } from "vitest";

import {
  assignAcceptedCoverage,
} from "@/application/actions/assign-accepted-coverage";

import { InMemoryBeforeBellStore } from "@/application/store/in-memory-beforebell-store";

import {
  riversideCoveragePolicy,
  scenarioAAbsence,
  scenarioACandidates,
} from "@/fixtures/riverside";

import type {
  CoverageCandidate,
  CoverageOffer,
} from "@/domain/types";

function acceptedOffer(
  overrides: Partial<CoverageOffer> = {},
): CoverageOffer {
  return {
    id: "offer-scenario-a-alex",
    caseId: scenarioAAbsence.id,
    candidateId: "candidate-alex-johnson",
    periodIds: ["P1", "P2", "P4", "P6"],
    status: "accepted",
    createdAt: "2026-09-14T05:55:00.000Z",
    expiresAt: "2026-09-14T06:15:00.000Z",
    respondedAt: "2026-09-14T06:00:00.000Z",
    ...overrides,
  };
}

function createStore(
  offer: CoverageOffer = acceptedOffer(),
  candidates: readonly CoverageCandidate[] =
    scenarioACandidates,
) {
  return new InMemoryBeforeBellStore({
    policies: [riversideCoveragePolicy],
    cases: [scenarioAAbsence],
    candidates,
    offers: [offer],
  });
}

function assignmentInput(
  offerId = "offer-scenario-a-alex",
) {
  return {
    assignmentId:
      "assignment-scenario-a-alex",
    offerId,
    now: new Date(
      "2026-09-14T06:05:00.000Z",
    ),
    activityEventId:
      "event-assignment-scenario-a-alex",
    correlationId:
      "correlation-scenario-a",
  };
}

describe("assignAcceptedCoverage", () => {
  it("creates an assignment from an accepted active offer after revalidation", async () => {
    const store = createStore();

    const result =
      await assignAcceptedCoverage(
        store,
        assignmentInput(),
      );

    expect(result.success).toBe(true);
    expect(result.code).toBe(
      "assignment_created",
    );

    expect(result.data?.assignment).toEqual({
      id: "assignment-scenario-a-alex",
      caseId: scenarioAAbsence.id,
      candidateId:
        "candidate-alex-johnson",
      periodIds: ["P1", "P2", "P4", "P6"],
      source: "accepted_offer",
      offerId: "offer-scenario-a-alex",
      createdAt:
        "2026-09-14T06:05:00.000Z",
    });

    expect(
      await store.listAssignmentsByCase(
        scenarioAAbsence.id,
      ),
    ).toHaveLength(1);

    const activity =
      await store.listActivityByCase(
        scenarioAAbsence.id,
      );

    expect(activity).toHaveLength(1);
    expect(activity[0]?.action).toBe(
      "coverage_assignment_created",
    );
  });

  it("does not assign from a pending offer", async () => {
    const store = createStore(
      acceptedOffer({
        status: "pending",
        respondedAt: undefined,
      }),
    );

    const result =
      await assignAcceptedCoverage(
        store,
        assignmentInput(),
      );

    expect(result.success).toBe(false);
    expect(result.code).toBe(
      "offer_not_accepted",
    );

    expect(
      await store.listAssignmentsByCase(
        scenarioAAbsence.id,
      ),
    ).toEqual([]);
  });

  it("does not assign from an expired accepted offer", async () => {
    const store = createStore();

    const result =
      await assignAcceptedCoverage(
        store,
        {
          ...assignmentInput(),
          now: new Date(
            "2026-09-14T06:15:00.000Z",
          ),
        },
      );

    expect(result.success).toBe(false);
    expect(result.code).toBe(
      "offer_expired",
    );

    expect(
      await store.listAssignmentsByCase(
        scenarioAAbsence.id,
      ),
    ).toEqual([]);
  });

  it("revalidates availability after acceptance and refuses a stale assignment", async () => {
    const candidates =
      scenarioACandidates.map((candidate) =>
        candidate.id ===
        "candidate-alex-johnson"
          ? {
              ...candidate,
              availablePeriods: [
                "P1",
                "P2",
                "P4",
              ] as const,
            }
          : candidate,
      );

    const store = createStore(
      acceptedOffer(),
      candidates,
    );

    const result =
      await assignAcceptedCoverage(
        store,
        assignmentInput(),
      );

    expect(result.success).toBe(false);
    expect(result.code).toBe(
      "candidate_no_longer_eligible",
    );

    expect(
      await store.listAssignmentsByCase(
        scenarioAAbsence.id,
      ),
    ).toEqual([]);
  });

  it("treats an exact repeated assignment action as an idempotent success", async () => {
    const store = createStore();

    const first =
      await assignAcceptedCoverage(
        store,
        assignmentInput(),
      );

    const second =
      await assignAcceptedCoverage(
        store,
        {
          ...assignmentInput(),
          activityEventId:
            "event-assignment-replay",
          now: new Date(
            "2026-09-14T06:10:00.000Z",
          ),
        },
      );

    expect(first.code).toBe(
      "assignment_created",
    );

    expect(second.success).toBe(true);
    expect(second.code).toBe(
      "assignment_already_created",
    );

    expect(
      second.data?.idempotentReplay,
    ).toBe(true);

    expect(
      await store.listAssignmentsByCase(
        scenarioAAbsence.id,
      ),
    ).toHaveLength(1);

    expect(
      await store.listActivityByCase(
        scenarioAAbsence.id,
      ),
    ).toHaveLength(1);
  });

  it("prevents two accepted candidates from both winning the same slot", async () => {
    const alexOffer: CoverageOffer = {
      id: "offer-race-alex",
      caseId: scenarioAAbsence.id,
      candidateId:
        "candidate-alex-johnson",
      periodIds: ["P1"],
      status: "accepted",
      createdAt:
        "2026-09-14T05:55:00.000Z",
      expiresAt:
        "2026-09-14T06:15:00.000Z",
      respondedAt:
        "2026-09-14T06:00:00.000Z",
    };

    const davidOffer: CoverageOffer = {
      id: "offer-race-david",
      caseId: scenarioAAbsence.id,
      candidateId:
        "candidate-david-kim",
      periodIds: ["P1"],
      status: "accepted",
      createdAt:
        "2026-09-14T05:55:00.000Z",
      expiresAt:
        "2026-09-14T06:15:00.000Z",
      respondedAt:
        "2026-09-14T06:00:00.000Z",
    };

    const store =
      new InMemoryBeforeBellStore({
        policies: [
          riversideCoveragePolicy,
        ],
        cases: [scenarioAAbsence],
        candidates: scenarioACandidates,
        offers: [
          alexOffer,
          davidOffer,
        ],
      });

    const [alexResult, davidResult] =
      await Promise.all([
        assignAcceptedCoverage(
          store,
          {
            assignmentId:
              "assignment-race-alex",
            offerId:
              alexOffer.id,
            now: new Date(
              "2026-09-14T06:05:00.000Z",
            ),
            activityEventId:
              "event-race-alex",
            correlationId:
              "correlation-assignment-race",
          },
        ),

        assignAcceptedCoverage(
          store,
          {
            assignmentId:
              "assignment-race-david",
            offerId:
              davidOffer.id,
            now: new Date(
              "2026-09-14T06:05:00.000Z",
            ),
            activityEventId:
              "event-race-david",
            correlationId:
              "correlation-assignment-race",
          },
        ),
      ]);

    const results = [
      alexResult,
      davidResult,
    ];

    expect(
      results.filter(
        (result) =>
          result.code ===
          "assignment_created",
      ),
    ).toHaveLength(1);

    expect(
      results.filter(
        (result) =>
          result.code ===
          "assignment_conflict",
      ),
    ).toHaveLength(1);

    expect(
      await store.listAssignmentsByCase(
        scenarioAAbsence.id,
      ),
    ).toHaveLength(1);

    expect(
      await store.listActivityByCase(
        scenarioAAbsence.id,
      ),
    ).toHaveLength(1);
  });

  it("rejects an unknown offer", async () => {
    const store = createStore();

    const result =
      await assignAcceptedCoverage(
        store,
        assignmentInput(
          "offer-does-not-exist",
        ),
      );

    expect(result.success).toBe(false);
    expect(result.code).toBe(
      "offer_not_found",
    );
  });
});