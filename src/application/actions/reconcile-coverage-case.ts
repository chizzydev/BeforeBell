import type {
  ActionResult,
} from "@/application/action-result";

import type {
  BeforeBellStore,
} from "@/application/store/beforebell-store";

import {
  deriveCaseOperationalStatus,
  transitionCaseStatus,
} from "@/domain/case/state-machine";

import {
  offerIsActive,
} from "@/domain/coverage/invariants";

import type {
  AbsenceCase,
  AbsenceCaseStatus,
  PeriodId,
} from "@/domain/types";

export interface ReconcileCoverageCaseInput {
  caseId: string;

  now: Date;

  activityEventId: string;
  correlationId: string;
}

export interface ReconcileCoverageCaseData {
  case: AbsenceCase;
  previousStatus: AbsenceCaseStatus;
  currentStatus: AbsenceCaseStatus;
  changed: boolean;
}

function getCoveredPeriodIds(
  assignments: Awaited<
    ReturnType<
      BeforeBellStore["listAssignmentsByCase"]
    >
  >,
): PeriodId[] {
  return assignments.flatMap(
    (assignment) => assignment.periodIds,
  );
}

export async function reconcileCoverageCase(
  store: BeforeBellStore,
  input: ReconcileCoverageCaseInput,
): Promise<ActionResult<ReconcileCoverageCaseData>> {
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

  /**
   * Closed is an explicit terminal lifecycle state.
   * Operational reconciliation must never reopen it.
   */
  if (absenceCase.status === "closed") {
    return {
      success: true,
      code: "case_already_closed",
      message:
        "The coverage case is already closed.",
      retryable: false,
      data: {
        case: absenceCase,
        previousStatus: "closed",
        currentStatus: "closed",
        changed: false,
      },
    };
  }

  const [
    assignments,
    offers,
    decisions,
  ] = await Promise.all([
    store.listAssignmentsByCase(
      absenceCase.id,
    ),
    store.listOffersByCase(
      absenceCase.id,
    ),
    store.listDecisionsByCase(
      absenceCase.id,
    ),
  ]);

  const coveredPeriodIds =
    getCoveredPeriodIds(assignments);

  /**
   * Both pending and accepted-but-not-yet-assigned offers represent
   * active automated coverage work while they remain unexpired.
   */
  const activeOfferCount = offers.filter(
    (offer) =>
      offerIsActive(
        offer,
        input.now,
      ),
  ).length;

  const pendingDecisionCount =
    decisions.filter(
      (decision) =>
        decision.status === "pending",
    ).length;

  const derivedStatus =
    deriveCaseOperationalStatus({
      affectedPeriodIds:
        absenceCase.affectedPeriods,
      coveredPeriodIds,
      pendingOfferCount:
        activeOfferCount,
      pendingDecisionCount,
    });

  const transition =
    transitionCaseStatus(
      absenceCase,
      derivedStatus,
      input.now,
    );

  if (!transition.success) {
    return {
      success: false,
      code: "case_transition_invalid",
      message: transition.message,
      retryable: false,
    };
  }

  if (!transition.changed) {
    return {
      success: true,
      code: "case_status_current",
      message:
        "Coverage case already reflects authoritative operational state.",
      retryable: false,
      data: {
        case: absenceCase,
        previousStatus:
          absenceCase.status,
        currentStatus:
          absenceCase.status,
        changed: false,
      },
    };
  }

  const updated =
    await store.updateCaseIfStatus(
      absenceCase.id,
      absenceCase.status,
      transition.case,
    );

  if (!updated) {
    /**
     * Another reconciliation may have won the conditional update.
     * Reload authoritative case state before deciding what happened.
     */
    const currentCase =
      await store.getCase(
        absenceCase.id,
      );

    if (!currentCase) {
      return {
        success: false,
        code: "case_not_found",
        message:
          "The coverage case no longer exists.",
        retryable: false,
      };
    }

    if (
      currentCase.status ===
      derivedStatus
    ) {
      return {
        success: true,
        code: "case_status_current",
        message:
          "Coverage case already reflects authoritative operational state.",
        retryable: false,
        data: {
          case: currentCase,
          previousStatus:
            absenceCase.status,
          currentStatus:
            currentCase.status,
          changed: false,
        },
      };
    }

    return {
      success: false,
      code: "case_status_changed_concurrently",
      message:
        "The case status changed during reconciliation. The operation can be safely retried.",
      retryable: true,
    };
  }

  await store.appendActivity({
    eventId: input.activityEventId,
    caseId: absenceCase.id,
    timestamp: input.now.toISOString(),
    actorType: "system",
    action: "coverage_case_status_updated",
    status: "succeeded",
    summary: `Coverage case moved from ${absenceCase.status} to ${derivedStatus}.`,
    correlationId:
      input.correlationId,
  });

  return {
    success: true,
    code: "case_status_updated",
    message:
      "Coverage case status was reconciled successfully.",
    retryable: false,
    data: {
      case: transition.case,
      previousStatus:
        absenceCase.status,
      currentStatus:
        transition.case.status,
      changed: true,
    },
  };
}