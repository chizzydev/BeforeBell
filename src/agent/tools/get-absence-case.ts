import {
  tool,
} from "@strands-agents/sdk";

import {
  z,
} from "zod";

import type {
  BeforeBellStore,
} from "@/application/store/beforebell-store";

export function createGetAbsenceCaseTool(
  store: BeforeBellStore,
) {
  return tool({
    name: "get_absence_case",

    description:
      "Load the authoritative BeforeBell absence case by case ID. Use this before reasoning about affected periods, subject, school, or case status. Never invent absence facts.",

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

      return {
        success: true,
        code: "case_loaded",
        message:
          "Authoritative absence case loaded.",
        retryable: false,
        data: {
          id: absenceCase.id,
          schoolId:
            absenceCase.schoolId,
          absentStaffMemberId:
            absenceCase.absentStaffMemberId,
          subject:
            absenceCase.subject,
          date:
            absenceCase.date,
          affectedPeriods: [
            ...absenceCase.affectedPeriods,
          ],
          status:
            absenceCase.status,
          createdAt:
            absenceCase.createdAt,
          updatedAt:
            absenceCase.updatedAt,
        },
      };
    },
  });
}