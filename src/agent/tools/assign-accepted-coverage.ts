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
  assignAcceptedCoverage,
} from "@/application/actions/assign-accepted-coverage";

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
  CoverageAssignment,
} from "@/domain/types";

export interface AssignAcceptedCoverageToolOptions {
  now?: () => Date;
}

interface AssignAcceptedCoverageToolData {
  assignment: CoverageAssignment;
  idempotentReplay: boolean;
  caseStatus: AbsenceCaseStatus;
  caseStatusChanged: boolean;
}

export function createAssignAcceptedCoverageTool(
  store: BeforeBellStore,
  options: AssignAcceptedCoverageToolOptions = {},
) {
  const getNow =
    options.now ?? (() => new Date());

  return tool({
    name: "assign_accepted_coverage",

    description:
      "Create a real BeforeBell coverage assignment from an authoritative accepted offer. The application layer performs final availability, conflict, capacity, offer-expiry, case-period, and duplicate-assignment revalidation before committing anything. The tool owns assignment identity and reconciles case status after a successful assignment. Never use this for a pending, declined, expired, or cancelled offer.",

    inputSchema: z.object({
      caseId: z
        .string()
        .min(1)
        .describe(
          "The authoritative BeforeBell coverage case ID.",
        ),

      offerId: z
        .string()
        .min(1)
        .describe(
          "The exact authoritative accepted coverage offer ID returned by BeforeBell state.",
        ),
    }),

    callback: async ({
      caseId,
      offerId,
    }) => {
      /**
       * Bind the model's request to authoritative offer state before
       * constructing any mutation identity.
       */
      const offer =
        await store.getOffer(
          offerId,
        );

      if (!offer) {
        return {
          success: false,
          code: "offer_not_found",
          message:
            "Coverage offer was not found.",
          retryable: false,
        };
      }

      if (
        offer.caseId !== caseId
      ) {
        return {
          success: false,
          code:
            "offer_case_mismatch",
          message:
            "The requested offer does not belong to the requested coverage case.",
          retryable: false,
        };
      }

      /**
       * The assignment ID is deterministic and derived from the authoritative
       * accepted offer. The model cannot invent or choose assignment IDs.
       */
      const operationKey =
        [
          "accepted-coverage-assignment",
          caseId,
          offer.id,
        ].join(":");

      const assignmentId =
        buildStableOperationId(
          "assignment",
          operationKey,
        );

      const assignmentActivityEventId =
        buildStableOperationId(
          "activity",
          `${operationKey}:assignment`,
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

      return runApplicationOperation({
        operationName:
          "assign_accepted_coverage",

        retryPolicy:
          "safe_same_identity",

        execute: async (): Promise<
          ActionResult<AssignAcceptedCoverageToolData>
        > => {
          /**
           * This application action reloads authoritative state and performs
           * the final safety gate. The agent does not perform eligibility
           * checks itself.
           */
          const assignmentResult =
            await assignAcceptedCoverage(
              store,
              {
                assignmentId,
                offerId:
                  offer.id,
                now,
                activityEventId:
                  assignmentActivityEventId,
                correlationId,
              },
            );

          if (
            !assignmentResult.success ||
            !assignmentResult.data
          ) {
            return {
              success: false,
              code:
                assignmentResult.code,
              message:
                assignmentResult.message,
              retryable:
                assignmentResult.retryable,
            };
          }

          /**
           * Case resolution is derived only after the authoritative
           * assignment exists.
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
                "assignment_created_case_reconciliation_failed",
              message:
                `The coverage assignment exists, but case-status reconciliation did not complete: ${reconciliationResult.message}`,
              retryable:
                reconciliationResult.retryable,
            };
          }

          return {
            success: true,
            code:
              assignmentResult.code,
            message:
              `${assignmentResult.message} Case operational status is ${reconciliationResult.data.currentStatus}.`,
            retryable: false,
            data: {
              assignment:
                assignmentResult.data.assignment,

              idempotentReplay:
                assignmentResult.data.idempotentReplay,

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