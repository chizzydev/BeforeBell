import {
  tool,
} from "@strands-agents/sdk";

import {
  z,
} from "zod";

import type {
  BeforeBellStore,
} from "@/application/store/beforebell-store";

export function createGetCoveragePolicyTool(
  store: BeforeBellStore,
) {
  return tool({
    name: "get_coverage_policy",

    description:
      "Load the authoritative school coverage policy. Policy is deterministic application state. Do not invent, weaken, override, or reinterpret policy rules.",

    inputSchema: z.object({
      schoolId: z
        .string()
        .min(1)
        .describe(
          "The school ID obtained from the authoritative absence case.",
        ),
    }),

    callback: async ({ schoolId }) => {
      const policy =
        await store.getPolicy(schoolId);

      if (!policy) {
        return {
          success: false,
          code:
            "coverage_policy_not_found",
          message:
            "Coverage policy was not found.",
          retryable: false,
        };
      }

      return {
        success: true,
        code:
          "coverage_policy_loaded",
        message:
          "Authoritative coverage policy loaded.",
        retryable: false,
        data: {
          schoolId:
            policy.schoolId,
          maxDailyCoveragePeriods:
            policy.maxDailyCoveragePeriods,
          preferSubjectQualifiedFor: [
            ...policy.preferSubjectQualifiedFor,
          ],
          preferSingleCandidate:
            policy.preferSingleCandidate,
          requireCandidateAcceptance:
            policy.requireCandidateAcceptance,
          protectedPlanningRequiresApproval:
            policy.protectedPlanningRequiresApproval,
          externalSubstituteRequiresApproval:
            policy.externalSubstituteRequiresApproval,
          combineGroupsRequiresApproval:
            policy.combineGroupsRequiresApproval,
        },
      };
    },
  });
}