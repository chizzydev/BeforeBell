import {
  tool,
} from "@strands-agents/sdk";

import {
  z,
} from "zod";

import type {
  BeforeBellStore,
} from "@/application/store/beforebell-store";

import type {
  PeriodId,
} from "@/domain/types";

function uniquePeriodIds(
  periodIds: readonly PeriodId[],
): PeriodId[] {
  return [...new Set(periodIds)];
}

export function createGetCaseStatusTool(
  store: BeforeBellStore,
) {
  return tool({
    name: "get_case_status",

    description:
      "Inspect authoritative operational evidence for a BeforeBell coverage case, including assignments, offers, decisions, covered periods, and uncovered periods. This tool is read-only and does not reconcile or mutate the case.",

    inputSchema: z.object({
      caseId: z
        .string()
        .min(1)
        .describe(
          "The authoritative BeforeBell coverage case ID.",
        ),
    }),

    callback: async ({ caseId }) => {
      const absenceCase =
        await store.getCase(caseId);

      if (!absenceCase) {
        return {
          success: false,
          code: "case_not_found",
          message:
            "Coverage case was not found.",
          retryable: false,
        };
      }

      const [
        assignments,
        offers,
        decisions,
      ] = await Promise.all([
        store.listAssignmentsByCase(
          caseId,
        ),
        store.listOffersByCase(
          caseId,
        ),
        store.listDecisionsByCase(
          caseId,
        ),
      ]);

      const coveredPeriodIds =
        uniquePeriodIds(
          assignments.flatMap(
            (assignment) =>
              assignment.periodIds,
          ),
        );

      const coveredPeriods =
        new Set<PeriodId>(
          coveredPeriodIds,
        );

      const uncoveredPeriodIds =
        absenceCase.affectedPeriods.filter(
          (periodId) =>
            !coveredPeriods.has(
              periodId,
            ),
        );

      return {
        success: true,
        code:
          "case_status_loaded",
        message:
          "Authoritative case operational status loaded.",
        retryable: false,
        data: {
          caseId:
            absenceCase.id,

          status:
            absenceCase.status,

          affectedPeriodIds: [
            ...absenceCase.affectedPeriods,
          ],

          coveredPeriodIds,

          uncoveredPeriodIds,

          assignmentCount:
            assignments.length,

          assignments:
            assignments.map(
              (assignment) => ({
                id:
                  assignment.id,

                candidateId:
                  assignment.candidateId,

                periodIds: [
                  ...assignment.periodIds,
                ],

                source:
                  assignment.source,

                offerId:
                  assignment.offerId ??
                  null,

                decisionId:
                  assignment.decisionId ??
                  null,

                createdAt:
                  assignment.createdAt,
              }),
            ),

          offers:
            offers.map(
              (offer) => ({
                id:
                  offer.id,

                candidateId:
                  offer.candidateId,

                periodIds: [
                  ...offer.periodIds,
                ],

                status:
                  offer.status,

                createdAt:
                  offer.createdAt,

                expiresAt:
                  offer.expiresAt,

                respondedAt:
                  offer.respondedAt ??
                  null,
              }),
            ),

          decisions:
            decisions.map(
              (decision) => ({
                id:
                  decision.id,

                kind:
                  decision.kind,

                status:
                  decision.status,

                periodIds: [
                  ...decision.periodIds,
                ],

                summary:
                  decision.summary,

                requestedAt:
                  decision.requestedAt,

                decidedAt:
                  decision.decidedAt ??
                  null,

                decidedBy:
                  decision.decidedBy ??
                  null,
              }),
            ),
        },
      };
    },
  });
}