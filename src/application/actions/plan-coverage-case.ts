import type {
  ActionResult,
} from "@/application/action-result";

import type {
  BeforeBellStore,
} from "@/application/store/beforebell-store";

import {
  buildCoveragePlan,
  type CoveragePlan,
} from "@/domain/coverage/planner";

import type {
  CoverageAssignment,
} from "@/domain/types";

export interface PlanCoverageCaseInput {
  caseId: string;
}

export interface PlanCoverageCaseData {
  plan: CoveragePlan;
}

function mergeAssignments(
  ...assignmentGroups: readonly CoverageAssignment[][]
): CoverageAssignment[] {
  const assignmentsById = new Map<
    string,
    CoverageAssignment
  >();

  for (const group of assignmentGroups) {
    for (const assignment of group) {
      assignmentsById.set(
        assignment.id,
        assignment,
      );
    }
  }

  return [...assignmentsById.values()];
}

function countUniqueAssignedPeriods(
  assignments:
    readonly CoverageAssignment[],
): number {
  return new Set(
    assignments.flatMap(
      (assignment) =>
        assignment.periodIds,
    ),
  ).size;
}

export async function planCoverageCase(
  store: BeforeBellStore,
  input: PlanCoverageCaseInput,
): Promise<ActionResult<PlanCoverageCaseData>> {
  const absenceCase = await store.getCase(
    input.caseId,
  );

  if (!absenceCase) {
    return {
      success: false,
      code: "case_not_found",
      message: "Coverage case was not found.",
      retryable: false,
    };
  }

  if (
    absenceCase.status === "resolved" ||
    absenceCase.status === "closed"
  ) {
    return {
      success: false,
      code: "case_not_actionable",
      message: `Coverage planning cannot run for a case in status "${absenceCase.status}".`,
      retryable: false,
    };
  }

  const policy = await store.getPolicy(
    absenceCase.schoolId,
  );

  if (!policy) {
    return {
      success: false,
      code: "coverage_policy_not_found",
      message:
        "The school's coverage policy was not found.",
      retryable: false,
    };
  }

  const [
    allCandidates,
    caseAssignments,
    caseOffers,
  ] = await Promise.all([
    store.listCandidatesBySchool(
      absenceCase.schoolId,
    ),
    store.listAssignmentsByCase(
      absenceCase.id,
    ),
    store.listOffersByCase(
      absenceCase.id,
    ),
  ]);

  /**
   * A candidate who already declined this coverage case should not be
   * immediately asked again by the automatic fallback workflow.
   *
   * This is application behavior for the synthetic BeforeBell demo,
   * not a claim about universal school policy.
   */
  const declinedCandidateIds = new Set(
    caseOffers
      .filter(
        (offer) =>
          offer.status === "declined",
      )
      .map(
        (offer) =>
          offer.candidateId,
      ),
  );

  const candidates =
    allCandidates.filter(
      (candidate) =>
        !declinedCandidateIds.has(
          candidate.id,
        ),
    );

 const candidateAssignmentGroups =
  await Promise.all(
    candidates.map(
      (candidate) =>
        store.listAssignmentsByCandidate(
          candidate.id,
          absenceCase.date,
        ),
    ),
  );

  const candidatesWithAuthoritativeLoad =
  candidates.map(
    (
      candidate,
      index,
    ) => ({
      ...candidate,

      dailyCoverageCount:
        candidate.dailyCoverageCount +
        countUniqueAssignedPeriods(
          candidateAssignmentGroups[
            index
          ] ?? [],
        ),
    }),
  );

  const existingAssignments =
    mergeAssignments(
      caseAssignments,
      ...candidateAssignmentGroups,
    );

  const plan = buildCoveragePlan({
  absence:
    absenceCase,

  candidates:
    candidatesWithAuthoritativeLoad,

  policy,

  existingAssignments,
});

  return {
    success: true,
    code: "coverage_plan_built",
    message:
      "Coverage plan was built from authoritative operational state.",
    retryable: false,
    data: {
      plan,
    },
  };
}