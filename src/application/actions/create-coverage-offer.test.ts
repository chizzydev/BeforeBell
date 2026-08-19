import { describe, expect, it } from "vitest";

import {
  createCoverageOffer,
  type CreateCoverageOfferInput,
} from "@/application/actions/create-coverage-offer";

import { InMemoryBeforeBellStore } from "@/application/store/in-memory-beforebell-store";

import {
  riversideCoveragePolicy,
  scenarioAAbsence,
  scenarioACandidates,
  scenarioBAbsence,
  scenarioBCandidates,
} from "@/fixtures/riverside";

import type {
  AbsenceCase,
  CoverageAssignment,
  CoverageOffer,
} from "@/domain/types";

function createScenarioAStore() {
  return new InMemoryBeforeBellStore({
    policies: [riversideCoveragePolicy],
    cases: [scenarioAAbsence],
    candidates: scenarioACandidates,
  });
}

function createScenarioAInput(
  overrides: Partial<CreateCoverageOfferInput> = {},
): CreateCoverageOfferInput {
  return {
    offerId: "offer-scenario-a-alex",
    caseId: scenarioAAbsence.id,
    candidateId: "candidate-alex-johnson",
    periodIds: ["P1", "P2", "P4", "P6"],
    now: new Date("2026-09-14T05:55:00.000Z"),
    expiresAt: new Date(
      "2026-09-14T06:15:00.000Z",
    ),
    activityEventId: "event-offer-scenario-a-alex",
    correlationId: "correlation-scenario-a",
    ...overrides,
  };
}

