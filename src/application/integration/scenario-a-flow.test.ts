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
  scenarioAAbsence,
  scenarioACandidates,
} from "@/fixtures/riverside";

describe("Scenario A application flow", () => {
  it("resolves Sarah Miller's 4/4 absence through planning, offer, acceptance, revalidation, assignment, and reconciliation", async () => {
    const store =
      new InMemoryBeforeBellStore({
        policies: [
          riversideCoveragePolicy,
        ],
        cases: [scenarioAAbsence],
        candidates: scenarioACandidates,
      });

    const correlationId =
      "correlation-scenario-a-e2e";

    /**
     * EVENT 1: absence.created
     *
     * Reload authoritative state and build the deterministic plan.
     */
    const planResult =
      await planCoverageCase(
        store,
        {
          caseId:
            scenarioAAbsence.id,
        },
      );

    expect(planResult.success).toBe(
      true,
    );

    const proposal =
      planResult.data?.plan
        .proposals[0];

    expect(proposal).toEqual({
      candidateId:
        "candidate-alex-johnson",
      candidateName:
        "Alex Johnson",
      periodIds: [
        "P1",
        "P2",
        "P4",
        "P6",
      ],
      subjectQualified: true,
    });

    if (!proposal) {
      throw new Error(
        "Expected Scenario A coverage proposal",
      );
    }

    /**
     * The proposed work still goes through the authoritative
     * create-offer validation gate.
     */
    const offerResult =
      await createCoverageOffer(
        store,
        {
          offerId:
            "offer-scenario-a-e2e",
          caseId:
            scenarioAAbsence.id,
          candidateId:
            proposal.candidateId,
          periodIds:
            proposal.periodIds,
          now: new Date(
            "2026-09-14T05:55:00.000Z",
          ),
          expiresAt: new Date(
            "2026-09-14T06:15:00.000Z",
          ),
          activityEventId:
            "event-scenario-a-offer-created",
          correlationId,
        },
      );

    expect(offerResult.success).toBe(
      true,
    );

    expect(offerResult.code).toBe(
      "offer_created",
    );

    /**
     * Reconciliation reflects the real active offer.
     */
    const offeringReconciliation =
      await reconcileCoverageCase(
        store,
        {
          caseId:
            scenarioAAbsence.id,
          now: new Date(
            "2026-09-14T05:55:01.000Z",
          ),
          activityEventId:
            "event-scenario-a-offering",
          correlationId,
        },
      );

    expect(
      offeringReconciliation.data
        ?.currentStatus,
    ).toBe("offering");

    /**
     * EVENT 2: candidate response arrives later.
     */
    const acceptanceResult =
      await respondToCoverageOffer(
        store,
        {
          offerId:
            "offer-scenario-a-e2e",
          response: "accepted",
          now: new Date(
            "2026-09-14T06:00:00.000Z",
          ),
          activityEventId:
            "event-scenario-a-accepted",
          correlationId,
        },
      );

    expect(
      acceptanceResult.success,
    ).toBe(true);

    expect(
      acceptanceResult.data?.offer
        .status,
    ).toBe("accepted");

    /**
     * Acceptance alone MUST NOT create coverage.
     */
    expect(
      await store.listAssignmentsByCase(
        scenarioAAbsence.id,
      ),
    ).toEqual([]);

    expect(
      (
        await store.getCase(
          scenarioAAbsence.id,
        )
      )?.status,
    ).toBe("offering");

    /**
     * EVENT 3: offer.accepted
     *
     * Assignment reloads and revalidates authoritative state.
     */
    const assignmentResult =
      await assignAcceptedCoverage(
        store,
        {
          assignmentId:
            "assignment-scenario-a-e2e",
          offerId:
            "offer-scenario-a-e2e",
          now: new Date(
            "2026-09-14T06:05:00.000Z",
          ),
          activityEventId:
            "event-scenario-a-assigned",
          correlationId,
        },
      );

    expect(
      assignmentResult.success,
    ).toBe(true);

    expect(
      assignmentResult.code,
    ).toBe("assignment_created");

    /**
     * Only now does authoritative assignment state contain 4/4.
     */
    const assignments =
      await store.listAssignmentsByCase(
        scenarioAAbsence.id,
      );

    expect(assignments).toHaveLength(1);

    expect(
      assignments[0]?.periodIds,
    ).toEqual([
      "P1",
      "P2",
      "P4",
      "P6",
    ]);

    /**
     * Final reconciliation derives resolved from actual assignment state.
     */
    const resolvedReconciliation =
      await reconcileCoverageCase(
        store,
        {
          caseId:
            scenarioAAbsence.id,
          now: new Date(
            "2026-09-14T06:05:01.000Z",
          ),
          activityEventId:
            "event-scenario-a-resolved",
          correlationId,
        },
      );

    expect(
      resolvedReconciliation.success,
    ).toBe(true);

    expect(
      resolvedReconciliation.data
        ?.currentStatus,
    ).toBe("resolved");

    const resolvedCase =
      await store.getCase(
        scenarioAAbsence.id,
      );

    expect(
      resolvedCase?.status,
    ).toBe("resolved");

    /**
     * Operational evidence suitable for the future UI.
     * These are actions/evidence, not hidden model reasoning.
     */
    const activity =
      await store.listActivityByCase(
        scenarioAAbsence.id,
      );

    expect(
      activity.map(
        (event) => event.action,
      ),
    ).toEqual([
      "coverage_offer_created",
      "coverage_case_status_updated",
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