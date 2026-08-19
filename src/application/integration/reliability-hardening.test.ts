import { describe, expect, it } from "vitest";

import {
  createCoverageOffer,
} from "@/application/actions/create-coverage-offer";

import {
  planCoverageCase,
} from "@/application/actions/plan-coverage-case";

import {
  buildStableOperationId,
} from "@/application/idempotency";

import {
  runApplicationOperation,
} from "@/application/operation-runner";

import { InMemoryBeforeBellStore } from "@/application/store/in-memory-beforebell-store";

import {
  riversideCoveragePolicy,
  scenarioAAbsence,
  scenarioACandidates,
} from "@/fixtures/riverside";

import type {
  CoverageOffer,
} from "@/domain/types";

function createScenarioAStore() {
  return new InMemoryBeforeBellStore({
    policies: [
      riversideCoveragePolicy,
    ],
    cases: [scenarioAAbsence],
    candidates: scenarioACandidates,
  });
}

class CommitThenThrowOfferStore extends InMemoryBeforeBellStore {
  private failAfterFirstCommit = true;

  override async putOfferIfAbsent(
    offer: CoverageOffer,
  ): Promise<boolean> {
    if (this.failAfterFirstCommit) {
      this.failAfterFirstCommit = false;

      await super.putOfferIfAbsent(
        offer,
      );

      throw new Error(
        "Synthetic connection failure after commit",
      );
    }

    return super.putOfferIfAbsent(
      offer,
    );
  }
}

function createOfferInput(
  offerId: string,
  activityEventId: string,
) {
  return {
    offerId,
    caseId: scenarioAAbsence.id,
    candidateId:
      "candidate-alex-johnson",
    periodIds: [
      "P1",
      "P2",
      "P4",
      "P6",
    ] as const,
    now: new Date(
      "2026-09-14T05:55:00.000Z",
    ),
    expiresAt: new Date(
      "2026-09-14T06:15:00.000Z",
    ),
    activityEventId,
    correlationId:
      "correlation-reliability",
  };
}

describe("BeforeBell reliability hardening", () => {
  it("handles a duplicate absence event without creating a duplicate offer", async () => {
    const store =
      createScenarioAStore();

    const plan =
      await planCoverageCase(
        store,
        {
          caseId:
            scenarioAAbsence.id,
        },
      );

    const proposal =
      plan.data?.plan.proposals[0];

    if (!proposal) {
      throw new Error(
        "Expected Scenario A proposal",
      );
    }

    const logicalEventKey =
      [
        "absence.created",
        scenarioAAbsence.id,
        proposal.candidateId,
        proposal.periodIds.join(","),
      ].join(":");

    const offerId =
      buildStableOperationId(
        "offer",
        logicalEventKey,
      );

    const activityEventId =
      buildStableOperationId(
        "activity",
        logicalEventKey,
      );

    const input = createOfferInput(
      offerId,
      activityEventId,
    );

    const first =
      await runApplicationOperation({
        operationName:
          "create_coverage_offer",
        retryPolicy:
          "safe_same_identity",
        execute: () =>
          createCoverageOffer(
            store,
            input,
          ),
      });

    /**
     * The exact same absence event is delivered again.
     */
    const duplicate =
      await runApplicationOperation({
        operationName:
          "create_coverage_offer",
        retryPolicy:
          "safe_same_identity",
        execute: () =>
          createCoverageOffer(
            store,
            input,
          ),
      });

    expect(first.code).toBe(
      "offer_created",
    );

    expect(duplicate.success).toBe(
      true,
    );

    expect(duplicate.code).toBe(
      "offer_already_created",
    );

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

  it("recovers when an offer committed but the caller received an unexpected failure", async () => {
    const store =
      new CommitThenThrowOfferStore({
        policies: [
          riversideCoveragePolicy,
        ],
        cases: [scenarioAAbsence],
        candidates:
          scenarioACandidates,
      });

    const logicalEventKey =
      "absence.created:case-scenario-a:uncertain-write";

    const offerId =
      buildStableOperationId(
        "offer",
        logicalEventKey,
      );

    const activityEventId =
      buildStableOperationId(
        "activity",
        logicalEventKey,
      );

    const input = createOfferInput(
      offerId,
      activityEventId,
    );

    /**
     * The store commits the offer and then simulates a connection failure.
     * The caller cannot know whether the write happened.
     */
    const uncertainResult =
      await runApplicationOperation({
        operationName:
          "create_coverage_offer",
        retryPolicy:
          "safe_same_identity",
        execute: () =>
          createCoverageOffer(
            store,
            input,
          ),
      });

    expect(
      uncertainResult.success,
    ).toBe(false);

    expect(
      uncertainResult.code,
    ).toBe(
      "unexpected_failure_retryable",
    );

    expect(
      uncertainResult.retryable,
    ).toBe(true);

    /**
     * Retry with EXACTLY the same operation identity.
     */
    const retry =
      await runApplicationOperation({
        operationName:
          "create_coverage_offer",
        retryPolicy:
          "safe_same_identity",
        execute: () =>
          createCoverageOffer(
            store,
            input,
          ),
      });

    expect(retry.success).toBe(
      true,
    );

    expect(retry.code).toBe(
      "offer_already_created",
    );

    expect(
      retry.data?.idempotentReplay,
    ).toBe(true);

    /**
     * There is still exactly one authoritative offer.
     */
    expect(
      await store.listOffersByCase(
        scenarioAAbsence.id,
      ),
    ).toHaveLength(1);

    /**
     * The replay also backfills the activity evidence that the first
     * interrupted invocation never reached.
     */
    const activity =
      await store.listActivityByCase(
        scenarioAAbsence.id,
      );

    expect(activity).toHaveLength(1);

    expect(activity[0]?.action).toBe(
      "coverage_offer_created",
    );
  });
});