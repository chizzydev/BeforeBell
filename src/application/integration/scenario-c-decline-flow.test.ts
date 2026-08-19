import { describe, expect, it } from "vitest";

import {
  assignAcceptedCoverage,
} from "@/application/actions/assign-accepted-coverage";

import {
  createCoverageOffer,
} from "@/application/actions/create-coverage-offer";

import {
  planCoverageCase,
} from "@/application/actions/plan-coverage-case";

import {
  reconcileCoverageCase,
} from "@/application/actions/reconcile-coverage-case";

import {
  respondToCoverageOffer,
} from "@/application/actions/respond-to-coverage-offer";

import { InMemoryBeforeBellStore } from "@/application/store/in-memory-beforebell-store";

import {
  riversideCoveragePolicy,
  scenarioCAbsence,
  scenarioCCandidates,
} from "@/fixtures/riverside";

describe("Scenario C decline fallback flow", () => {
  it("automatically moves to the next safe candidate after a decline without requiring administrator judgment", async () => {
    const store =
      new InMemoryBeforeBellStore({
        policies: [
          riversideCoveragePolicy,
        ],
        cases: [scenarioCAbsence],
        candidates: scenarioCCandidates,
      });

    const correlationId =
      "correlation-scenario-c-e2e";

    /**
     * EVENT 1: absence.created
     */
    const firstPlan =
      await planCoverageCase(
        store,
        {
          caseId:
            scenarioCAbsence.id,
        },
      );

    expect(
      firstPlan.success,
    ).toBe(true);

    const firstProposal =
      firstPlan.data?.plan
        .proposals[0];

    expect(firstProposal).toEqual({
      candidateId:
        "candidate-emma-brooks",
      candidateName:
        "Emma Brooks",
      periodIds: [
        "P1",
        "P3",
        "P6",
      ],
      subjectQualified: true,
    });

    if (!firstProposal) {
      throw new Error(
        "Expected first Scenario C proposal",
      );
    }

    const firstOffer =
      await createCoverageOffer(
        store,
        {
          offerId:
            "offer-scenario-c-emma",
          caseId:
            scenarioCAbsence.id,
          candidateId:
            firstProposal.candidateId,
          periodIds:
            firstProposal.periodIds,
          now: new Date(
            "2026-09-14T06:12:00.000Z",
          ),
          expiresAt: new Date(
            "2026-09-14T06:30:00.000Z",
          ),
          activityEventId:
            "event-scenario-c-emma-offer",
          correlationId,
        },
      );

    expect(firstOffer.code).toBe(
      "offer_created",
    );

    await reconcileCoverageCase(
      store,
      {
        caseId:
          scenarioCAbsence.id,
        now: new Date(
          "2026-09-14T06:12:01.000Z",
        ),
        activityEventId:
          "event-scenario-c-offering",
        correlationId,
      },
    );

    /**
     * EVENT 2: Emma declines.
     */
    const declineResult =
      await respondToCoverageOffer(
        store,
        {
          offerId:
            "offer-scenario-c-emma",
          response: "declined",
          now: new Date(
            "2026-09-14T06:15:00.000Z",
          ),
          activityEventId:
            "event-scenario-c-emma-declined",
          correlationId,
        },
      );

    expect(declineResult.success).toBe(
      true,
    );

    expect(
      declineResult.data?.offer.status,
    ).toBe("declined");

    /**
     * No active offer remains, so authoritative reconciliation returns
     * the case to open before the next event-driven planning attempt.
     */
    const afterDecline =
      await reconcileCoverageCase(
        store,
        {
          caseId:
            scenarioCAbsence.id,
          now: new Date(
            "2026-09-14T06:15:01.000Z",
          ),
          activityEventId:
            "event-scenario-c-after-decline",
          correlationId,
        },
      );

    expect(
      afterDecline.data?.currentStatus,
    ).toBe("open");

    /**
     * EVENT 3: offer.declined
     *
     * Re-plan from authoritative state. Emma's decline is remembered.
     */
    const fallbackPlan =
      await planCoverageCase(
        store,
        {
          caseId:
            scenarioCAbsence.id,
        },
      );

    expect(
      fallbackPlan.success,
    ).toBe(true);

    const fallbackProposal =
      fallbackPlan.data?.plan
        .proposals[0];

    expect(
      fallbackProposal,
    ).toEqual({
      candidateId:
        "candidate-noah-carter",
      candidateName:
        "Noah Carter",
      periodIds: [
        "P1",
        "P3",
        "P6",
      ],
      subjectQualified: true,
    });

    if (!fallbackProposal) {
      throw new Error(
        "Expected fallback Scenario C proposal",
      );
    }

    const fallbackOffer =
      await createCoverageOffer(
        store,
        {
          offerId:
            "offer-scenario-c-noah",
          caseId:
            scenarioCAbsence.id,
          candidateId:
            fallbackProposal.candidateId,
          periodIds:
            fallbackProposal.periodIds,
          now: new Date(
            "2026-09-14T06:16:00.000Z",
          ),
          expiresAt: new Date(
            "2026-09-14T06:35:00.000Z",
          ),
          activityEventId:
            "event-scenario-c-noah-offer",
          correlationId,
        },
      );

    expect(
      fallbackOffer.code,
    ).toBe("offer_created");

    /**
     * Noah accepts.
     */
    const acceptance =
      await respondToCoverageOffer(
        store,
        {
          offerId:
            "offer-scenario-c-noah",
          response: "accepted",
          now: new Date(
            "2026-09-14T06:20:00.000Z",
          ),
          activityEventId:
            "event-scenario-c-noah-accepted",
          correlationId,
        },
      );

    expect(
      acceptance.success,
    ).toBe(true);

    /**
     * Acceptance still does not create an assignment.
     */
    expect(
      await store.listAssignmentsByCase(
        scenarioCAbsence.id,
      ),
    ).toEqual([]);

    const assignment =
      await assignAcceptedCoverage(
        store,
        {
          assignmentId:
            "assignment-scenario-c-noah",
          offerId:
            "offer-scenario-c-noah",
          now: new Date(
            "2026-09-14T06:22:00.000Z",
          ),
          activityEventId:
            "event-scenario-c-assigned",
          correlationId,
        },
      );

    expect(assignment.success).toBe(
      true,
    );

    expect(assignment.code).toBe(
      "assignment_created",
    );

    const resolution =
      await reconcileCoverageCase(
        store,
        {
          caseId:
            scenarioCAbsence.id,
          now: new Date(
            "2026-09-14T06:22:01.000Z",
          ),
          activityEventId:
            "event-scenario-c-resolved",
          correlationId,
        },
      );

    expect(
      resolution.data?.currentStatus,
    ).toBe("resolved");

    expect(
      await store.listDecisionsByCase(
        scenarioCAbsence.id,
      ),
    ).toEqual([]);

    const offers =
      await store.listOffersByCase(
        scenarioCAbsence.id,
      );

    expect(
      offers.map((offer) => ({
        candidateId:
          offer.candidateId,
        status: offer.status,
      })),
    ).toEqual([
      {
        candidateId:
          "candidate-emma-brooks",
        status: "declined",
      },
      {
        candidateId:
          "candidate-noah-carter",
        status: "accepted",
      },
    ]);

    const activity =
      await store.listActivityByCase(
        scenarioCAbsence.id,
      );

    expect(
      activity.map(
        (event) => event.action,
      ),
    ).toEqual([
      "coverage_offer_created",
      "coverage_case_status_updated",
      "coverage_offer_declined",
      "coverage_case_status_updated",
      "coverage_offer_created",
      "coverage_offer_accepted",
      "coverage_assignment_created",
      "coverage_case_status_updated",
    ]);

    expect(
      activity.every(
        (event) =>
          event.correlationId ===
          correlationId,
      ),
    ).toBe(true);
  });
});