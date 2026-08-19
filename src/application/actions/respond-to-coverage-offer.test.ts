import { describe, expect, it } from "vitest";

import {
  respondToCoverageOffer,
} from "@/application/actions/respond-to-coverage-offer";

import { InMemoryBeforeBellStore } from "@/application/store/in-memory-beforebell-store";

import {
  riversideCoveragePolicy,
  scenarioAAbsence,
  scenarioACandidates,
} from "@/fixtures/riverside";

import type {
  AbsenceCase,
  CoverageOffer,
} from "@/domain/types";

function createPendingOffer(
  overrides: Partial<CoverageOffer> = {},
): CoverageOffer {
  return {
    id: "offer-scenario-a-alex",
    caseId: scenarioAAbsence.id,
    candidateId: "candidate-alex-johnson",
    periodIds: ["P1", "P2", "P4", "P6"],
    status: "pending",
    createdAt: "2026-09-14T05:55:00.000Z",
    expiresAt: "2026-09-14T06:15:00.000Z",
    ...overrides,
  };
}

function createStore(
  offer: CoverageOffer = createPendingOffer(),
  absenceCase: AbsenceCase = scenarioAAbsence,
) {
  return new InMemoryBeforeBellStore({
    policies: [riversideCoveragePolicy],
    cases: [absenceCase],
    candidates: scenarioACandidates,
    offers: [offer],
  });
}

