import {
  tool,
} from "@strands-agents/sdk";

import {
  z,
} from "zod";

import type {
  ActionResult,
} from "@/application/action-result";

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
  buildStableOperationId,
} from "@/application/idempotency";

import {
  runApplicationOperation,
} from "@/application/operation-runner";

import type {
  BeforeBellStore,
} from "@/application/store/beforebell-store";

import type {
  AbsenceCaseStatus,
  CoverageOffer,
  PeriodId,
} from "@/domain/types";

const periodIdSchema = z.enum([
  "P1",
  "P2",
  "P3",
  "P4",
  "P5",
  "P6",
  "P7",
  "P8",
]);

export interface CreateCoverageOfferToolOptions {
  now?: () => Date;
  offerTtlMinutes?: number;
}

interface CreateCoverageOfferToolData {
  offer: CoverageOffer;
  idempotentReplay: boolean;
  caseStatus: AbsenceCaseStatus;
  caseStatusChanged: boolean;
}

function samePeriodSet(
  left: readonly PeriodId[],
  right: readonly PeriodId[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const leftPeriods =
    new Set(left);

  return right.every(
    (periodId) =>
      leftPeriods.has(periodId),
  );
}

function buildOfferOperationKey(
  caseId: string,
  candidateId: string,
  periodIds: readonly PeriodId[],
): string {
  const canonicalPeriods = [
    ...periodIds,
  ].sort();

  return [
    "coverage-offer",
    caseId,
    candidateId,
    canonicalPeriods.join(","),
  ].join(":");
}

export function createCoverageOfferTool(
  store: BeforeBellStore,
  options: CreateCoverageOfferToolOptions = {},
) {
  const getNow =
    options.now ?? (() => new Date());

  const offerTtlMinutes =
    options.offerTtlMinutes ?? 20;

  if (
    !Number.isFinite(
      offerTtlMinutes,
    ) ||
    offerTtlMinutes <= 0
  ) {
    throw new Error(
      "Offer TTL must be a positive number of minutes.",
    );
  }

  return tool({
    name: "create_coverage_offer",

    description:
      "Create a real pending BeforeBell coverage offer only when the requested candidate and periods exactly match a current deterministic planner proposal. The tool re-plans, revalidates authoritative state, creates the offer idempotently, and reconciles the case operational status. It does not assign coverage, notify a candidate, approve an exception, or resolve coverage without authoritative assignments.",

    inputSchema: z.object({
      caseId: z
        .string()
        .min(1)
        .describe(
          "The authoritative BeforeBell coverage case ID.",
        ),

      candidateId: z
        .string()
        .min(1)
        .describe(
          "The exact candidate ID from an authoritative planner proposal.",
        ),

      periodIds: z
        .array(periodIdSchema)
        .min(1)
        .describe(
          "The exact periods from the authoritative planner proposal.",
        ),
    }),

    callback: async ({
      caseId,
      candidateId,
      periodIds,
    }) => {
      /**
       * Never trust the model's candidate choice merely because it supplied
       * a syntactically valid candidate ID.
       *
       * Reload authoritative planning state immediately before mutation.
       */
      const planningResult =
        await planCoverageCase(
          store,
          {
            caseId,
          },
        );

      if (
        !planningResult.success ||
        !planningResult.data
      ) {
        return {
          success: false,
          code:
            planningResult.code,
          message:
            planningResult.message,
          retryable:
            planningResult.retryable,
        };
      }

      const authoritativeProposal =
        planningResult.data.plan
          .proposals.find(
            (proposal) =>
              proposal.candidateId ===
                candidateId &&
              samePeriodSet(
                proposal.periodIds,
                periodIds,
              ),
          );

      if (!authoritativeProposal) {
        return {
          success: false,
          code:
            "proposal_not_authoritative",
          message:
            "The requested candidate and periods do not exactly match a current deterministic planner proposal. No offer was created.",
          retryable: false,
        };
      }

      /**
       * IDs come from the authoritative proposal rather than model-generated
       * values.
       */
      const operationKey =
        buildOfferOperationKey(
          caseId,
          authoritativeProposal.candidateId,
          authoritativeProposal.periodIds,
        );

      const offerId =
        buildStableOperationId(
          "offer",
          operationKey,
        );

      const offerActivityEventId =
        buildStableOperationId(
          "activity",
          operationKey,
        );

      const reconciliationActivityEventId =
        buildStableOperationId(
          "activity",
          `${operationKey}:case-reconciliation`,
        );

      const correlationId =
        buildStableOperationId(
          "correlation",
          caseId,
        );

      const now = getNow();

      /**
       * If this logical operation already committed, reuse its authoritative
       * expiry so a later retry remains the exact same idempotent request.
       */
      const existingOffer =
        await store.getOffer(
          offerId,
        );

      const expiresAt =
        existingOffer
          ? new Date(
              existingOffer.expiresAt,
            )
          : new Date(
              now.getTime() +
                offerTtlMinutes *
                  60_000,
            );

      return runApplicationOperation({
        operationName:
          "create_coverage_offer",

        retryPolicy:
          "safe_same_identity",

        execute: async (): Promise<
          ActionResult<CreateCoverageOfferToolData>
        > => {
          const offerResult =
            await createCoverageOffer(
              store,
              {
                offerId,

                caseId,

                candidateId:
                  authoritativeProposal.candidateId,

                periodIds:
                  authoritativeProposal.periodIds,

                now,
                expiresAt,

                activityEventId:
                  offerActivityEventId,

                correlationId,

                actorType: "agent",
              },
            );

          if (
            !offerResult.success ||
            !offerResult.data
          ) {
            return {
              success: false,
              code:
                offerResult.code,
              message:
                offerResult.message,
              retryable:
                offerResult.retryable,
            };
          }

          /**
           * Offer persistence and case status are deliberately separate
           * application operations.
           *
           * Reconciliation derives the case state from authoritative offers,
           * assignments, and human decisions rather than trusting the model.
           */
          const reconciliationResult =
            await reconcileCoverageCase(
              store,
              {
                caseId,

                now,

                activityEventId:
                  reconciliationActivityEventId,

                correlationId,
              },
            );

          if (
            !reconciliationResult.success ||
            !reconciliationResult.data
          ) {
            return {
              success: false,
              code:
                "offer_created_case_reconciliation_failed",
              message:
                `The coverage offer exists, but case-status reconciliation did not complete: ${reconciliationResult.message}`,
              retryable:
                reconciliationResult.retryable,
            };
          }

          return {
            success: true,
            code:
              offerResult.code,
            message:
              `${offerResult.message} Case operational status is ${reconciliationResult.data.currentStatus}.`,
            retryable: false,
            data: {
              offer:
                offerResult.data.offer,

              idempotentReplay:
                offerResult.data.idempotentReplay,

              caseStatus:
                reconciliationResult.data.currentStatus,

              caseStatusChanged:
                reconciliationResult.data.changed,
            },
          };
        },
      });
    },
  });
}