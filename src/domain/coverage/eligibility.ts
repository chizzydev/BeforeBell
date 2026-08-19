import {
  candidateAlreadyAssignedForPeriod,
  candidateHasConflictForPeriod,
  candidateIsAvailableForPeriod,
  periodIsProtectedPlanning,
} from "@/domain/coverage/invariants";

import type {
  AbsenceCase,
  CoverageAssignment,
  CoverageCandidate,
  CoveragePolicy,
  PeriodId,
} from "@/domain/types";

export type CandidateExclusionCode =
  | "candidate_inactive"
  | "candidate_unavailable"
  | "candidate_conflict"
  | "already_assigned"
  | "protected_planning_requires_approval";

export interface CandidatePeriodEvaluation {
  periodId: PeriodId;
  automaticallyEligible: boolean;
  exclusionCodes: readonly CandidateExclusionCode[];
}

export interface CandidateEvaluation {
  candidateId: string;
  candidateName: string;

  subjectQualified: boolean;

  requestedPeriodCount: number;

  /**
   * Periods that pass all period-specific automatic-coverage rules.
   *
   * Daily capacity is represented separately because it is a candidate-wide
   * constraint rather than a property of one specific period.
   */
  safePeriods: readonly PeriodId[];

  periodEvaluations: readonly CandidatePeriodEvaluation[];

  remainingDailyCapacity: number;

  /**
   * Maximum number of requested periods this candidate can actually accept
   * without violating the configured daily maximum.
   */
  automaticallyCoverablePeriodCount: number;

  canCoverEntireAbsence: boolean;
}

export interface EvaluateCandidateInput {
  candidate: CoverageCandidate;
  absence: AbsenceCase;
  policy: CoveragePolicy;
  existingAssignments: readonly CoverageAssignment[];
}

export interface RankCandidatesInput {
  candidates: readonly CoverageCandidate[];
  absence: AbsenceCase;
  policy: CoveragePolicy;
  existingAssignments: readonly CoverageAssignment[];
}

export function evaluateCoverageCandidate({
  candidate,
  absence,
  policy,
  existingAssignments,
}: EvaluateCandidateInput): CandidateEvaluation {
  const periodEvaluations = absence.affectedPeriods.map(
    (periodId): CandidatePeriodEvaluation => {
      const exclusionCodes: CandidateExclusionCode[] = [];

      if (!candidate.active) {
        exclusionCodes.push("candidate_inactive");
      }

      if (!candidateIsAvailableForPeriod(candidate, periodId)) {
        exclusionCodes.push("candidate_unavailable");
      }

      if (candidateHasConflictForPeriod(candidate, periodId)) {
        exclusionCodes.push("candidate_conflict");
      }

      if (
        policy.protectedPlanningRequiresApproval &&
        periodIsProtectedPlanning(candidate, periodId)
      ) {
        exclusionCodes.push("protected_planning_requires_approval");
      }

      if (
        candidateAlreadyAssignedForPeriod(
          existingAssignments,
          candidate.id,
          periodId,
        )
      ) {
        exclusionCodes.push("already_assigned");
      }

      return {
        periodId,
        automaticallyEligible: exclusionCodes.length === 0,
        exclusionCodes,
      };
    },
  );

  const safePeriods = periodEvaluations
    .filter((evaluation) => evaluation.automaticallyEligible)
    .map((evaluation) => evaluation.periodId);

  const remainingDailyCapacity = Math.max(
    0,
    policy.maxDailyCoveragePeriods - candidate.dailyCoverageCount,
  );

  const automaticallyCoverablePeriodCount = Math.min(
    safePeriods.length,
    remainingDailyCapacity,
  );

  const subjectQualified = candidate.qualifiedSubjects.includes(
    absence.subject,
  );

  const canCoverEntireAbsence =
    candidate.active &&
    safePeriods.length === absence.affectedPeriods.length &&
    automaticallyCoverablePeriodCount === absence.affectedPeriods.length;

  return {
    candidateId: candidate.id,
    candidateName: candidate.name,
    subjectQualified,
    requestedPeriodCount: absence.affectedPeriods.length,
    safePeriods,
    periodEvaluations,
    remainingDailyCapacity,
    automaticallyCoverablePeriodCount,
    canCoverEntireAbsence,
  };
}

export function rankCoverageCandidates({
  candidates,
  absence,
  policy,
  existingAssignments,
}: RankCandidatesInput): CandidateEvaluation[] {
  const subjectPreferenceApplies =
    policy.preferSubjectQualifiedFor.includes(absence.subject);

  return candidates
    .map((candidate) =>
      evaluateCoverageCandidate({
        candidate,
        absence,
        policy,
        existingAssignments,
      }),
    )
    .filter(
      (evaluation) => evaluation.automaticallyCoverablePeriodCount > 0,
    )
    .sort((left, right) => {
      if (
        policy.preferSingleCandidate &&
        left.canCoverEntireAbsence !== right.canCoverEntireAbsence
      ) {
        return left.canCoverEntireAbsence ? -1 : 1;
      }

      if (
        subjectPreferenceApplies &&
        left.subjectQualified !== right.subjectQualified
      ) {
        return left.subjectQualified ? -1 : 1;
      }

      if (
        left.automaticallyCoverablePeriodCount !==
        right.automaticallyCoverablePeriodCount
      ) {
        return (
          right.automaticallyCoverablePeriodCount -
          left.automaticallyCoverablePeriodCount
        );
      }

      if (left.remainingDailyCapacity !== right.remainingDailyCapacity) {
        return right.remainingDailyCapacity - left.remainingDailyCapacity;
      }

      if (left.candidateName < right.candidateName) {
        return -1;
      }

      if (left.candidateName > right.candidateName) {
        return 1;
      }

      return 0;
    });
}