describe("createCoverageOffer", () => {
  it("creates a policy-safe pending offer for Scenario A", async () => {
    const store = createScenarioAStore();

    const result = await createCoverageOffer(
      store,
      createScenarioAInput(),
    );

    expect(result.success).toBe(true);
    expect(result.code).toBe("offer_created");

    expect(result.data?.idempotentReplay).toBe(false);

    expect(result.data?.offer).toEqual({
      id: "offer-scenario-a-alex",
      caseId: scenarioAAbsence.id,
      candidateId: "candidate-alex-johnson",
      periodIds: ["P1", "P2", "P4", "P6"],
      status: "pending",
      createdAt: "2026-09-14T05:55:00.000Z",
      expiresAt: "2026-09-14T06:15:00.000Z",
    });

    expect(
      await store.listOffersByCase(
        scenarioAAbsence.id,
      ),
    ).toHaveLength(1);

    const activity =
      await store.listActivityByCase(
        scenarioAAbsence.id,
      );

    expect(activity).toHaveLength(1);
    expect(activity[0]?.action).toBe(
      "coverage_offer_created",
    );
  });

  it("treats replaying the exact same offer ID as an idempotent success", async () => {
    const store = createScenarioAStore();
    const input = createScenarioAInput();

    const first = await createCoverageOffer(
      store,
      input,
    );

    const second = await createCoverageOffer(
      store,
      input,
    );

    expect(first.code).toBe("offer_created");

    expect(second.success).toBe(true);
    expect(second.code).toBe(
      "offer_already_created",
    );

    expect(
      second.data?.idempotentReplay,
    ).toBe(true);

    expect(
      await store.listOffersByCase(
        scenarioAAbsence.id,
      ),
    ).toHaveLength(1);

    expect(
      await store.listActivityByCase(
        scenarioAAbsence.id,
      ),
    ).toHaveLength(1);
  });

  it("rejects reuse of an offer ID for a different request", async () => {
    const store = createScenarioAStore();

    await createCoverageOffer(
      store,
      createScenarioAInput(),
    );

    const result = await createCoverageOffer(
      store,
      createScenarioAInput({
        candidateId: "candidate-maria-patel",
        periodIds: ["P2", "P4", "P6"],
      }),
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe(
      "offer_idempotency_conflict",
    );
  });

  it("revalidates candidate eligibility instead of trusting an earlier plan", async () => {
    const store = createScenarioAStore();

    const alex = await store.getCandidate(
      "candidate-alex-johnson",
    );

    if (!alex) {
      throw new Error("Expected Alex Johnson");
    }

    await store.putCandidate({
      ...alex,
      availablePeriods: ["P1", "P2", "P4"],
    });

    const result = await createCoverageOffer(
      store,
      createScenarioAInput(),
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe(
      "candidate_no_longer_eligible",
    );

    expect(
      await store.listOffersByCase(
        scenarioAAbsence.id,
      ),
    ).toEqual([]);
  });

  it("does not create a normal offer for protected planning", async () => {
    const store = new InMemoryBeforeBellStore({
      policies: [riversideCoveragePolicy],
      cases: [scenarioBAbsence],
      candidates: scenarioBCandidates,
    });

    const result = await createCoverageOffer(
      store,
      {
        offerId: "offer-ms-taylor-p5",
        caseId: scenarioBAbsence.id,
        candidateId: "candidate-ms-taylor",
        periodIds: ["P5"],
        now: new Date(
          "2026-09-14T05:55:00.000Z",
        ),
        expiresAt: new Date(
          "2026-09-14T06:15:00.000Z",
        ),
        activityEventId:
          "event-offer-ms-taylor-p5",
        correlationId:
          "correlation-scenario-b",
      },
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe(
      "candidate_no_longer_eligible",
    );
  });

  it("rejects an offer for a period already covered by the case", async () => {
    const assignment: CoverageAssignment = {
      id: "assignment-existing-p1",
      caseId: scenarioAAbsence.id,
      candidateId: "candidate-other",
      periodIds: ["P1"],
      source: "accepted_offer",
      offerId: "offer-existing",
      createdAt: "2026-09-14T05:50:00.000Z",
    };

    const store = new InMemoryBeforeBellStore({
      policies: [riversideCoveragePolicy],
      cases: [scenarioAAbsence],
      candidates: scenarioACandidates,
      assignments: [assignment],
    });

    const result = await createCoverageOffer(
      store,
      createScenarioAInput(),
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe(
      "period_already_covered",
    );
  });

  it("prevents another active offer from targeting the same case period", async () => {
    const activeOffer: CoverageOffer = {
      id: "offer-existing-p1",
      caseId: scenarioAAbsence.id,
      candidateId: "candidate-maria-patel",
      periodIds: ["P1"],
      status: "pending",
      createdAt: "2026-09-14T05:50:00.000Z",
      expiresAt: "2026-09-14T06:10:00.000Z",
    };

    const store = new InMemoryBeforeBellStore({
      policies: [riversideCoveragePolicy],
      cases: [scenarioAAbsence],
      candidates: scenarioACandidates,
      offers: [activeOffer],
    });

    const result = await createCoverageOffer(
      store,
      createScenarioAInput(),
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe(
      "period_already_offered",
    );
  });

  it("allows a new offer when an older overlapping offer is stale", async () => {
    const expiredOffer: CoverageOffer = {
      id: "offer-old",
      caseId: scenarioAAbsence.id,
      candidateId: "candidate-maria-patel",
      periodIds: ["P2"],
      status: "pending",
      createdAt: "2026-09-14T05:20:00.000Z",
      expiresAt: "2026-09-14T05:40:00.000Z",
    };

    const store = new InMemoryBeforeBellStore({
      policies: [riversideCoveragePolicy],
      cases: [scenarioAAbsence],
      candidates: scenarioACandidates,
      offers: [expiredOffer],
    });

    const result = await createCoverageOffer(
      store,
      createScenarioAInput(),
    );

    expect(result.success).toBe(true);
    expect(result.code).toBe("offer_created");
  });

  it("rejects creating an offer for a resolved case", async () => {
    const resolvedCase: AbsenceCase = {
      ...scenarioAAbsence,
      status: "resolved",
    };

    const store = new InMemoryBeforeBellStore({
      policies: [riversideCoveragePolicy],
      cases: [resolvedCase],
      candidates: scenarioACandidates,
    });

    const result = await createCoverageOffer(
      store,
      createScenarioAInput(),
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe(
      "case_not_actionable",
    );
  });

     it("uses authoritative assignments when the candidate daily count is stale", async () => {
    const priorAssignments: CoverageAssignment[] = [
      {
        id: "assignment-prior-p3",
        caseId: "case-prior-p3",
        candidateId: "candidate-alex-johnson",
        periodIds: ["P3"],
        source: "accepted_offer",
        offerId: "offer-prior-p3",
        createdAt: "2026-09-14T05:00:00.000Z",
      },
      {
        id: "assignment-prior-p5",
        caseId: "case-prior-p5",
        candidateId: "candidate-alex-johnson",
        periodIds: ["P5"],
        source: "accepted_offer",
        offerId: "offer-prior-p5",
        createdAt: "2026-09-14T05:05:00.000Z",
      },
      {
        id: "assignment-prior-p7",
        caseId: "case-prior-p7",
        candidateId: "candidate-alex-johnson",
        periodIds: ["P7"],
        source: "accepted_offer",
        offerId: "offer-prior-p7",
        createdAt: "2026-09-14T05:10:00.000Z",
      },
      {
        id: "assignment-prior-p8",
        caseId: "case-prior-p8",
        candidateId: "candidate-alex-johnson",
        periodIds: ["P8"],
        source: "accepted_offer",
        offerId: "offer-prior-p8",
        createdAt: "2026-09-14T05:15:00.000Z",
      },
    ];

    const store = new InMemoryBeforeBellStore({
      policies: [riversideCoveragePolicy],
      cases: [scenarioAAbsence],
      candidates: scenarioACandidates,
      assignments: priorAssignments,
    });

    const result = await createCoverageOffer(
      store,
      createScenarioAInput(),
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe(
      "candidate_no_longer_eligible",
    );
  });

});