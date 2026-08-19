import type {
  CoverageAssignment,
  CoverageCandidate,
  CoverageOffer,
  PeriodId,
} from "@/domain/types";

export function hasDuplicatePeriods(
  periods: readonly PeriodId[],
): boolean {
  return new Set(periods).size !== periods.length;
}

export function candidateIsAvailableForPeriod(
  candidate: CoverageCandidate,
  periodId: PeriodId,
): boolean {
  return candidate.availablePeriods.includes(periodId);
}

export function candidateHasConflictForPeriod(
  candidate: CoverageCandidate,
  periodId: PeriodId,
): boolean {
  return candidate.conflictingPeriods.includes(periodId);
}

export function periodIsProtectedPlanning(
  candidate: CoverageCandidate,
  periodId: PeriodId,
): boolean {
  return candidate.protectedPlanningPeriods.includes(periodId);
}

export function candidateCanTakeAdditionalPeriods(
  candidate: CoverageCandidate,
  additionalPeriodCount: number,
  maximumDailyCoveragePeriods: number,
): boolean {
  if (additionalPeriodCount < 0) {
    return false;
  }

  return (
    candidate.dailyCoverageCount + additionalPeriodCount <=
    maximumDailyCoveragePeriods
  );
}

export function offerIsActive(
  offer: CoverageOffer,
  now: Date,
): boolean {
  if (offer.status !== "pending" && offer.status !== "accepted") {
    return false;
  }

  return new Date(offer.expiresAt).getTime() > now.getTime();
}

export function acceptedOfferCanCreateAssignment(
  offer: CoverageOffer,
  now: Date,
): boolean {
  return offer.status === "accepted" && offerIsActive(offer, now);
}

export function candidateAlreadyAssignedForPeriod(
  assignments: readonly CoverageAssignment[],
  candidateId: string,
  periodId: PeriodId,
): boolean {
  return assignments.some(
    (assignment) =>
      assignment.candidateId === candidateId &&
      assignment.periodIds.includes(periodId),
  );
}

export function caseAlreadyAssignedForPeriod(
  assignments: readonly CoverageAssignment[],
  caseId: string,
  periodId: PeriodId,
): boolean {
  return assignments.some(
    (assignment) =>
      assignment.caseId === caseId &&
      assignment.periodIds.includes(periodId),
  );
}