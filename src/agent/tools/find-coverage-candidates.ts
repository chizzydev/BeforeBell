import {
  tool,
} from "@strands-agents/sdk";

import {
  z,
} from "zod";

import {
  planCoverageCase,
} from "@/application/actions/plan-coverage-case";

import type {
  BeforeBellStore,
} from "@/application/store/beforebell-store";

export function createFindCoverageCandidatesTool(
  store: BeforeBellStore,
) {
  return tool({
    name: "find_coverage_candidates",

    description:
      "Run BeforeBell's deterministic coverage planner for a case using authoritative candidates, assignments, policy, availability, conflicts, protected planning, daily capacity, and prior declines. The returned eligibility and ranking are authoritative. Never substitute model judgment for them.",

    inputSchema: z.object({
      caseId: z
        .string()
        .min(1)
        .describe(
          "The authoritative BeforeBell coverage case ID.",
        ),
    }),

    callback: async ({ caseId }) => {
      const result =
        await planCoverageCase(
          store,
          {
            caseId,
          },
        );

      if (
        !result.success ||
        !result.data
      ) {
        return {
          success: false,
          code: result.code,
          message: result.message,
          retryable:
            result.retryable,
        };
      }

      const plan =
        result.data.plan;

      return {
        success: true,
        code:
          "coverage_candidates_evaluated",
        message:
          "Coverage candidates were evaluated by the deterministic BeforeBell planner.",
        retryable: false,
        data: {
          fullyPlanned:
            plan.fullyPlanned,

          proposals:
            plan.proposals.map(
              (proposal) => ({
                candidateId:
                  proposal.candidateId,
                candidateName:
                  proposal.candidateName,
                periodIds: [
                  ...proposal.periodIds,
                ],
                subjectQualified:
                  proposal.subjectQualified,
              }),
            ),

          unresolvedPeriodIds: [
            ...plan.unresolvedPeriodIds,
          ],

          candidateEvaluations:
            plan.candidateEvaluations.map(
              (evaluation) => ({
                candidateId:
                  evaluation.candidateId,

                subjectQualified:
                  evaluation.subjectQualified,

                automaticallyCoverablePeriodCount:
                  evaluation.automaticallyCoverablePeriodCount,

                remainingDailyCapacity:
                  evaluation.remainingDailyCapacity,

                canCoverEntireAbsence:
                  evaluation.canCoverEntireAbsence,

                periodEvaluations:
                  evaluation.periodEvaluations.map(
                    (period) => ({
                      periodId:
                        period.periodId,

                      automaticallyEligible:
                        period.automaticallyEligible,

                      exclusionCodes: [
                        ...period.exclusionCodes,
                      ],
                    }),
                  ),
              }),
            ),
        },
      };
    },
  });
}