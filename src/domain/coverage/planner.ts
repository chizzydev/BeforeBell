import {
  evaluateCoverageCandidate,
  rankCoverageCandidates,
  type CandidateEvaluation,
} from "@/domain/coverage/eligibility";

import {
  caseAlreadyAssignedForPeriod,
} from "@/domain/coverage/invariants";

import type {
  AbsenceCase,
  CoverageAssignment,
  CoverageCandidate,
  CoveragePolicy,
  PeriodId,
} from "@/domain/types";

export interface CoverageProposal {
  candidateId: string;
  candidateName: string;
  periodIds: readonly PeriodId[];
  subjectQualified: boolean;
}

export interface CoveragePlan {
  caseId: string;

  /**
   * Periods from the absence that still required coverage when planning began.
   */
  requestedPeriodIds: readonly PeriodId[];

  /**
   * Deterministic offer proposals.
   *
   * These are NOT CoverageOffer records and have no side effects.
   */
  proposals: readonly CoverageProposal[];

  /**
   * Periods for which no normal policy-safe automatic proposal could be made.
   */
  unresolvedPeriodIds: readonly PeriodId[];

  /**
   * Candidate evaluations retained as operational evidence.
   */
  candidateEvaluations: readonly CandidateEvaluation[];

  fullyPlanned: boolean;
}

export interface BuildCoveragePlanInput {
  absence: AbsenceCase;
  candidates: readonly CoverageCandidate[];
  policy: CoveragePolicy;
  existingAssignments: readonly CoverageAssignment[];
}

function getUncoveredPeriods(
  absence: AbsenceCase,
  existingAssignments: readonly CoverageAssignment[],
): PeriodId[] {
  return absence.affectedPeriods.filter(
    (periodId) =>
      !caseAlreadyAssignedForPeriod(
        existingAssignments,
        absence.id,
        periodId,
      ),
  );
}

function createPlanningAbsence(
  absence: AbsenceCase,
  affectedPeriods: readonly PeriodId[],
): AbsenceCase {
  return {
    ...absence,
    affectedPeriods,
  };
}

export function buildCoveragePlan({
  absence,
  candidates,
  policy,
  existingAssignments,
}: BuildCoveragePlanInput): CoveragePlan {
  const uncoveredPeriods = getUncoveredPeriods(
    absence,
    existingAssignments,
  );

  if (uncoveredPeriods.length === 0) {
    return {
      caseId: absence.id,
      requestedPeriodIds: [],
      proposals: [],
      unresolvedPeriodIds: [],
      candidateEvaluations: [],
      fullyPlanned: true,
    };
  }

  const planningAbsence = createPlanningAbsence(
    absence,
    uncoveredPeriods,
  );

  const candidateEvaluations = candidates.map((candidate) =>
    evaluateCoverageCandidate({
      candidate,
      absence: planningAbsence,
      policy,
      existingAssignments,
    }),
  );

  const rankedCandidates = rankCoverageCandidates({
    candidates,
    absence: planningAbsence,
    policy,
    existingAssignments,
  });

  const completeCandidate = rankedCandidates.find(
    (candidate) => candidate.canCoverEntireAbsence,
  );

  if (completeCandidate) {
    return {
      caseId: absence.id,
      requestedPeriodIds: uncoveredPeriods,
      proposals: [
        {
          candidateId: completeCandidate.candidateId,
          candidateName: completeCandidate.candidateName,
          periodIds: uncoveredPeriods,
          subjectQualified: completeCandidate.subjectQualified,
        },
      ],
      unresolvedPeriodIds: [],
      candidateEvaluations,
      fullyPlanned: true,
    };
  }

  const remainingPeriods = new Set<PeriodId>(uncoveredPeriods);
  const proposals: CoverageProposal[] = [];

  for (const candidate of rankedCandidates) {
    const safeRemainingPeriods = uncoveredPeriods.filter(
      (periodId) =>
        remainingPeriods.has(periodId) &&
        candidate.safePeriods.includes(periodId),
    );

    const selectedPeriods = safeRemainingPeriods.slice(
      0,
      candidate.remainingDailyCapacity,
    );

    if (selectedPeriods.length === 0) {
      continue;
    }

    proposals.push({
      candidateId: candidate.candidateId,
      candidateName: candidate.candidateName,
      periodIds: selectedPeriods,
      subjectQualified: candidate.subjectQualified,
    });

    for (const periodId of selectedPeriods) {
      remainingPeriods.delete(periodId);
    }

    if (remainingPeriods.size === 0) {
      break;
    }
  }

  const unresolvedPeriodIds = uncoveredPeriods.filter((periodId) =>
    remainingPeriods.has(periodId),
  );

  return {
    caseId: absence.id,
    requestedPeriodIds: uncoveredPeriods,
    proposals,
    unresolvedPeriodIds,
    candidateEvaluations,
    fullyPlanned: unresolvedPeriodIds.length === 0,
  };
}