describe("respondToCoverageOffer", () => {
  it("records an acceptance without creating an assignment", async () => {
    const store = createStore();

    const result = await respondToCoverageOffer(
      store,
      {
        offerId: "offer-scenario-a-alex",
        response: "accepted",
        now: new Date(
          "2026-09-14T06:00:00.000Z",
        ),
        activityEventId:
          "event-alex-accepted",
        correlationId:
          "correlation-scenario-a",
      },
    );

    expect(result.success).toBe(true);
    expect(result.code).toBe(
      "offer_response_recorded",
    );

    expect(result.data?.offer.status).toBe(
      "accepted",
    );

    expect(
      result.data?.offer.respondedAt,
    ).toBe(
      "2026-09-14T06:00:00.000Z",
    );

    expect(
      await store.listAssignmentsByCase(
        scenarioAAbsence.id,
      ),
    ).toEqual([]);

    const activity =
      await store.listActivityByCase(
        scenarioAAbsence.id,
      );

    expect(activity).toHaveLength(1);
    expect(activity[0]?.action).toBe(
      "coverage_offer_accepted",
    );
  });

  it("records a decline without creating an assignment", async () => {
    const store = createStore();

    const result = await respondToCoverageOffer(
      store,
      {
        offerId: "offer-scenario-a-alex",
        response: "declined",
        now: new Date(
          "2026-09-14T06:00:00.000Z",
        ),
        activityEventId:
          "event-alex-declined",
        correlationId:
          "correlation-scenario-a",
      },
    );

    expect(result.success).toBe(true);
    expect(result.code).toBe(
      "offer_response_recorded",
    );

    expect(result.data?.offer.status).toBe(
      "declined",
    );

    expect(
      await store.listAssignmentsByCase(
        scenarioAAbsence.id,
      ),
    ).toEqual([]);
  });

  it("treats repeating the same response as an idempotent success", async () => {
    const store = createStore();

    const first =
      await respondToCoverageOffer(
        store,
        {
          offerId:
            "offer-scenario-a-alex",
          response: "accepted",
          now: new Date(
            "2026-09-14T06:00:00.000Z",
          ),
          activityEventId:
            "event-alex-accepted",
          correlationId:
            "correlation-scenario-a",
        },
      );

    const second =
      await respondToCoverageOffer(
        store,
        {
          offerId:
            "offer-scenario-a-alex",
          response: "accepted",
          now: new Date(
            "2026-09-14T06:05:00.000Z",
          ),
          activityEventId:
            "event-alex-accepted-replay",
          correlationId:
            "correlation-scenario-a",
        },
      );

    expect(first.code).toBe(
      "offer_response_recorded",
    );

    expect(second.success).toBe(true);
    expect(second.code).toBe(
      "offer_response_already_recorded",
    );

    expect(
      second.data?.idempotentReplay,
    ).toBe(true);

    expect(
      await store.listActivityByCase(
        scenarioAAbsence.id,
      ),
    ).toHaveLength(1);
  });

  it("rejects changing an accepted offer to declined", async () => {
    const store = createStore();

    await respondToCoverageOffer(
      store,
      {
        offerId: "offer-scenario-a-alex",
        response: "accepted",
        now: new Date(
          "2026-09-14T06:00:00.000Z",
        ),
        activityEventId:
          "event-alex-accepted",
        correlationId:
          "correlation-scenario-a",
      },
    );

    const result =
      await respondToCoverageOffer(
        store,
        {
          offerId:
            "offer-scenario-a-alex",
          response: "declined",
          now: new Date(
            "2026-09-14T06:01:00.000Z",
          ),
          activityEventId:
            "event-alex-decline-after-accept",
          correlationId:
            "correlation-scenario-a",
        },
      );

    expect(result.success).toBe(false);
    expect(result.code).toBe(
      "offer_already_responded",
    );

    expect(
      (
        await store.getOffer(
          "offer-scenario-a-alex",
        )
      )?.status,
    ).toBe("accepted");
  });

  it("rejects a response received after offer expiry", async () => {
    const store = createStore();

    const result =
      await respondToCoverageOffer(
        store,
        {
          offerId:
            "offer-scenario-a-alex",
          response: "accepted",
          now: new Date(
            "2026-09-14T06:15:00.000Z",
          ),
          activityEventId:
            "event-expired-response",
          correlationId:
            "correlation-scenario-a",
        },
      );

    expect(result.success).toBe(false);
    expect(result.code).toBe(
      "offer_expired",
    );

    expect(
      (
        await store.getOffer(
          "offer-scenario-a-alex",
        )
      )?.status,
    ).toBe("pending");
  });

  it("rejects responses to a cancelled offer", async () => {
    const store = createStore(
      createPendingOffer({
        status: "cancelled",
      }),
    );

    const result =
      await respondToCoverageOffer(
        store,
        {
          offerId:
            "offer-scenario-a-alex",
          response: "accepted",
          now: new Date(
            "2026-09-14T06:00:00.000Z",
          ),
          activityEventId:
            "event-cancelled-response",
          correlationId:
            "correlation-scenario-a",
        },
      );

    expect(result.success).toBe(false);
    expect(result.code).toBe(
      "offer_not_respondable",
    );
  });

  it("rejects a response when the case is already resolved", async () => {
    const resolvedCase: AbsenceCase = {
      ...scenarioAAbsence,
      status: "resolved",
    };

    const store = createStore(
      createPendingOffer(),
      resolvedCase,
    );

    const result =
      await respondToCoverageOffer(
        store,
        {
          offerId:
            "offer-scenario-a-alex",
          response: "accepted",
          now: new Date(
            "2026-09-14T06:00:00.000Z",
          ),
          activityEventId:
            "event-resolved-response",
          correlationId:
            "correlation-scenario-a",
        },
      );

    expect(result.success).toBe(false);
    expect(result.code).toBe(
      "case_not_actionable",
    );
  });

  it("returns an explicit result for an unknown offer", async () => {
    const store = createStore();

    const result =
      await respondToCoverageOffer(
        store,
        {
          offerId: "offer-does-not-exist",
          response: "accepted",
          now: new Date(
            "2026-09-14T06:00:00.000Z",
          ),
          activityEventId:
            "event-missing-offer",
          correlationId:
            "correlation-scenario-a",
        },
      );

    expect(result.success).toBe(false);
    expect(result.code).toBe(
      "offer_not_found",
    );
  });

  it("allows only one conflicting candidate response to win a race", async () => {
    const store = createStore();

    const [
      acceptResult,
      declineResult,
    ] = await Promise.all([
      respondToCoverageOffer(
        store,
        {
          offerId:
            "offer-scenario-a-alex",
          response: "accepted",
          now: new Date(
            "2026-09-14T06:00:00.000Z",
          ),
          activityEventId:
            "event-race-accept",
          correlationId:
            "correlation-race",
        },
      ),

      respondToCoverageOffer(
        store,
        {
          offerId:
            "offer-scenario-a-alex",
          response: "declined",
          now: new Date(
            "2026-09-14T06:00:00.000Z",
          ),
          activityEventId:
            "event-race-decline",
          correlationId:
            "correlation-race",
        },
      ),
    ]);

    const results = [
      acceptResult,
      declineResult,
    ];

    expect(
      results.filter(
        (result) =>
          result.code ===
          "offer_response_recorded",
      ),
    ).toHaveLength(1);

    expect(
      results.filter(
        (result) =>
          result.code ===
          "offer_already_responded",
      ),
    ).toHaveLength(1);

    const authoritativeOffer =
      await store.getOffer(
        "offer-scenario-a-alex",
      );

    expect([
      "accepted",
      "declined",
    ]).toContain(
      authoritativeOffer?.status,
    );

    expect(
      await store.listActivityByCase(
        scenarioAAbsence.id,
      ),
    ).toHaveLength(1);
  });
});