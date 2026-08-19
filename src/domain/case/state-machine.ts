import type {
  AbsenceCase,
  AbsenceCaseStatus,
  PeriodId,
} from "@/domain/types";

export type CaseTransitionCode =
  | "transition_applied"
  | "already_in_status"
  | "invalid_transition";

export interface CaseTransitionResult {
  success: boolean;
  changed: boolean;
  code: CaseTransitionCode;
  message: string;
  previousStatus: AbsenceCaseStatus;
  nextStatus: AbsenceCaseStatus;
  case: AbsenceCase;
}

export interface CaseOperationalSnapshot {
  affectedPeriodIds: readonly PeriodId[];
  coveredPeriodIds: readonly PeriodId[];
  pendingOfferCount: number;
  pendingDecisionCount: number;
}

const allowedTransitions: Record<
  AbsenceCaseStatus,
  readonly AbsenceCaseStatus[]
> = {
  open: [
    "offering",
    "partially_covered",
    "awaiting_human_decision",
    "resolved",
  ],

  offering: [
    "open",
    "partially_covered",
    "awaiting_human_decision",
    "resolved",
  ],

  partially_covered: [
    "offering",
    "awaiting_human_decision",
    "resolved",
  ],

  awaiting_human_decision: [
    "offering",
    "partially_covered",
    "resolved",
  ],

  resolved: ["closed"],

  closed: [],
};

function countCoveredAffectedPeriods(
  affectedPeriodIds: readonly PeriodId[],
  coveredPeriodIds: readonly PeriodId[],
): number {
  const affected = new Set(affectedPeriodIds);
  const covered = new Set(coveredPeriodIds);

  let count = 0;

  for (const periodId of affected) {
    if (covered.has(periodId)) {
      count += 1;
    }
  }

  return count;
}

/**
 * Derives the operational case status from authoritative state.
 *
 * "closed" is intentionally excluded from derivation because closing a
 * resolved case is an explicit lifecycle action rather than a coverage fact.
 */
export function deriveCaseOperationalStatus({
  affectedPeriodIds,
  coveredPeriodIds,
  pendingOfferCount,
  pendingDecisionCount,
}: CaseOperationalSnapshot): Exclude<AbsenceCaseStatus, "closed"> {
  const affectedPeriodCount = new Set(affectedPeriodIds).size;

  const coveredAffectedPeriodCount = countCoveredAffectedPeriods(
    affectedPeriodIds,
    coveredPeriodIds,
  );

  if (
    affectedPeriodCount > 0 &&
    coveredAffectedPeriodCount === affectedPeriodCount
  ) {
    return "resolved";
  }

  if (pendingDecisionCount > 0) {
    return "awaiting_human_decision";
  }

  if (coveredAffectedPeriodCount > 0) {
    return "partially_covered";
  }

  if (pendingOfferCount > 0) {
    return "offering";
  }

  return "open";
}

export function canTransitionCaseStatus(
  currentStatus: AbsenceCaseStatus,
  nextStatus: AbsenceCaseStatus,
): boolean {
  if (currentStatus === nextStatus) {
    return true;
  }

  return allowedTransitions[currentStatus].includes(nextStatus);
}

export function transitionCaseStatus(
  absenceCase: AbsenceCase,
  nextStatus: AbsenceCaseStatus,
  now: Date,
): CaseTransitionResult {
  const previousStatus = absenceCase.status;

  if (previousStatus === nextStatus) {
    return {
      success: true,
      changed: false,
      code: "already_in_status",
      message: `Case is already in status "${nextStatus}".`,
      previousStatus,
      nextStatus,
      case: absenceCase,
    };
  }

  if (!canTransitionCaseStatus(previousStatus, nextStatus)) {
    return {
      success: false,
      changed: false,
      code: "invalid_transition",
      message: `Cannot transition case from "${previousStatus}" to "${nextStatus}".`,
      previousStatus,
      nextStatus,
      case: absenceCase,
    };
  }

  const updatedCase: AbsenceCase = {
    ...absenceCase,
    status: nextStatus,
    updatedAt: now.toISOString(),
  };

  return {
    success: true,
    changed: true,
    code: "transition_applied",
    message: `Case transitioned from "${previousStatus}" to "${nextStatus}".`,
    previousStatus,
    nextStatus,
    case: updatedCase,
  };
}