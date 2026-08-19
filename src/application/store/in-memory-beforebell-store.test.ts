import { describe, expect, it } from "vitest";

import { InMemoryBeforeBellStore } from "@/application/store/in-memory-beforebell-store";

import {
  riversideCoveragePolicy,
  scenarioAAbsence,
  scenarioACandidates,
} from "@/fixtures/riverside";

import type {
  ActivityEvent,
  CoverageAssignment,
  CoverageOffer,
  PeriodId,
} from "@/domain/types";

function createStore(): InMemoryBeforeBellStore {
  return new InMemoryBeforeBellStore({
    policies: [riversideCoveragePolicy],
    cases: [scenarioAAbsence],
    candidates: scenarioACandidates,
  });
}

describe("InMemoryBeforeBellStore", () => {
  it("loads seeded authoritative coverage state", async () => {
    const store = createStore();

    const policy = await store.getPolicy(
      riversideCoveragePolicy.schoolId,
    );

    const absenceCase = await store.getCase(
      scenarioAAbsence.id,
    );

    const candidates = await store.listCandidatesBySchool(
      scenarioAAbsence.schoolId,
    );

    expect(policy).toEqual(riversideCoveragePolicy);
    expect(absenceCase).toEqual(scenarioAAbsence);

    expect(candidates.map((candidate) => candidate.name)).toEqual([
      "Alex Johnson",
      "Maria Patel",
      "David Kim",
    ]);
  });

  it("returns defensive copies instead of mutable authoritative references", async () => {
    const store = createStore();

    const candidate = await store.getCandidate(
      "candidate-alex-johnson",
    );

    if (!candidate) {
      throw new Error("Expected Alex Johnson to exist");
    }

    const mutablePeriods =
      candidate.availablePeriods as PeriodId[];

    mutablePeriods.pop();

    expect(candidate.availablePeriods).toEqual([
      "P1",
      "P2",
      "P4",
    ]);

    const authoritativeCandidate =
      await store.getCandidate(
        "candidate-alex-johnson",
      );

    expect(authoritativeCandidate?.availablePeriods).toEqual([
      "P1",
      "P2",
      "P4",
      "P6",
    ]);
  });

  it("persists and queries coverage offers by case", async () => {
    const store = createStore();

    const offer: CoverageOffer = {
      id: "offer-scenario-a-alex",
      caseId: scenarioAAbsence.id,
      candidateId: "candidate-alex-johnson",
      periodIds: ["P1", "P2", "P4", "P6"],
      status: "pending",
      createdAt: "2026-09-14T05:55:00.000Z",
      expiresAt: "2026-09-14T06:15:00.000Z",
    };

    await store.putOffer(offer);

    expect(
      await store.getOffer(offer.id),
    ).toEqual(offer);

    expect(
      await store.listOffersByCase(
        scenarioAAbsence.id,
      ),
    ).toEqual([offer]);
  });

  it("supports assignment queries by both case and candidate", async () => {
    const store = createStore();

    const assignment: CoverageAssignment = {
      id: "assignment-scenario-a",
      caseId: scenarioAAbsence.id,
      candidateId: "candidate-alex-johnson",
      periodIds: ["P1", "P2"],
      source: "accepted_offer",
      offerId: "offer-scenario-a-alex",
      createdAt: "2026-09-14T06:00:00.000Z",
    };

    await store.putAssignment(assignment);

    expect(
      await store.listAssignmentsByCase(
        scenarioAAbsence.id,
      ),
    ).toEqual([assignment]);

    expect(
      await store.listAssignmentsByCandidate(
        "candidate-alex-johnson",
      ),
    ).toEqual([assignment]);
  });

  it("keeps activity event insertion idempotent by event ID", async () => {
    const store = createStore();

    const event: ActivityEvent = {
      eventId: "event-offer-created",
      caseId: scenarioAAbsence.id,
      timestamp: "2026-09-14T05:55:00.000Z",
      actorType: "system",
      action: "coverage_offer_created",
      status: "succeeded",
      summary: "Coverage offer created for Alex Johnson.",
      correlationId: "correlation-scenario-a",
    };

    await store.appendActivity(event);
    await store.appendActivity(event);

    const events = await store.listActivityByCase(
      scenarioAAbsence.id,
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(event);
  });
    it("conditionally creates an offer only once", async () => {
    const store = createStore();

    const offer: CoverageOffer = {
      id: "offer-idempotent",
      caseId: scenarioAAbsence.id,
      candidateId: "candidate-alex-johnson",
      periodIds: ["P1", "P2", "P4", "P6"],
      status: "pending",
      createdAt: "2026-09-14T05:55:00.000Z",
      expiresAt: "2026-09-14T06:15:00.000Z",
    };

    expect(
      await store.putOfferIfAbsent(offer),
    ).toBe(true);

    expect(
      await store.putOfferIfAbsent(offer),
    ).toBe(false);

    expect(
      await store.listOffersByCase(
        scenarioAAbsence.id,
      ),
    ).toHaveLength(1);
  });

    it("conditionally updates an offer only from the expected status", async () => {
    const store = createStore();

    const pendingOffer: CoverageOffer = {
      id: "offer-conditional-response",
      caseId: scenarioAAbsence.id,
      candidateId: "candidate-alex-johnson",
      periodIds: ["P1", "P2", "P4", "P6"],
      status: "pending",
      createdAt: "2026-09-14T05:55:00.000Z",
      expiresAt: "2026-09-14T06:15:00.000Z",
    };

    await store.putOffer(pendingOffer);

    const acceptedOffer: CoverageOffer = {
      ...pendingOffer,
      status: "accepted",
      respondedAt: "2026-09-14T06:00:00.000Z",
    };

    expect(
      await store.updateOfferIfStatus(
        pendingOffer.id,
        "pending",
        acceptedOffer,
      ),
    ).toBe(true);

    expect(
      await store.updateOfferIfStatus(
        pendingOffer.id,
        "pending",
        {
          ...acceptedOffer,
          status: "declined",
        },
      ),
    ).toBe(false);

    expect(
      await store.getOffer(pendingOffer.id),
    ).toEqual(acceptedOffer);
  });

  it("conditionally creates assignments only when case and candidate periods are free", async () => {
    const store = createStore();

    const firstAssignment: CoverageAssignment = {
      id: "assignment-first",
      caseId: scenarioAAbsence.id,
      candidateId: "candidate-alex-johnson",
      periodIds: ["P1"],
      source: "accepted_offer",
      offerId: "offer-first",
      createdAt: "2026-09-14T06:05:00.000Z",
    };

    expect(
      await store.putAssignmentIfPeriodsFree(
        firstAssignment,
      ),
    ).toBe(true);

    const competingCaseAssignment: CoverageAssignment = {
      id: "assignment-competing-case",
      caseId: scenarioAAbsence.id,
      candidateId: "candidate-maria-patel",
      periodIds: ["P1"],
      source: "accepted_offer",
      offerId: "offer-competing-case",
      createdAt: "2026-09-14T06:05:00.000Z",
    };

    expect(
      await store.putAssignmentIfPeriodsFree(
        competingCaseAssignment,
      ),
    ).toBe(false);

    const competingCandidateAssignment: CoverageAssignment = {
      id: "assignment-competing-candidate",
      caseId: "case-different",
      candidateId: "candidate-alex-johnson",
      periodIds: ["P1"],
      source: "accepted_offer",
      offerId: "offer-competing-candidate",
      createdAt: "2026-09-14T06:05:00.000Z",
    };

    expect(
      await store.putAssignmentIfPeriodsFree(
        competingCandidateAssignment,
      ),
    ).toBe(false);

    expect(
      await store.getAssignment(
        firstAssignment.id,
      ),
    ).toEqual(firstAssignment);
  });

    it("conditionally updates a case only from the expected status", async () => {
    const store = createStore();

    const offeringCase = {
      ...scenarioAAbsence,
      status: "offering" as const,
      updatedAt: "2026-09-14T05:56:00.000Z",
    };

    expect(
      await store.updateCaseIfStatus(
        scenarioAAbsence.id,
        "open",
        offeringCase,
      ),
    ).toBe(true);

    const resolvedCase = {
      ...offeringCase,
      status: "resolved" as const,
      updatedAt: "2026-09-14T06:05:00.000Z",
    };

    expect(
      await store.updateCaseIfStatus(
        scenarioAAbsence.id,
        "open",
        resolvedCase,
      ),
    ).toBe(false);

    expect(
      (await store.getCase(
        scenarioAAbsence.id,
      ))?.status,
    ).toBe("offering");
  });

});