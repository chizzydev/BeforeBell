import {
  candidateAlreadyAssignedForPeriod,
  candidateCanTakeAdditionalPeriods,
  candidateHasConflictForPeriod,
  candidateIsAvailableForPeriod,
  periodIsProtectedPlanning,
} from "@/domain/coverage/invariants";

import type {
  CoverageAssignment,
  CoverageCandidate,
  CoveragePolicy,
  HumanDecisionKind,
  PeriodId,
} from "@/domain/types";

export interface CoverageExceptionOption {
  kind: HumanDecisionKind;
  periodIds: readonly PeriodId[];

  /**
   * Present when the exception involves a specific internal candidate.
   */
  candidateId?: string;
  candidateName?: string;

  /**
   * Every option produced by this module requires human judgment.
   */
  requiresAdministratorApproval: true;

  summary: string;
}

export interface BuildExceptionOptionsInput {
  unresolvedPeriodIds: readonly PeriodId[];
  candidates: readonly CoverageCandidate[];
  policy: CoveragePolicy;
  existingAssignments: readonly CoverageAssignment[];
}

function candidateCanBeConsideredForProtectedPlanning(
  candidate: CoverageCandidate,
  periodId: PeriodId,
  policy: CoveragePolicy,
  existingAssignments: readonly CoverageAssignment[],
): boolean {
  if (!candidate.active) {
    return false;
  }

  if (!candidateIsAvailableForPeriod(candidate, periodId)) {
    return false;
  }

  if (!periodIsProtectedPlanning(candidate, periodId)) {
    return false;
  }

  if (candidateHasConflictForPeriod(candidate, periodId)) {
    return false;
  }

  if (
    candidateAlreadyAssignedForPeriod(
      existingAssignments,
      candidate.id,
      periodId,
    )
  ) {
    return false;
  }

  if (
    !candidateCanTakeAdditionalPeriods(
      candidate,
      1,
      policy.maxDailyCoveragePeriods,
    )
  ) {
    return false;
  }

  return true;
}

/**
 * Returns exception choices that may be presented to an administrator.
 *
 * This function does not approve, execute, assign, notify, or mutate anything.
 */
export function buildCoverageExceptionOptions({
  unresolvedPeriodIds,
  candidates,
  policy,
  existingAssignments,
}: BuildExceptionOptionsInput): CoverageExceptionOption[] {
  const options: CoverageExceptionOption[] = [];

  for (const periodId of unresolvedPeriodIds) {
    if (policy.protectedPlanningRequiresApproval) {
      for (const candidate of candidates) {
        if (
          candidateCanBeConsideredForProtectedPlanning(
            candidate,
            periodId,
            policy,
            existingAssignments,
          )
        ) {
          options.push({
            kind: "use_protected_planning_period",
            periodIds: [periodId],
            candidateId: candidate.id,
            candidateName: candidate.name,
            requiresAdministratorApproval: true,
            summary: `Use ${candidate.name}'s protected planning period for ${periodId}.`,
          });
        }
      }
    }

    if (policy.externalSubstituteRequiresApproval) {
      options.push({
        kind: "request_external_substitute",
        periodIds: [periodId],
        requiresAdministratorApproval: true,
        summary: `Request an external substitute for ${periodId}.`,
      });
    }

    if (policy.combineGroupsRequiresApproval) {
      options.push({
        kind: "combine_coverage_groups",
        periodIds: [periodId],
        requiresAdministratorApproval: true,
        summary: `Combine coverage groups for ${periodId}.`,
      });
    }
  }

  return options;
}