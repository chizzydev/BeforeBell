import type {
  ActionResult,
} from "@/application/action-result";

import type {
  BeforeBellStore,
} from "@/application/store/beforebell-store";

import type {
  HumanDecision,
  HumanDecisionKind,
  PeriodId,
} from "@/domain/types";

export interface RecordApprovedExceptionDecisionInput {
  decisionId: string;
  caseId: string;

  kind:
    HumanDecisionKind;

  periodIds:
    readonly PeriodId[];

  candidateId?: string;

  summary: string;

  now: Date;

  decidedBy: string;

  activityEventId: string;

  correlationId: string;
}

export interface RecordApprovedExceptionDecisionData {
  decision:
    HumanDecision;

  idempotentReplay:
    boolean;
}

function samePeriodSet(
  left: readonly PeriodId[],
  right: readonly PeriodId[],
): boolean {
  if (
    left.length !==
    right.length
  ) {
    return false;
  }

  const leftPeriods =
    new Set(left);

  return right.every(
    (periodId) =>
      leftPeriods.has(
        periodId,
      ),
  );
}

/**
 * Compares the logical human decision while deliberately ignoring
 * persistence timestamps.
 *
 * A retry occurring later must remain the same logical operation rather
 * than conflicting merely because wall-clock time advanced.
 */
function isSameLogicalDecision(
  existing: HumanDecision,
  input: RecordApprovedExceptionDecisionInput,
): boolean {
  return (
    existing.id ===
      input.decisionId &&
    existing.caseId ===
      input.caseId &&
    existing.kind ===
      input.kind &&
    existing.status ===
      "approved" &&
    samePeriodSet(
      existing.periodIds,
      input.periodIds,
    ) &&
    existing.candidateId ===
      input.candidateId &&
    existing.summary ===
      input.summary &&
    existing.decidedBy ===
      input.decidedBy
  );
}

async function recordDecisionActivity(
  store: BeforeBellStore,
  input: RecordApprovedExceptionDecisionInput,
  decision: HumanDecision,
): Promise<void> {
  await store.appendActivity({
    eventId:
      input.activityEventId,

    caseId:
      input.caseId,

    timestamp:
      decision.decidedAt ??
      decision.requestedAt,

    actorType:
      "administrator",

    action:
      "human_exception_decision_approved",

    toolName:
      "request_exception_decision",

    status:
      "succeeded",

    summary:
      `Administrator approved exception decision: ${decision.summary}`,

    correlationId:
      input.correlationId,
  });
}

function successfulReplay(
  decision: HumanDecision,
): ActionResult<
  RecordApprovedExceptionDecisionData
> {
  return {
    success: true,
    code:
      "human_exception_decision_already_recorded",
    message:
      "The same administrator exception decision was already recorded.",
    retryable: false,
    data: {
      decision,
      idempotentReplay:
        true,
    },
  };
}

export async function recordApprovedExceptionDecision(
  store: BeforeBellStore,
  input: RecordApprovedExceptionDecisionInput,
): Promise<
  ActionResult<RecordApprovedExceptionDecisionData>
> {
  if (
    Number.isNaN(
      input.now.getTime(),
    )
  ) {
    return {
      success: false,
      code:
        "invalid_decision_time",
      message:
        "The administrator decision time is invalid.",
      retryable: false,
    };
  }

  if (
    input.periodIds.length ===
    0
  ) {
    return {
      success: false,
      code:
        "decision_requires_periods",
      message:
        "An exception decision must apply to at least one coverage period.",
      retryable: false,
    };
  }

  if (
    new Set(
      input.periodIds,
    ).size !==
    input.periodIds.length
  ) {
    return {
      success: false,
      code:
        "duplicate_decision_periods",
      message:
        "An exception decision cannot contain duplicate coverage periods.",
      retryable: false,
    };
  }

  if (
    input.kind ===
      "use_protected_planning_period" &&
    !input.candidateId
  ) {
    return {
      success: false,
      code:
        "protected_planning_candidate_required",
      message:
        "A protected-planning decision must identify the exact approved candidate.",
      retryable: false,
    };
  }

  if (
    input.kind !==
      "use_protected_planning_period" &&
    input.candidateId
  ) {
    return {
      success: false,
      code:
        "unexpected_exception_candidate",
      message:
        "This exception decision kind must not contain an internal candidate.",
      retryable: false,
    };
  }

  const absenceCase =
    await store.getCase(
      input.caseId,
    );

  if (!absenceCase) {
    return {
      success: false,
      code:
        "case_not_found",
      message:
        "Coverage case was not found.",
      retryable: false,
    };
  }

  if (
    absenceCase.status ===
      "resolved" ||
    absenceCase.status ===
      "closed"
  ) {
    return {
      success: false,
      code:
        "case_not_actionable",
      message:
        "The coverage case is no longer actionable.",
      retryable: false,
    };
  }

  const affectedPeriods =
    new Set(
      absenceCase.affectedPeriods,
    );

  if (
    input.periodIds.some(
      (periodId) =>
        !affectedPeriods.has(
          periodId,
        ),
    )
  ) {
    return {
      success: false,
      code:
        "decision_period_not_in_case",
      message:
        "The administrator decision contains a period that is not part of the coverage case.",
      retryable: false,
    };
  }

  if (
    input.kind ===
      "use_protected_planning_period"
  ) {
    const candidate =
      await store.getCandidate(
        input.candidateId!,
      );

    if (
      !candidate ||
      candidate.schoolId !==
        absenceCase.schoolId
    ) {
      return {
        success: false,
        code:
          "decision_candidate_not_found",
        message:
          "The approved protected-planning candidate was not found in the case school.",
        retryable: false,
      };
    }
  }

  /**
   * Stable decision identity may already exist because a previous invocation
   * committed the decision and failed before returning or recording activity.
   */
  const existingDecision =
    await store.getDecision(
      input.decisionId,
    );

  if (existingDecision) {
    if (
      !isSameLogicalDecision(
        existingDecision,
        input,
      )
    ) {
      return {
        success: false,
        code:
          "decision_idempotency_conflict",
        message:
          "The human-decision ID already belongs to a different logical decision.",
        retryable: false,
      };
    }

    /**
     * Backfill the ledger safely if the original attempt committed the
     * decision but failed before activity persistence.
     */
    await recordDecisionActivity(
      store,
      input,
      existingDecision,
    );

    return successfulReplay(
      existingDecision,
    );
  }

  const timestamp =
    input.now.toISOString();

  /**
   * Checkpoint 4B persists the completed administrator selection.
   *
   * Because we intentionally did not persist a pending decision before the
   * Strands interrupt, requestedAt and decidedAt begin together when the
   * completed decision becomes durable.
   */
  const decision:
    HumanDecision = {
      id:
        input.decisionId,

      caseId:
        input.caseId,

      kind:
        input.kind,

      status:
        "approved",

      periodIds: [
        ...input.periodIds,
      ],

      ...(input.candidateId
        ? {
            candidateId:
              input.candidateId,
          }
        : {}),

      summary:
        input.summary,

      requestedAt:
        timestamp,

      decidedAt:
        timestamp,

      decidedBy:
        input.decidedBy,
    };

  const created =
    await store.putDecisionIfAbsent(
      decision,
    );

  if (!created) {
    const concurrentDecision =
      await store.getDecision(
        input.decisionId,
      );

    if (
      concurrentDecision &&
      isSameLogicalDecision(
        concurrentDecision,
        input,
      )
    ) {
      await recordDecisionActivity(
        store,
        input,
        concurrentDecision,
      );

      return successfulReplay(
        concurrentDecision,
      );
    }

    return {
      success: false,
      code:
        "decision_idempotency_conflict",
      message:
        "Another operation used the same human-decision identity for different data.",
      retryable: false,
    };
  }

  await recordDecisionActivity(
    store,
    input,
    decision,
  );

  return {
    success: true,
    code:
      "human_exception_decision_recorded",
    message:
      "The administrator exception decision was recorded authoritatively.",
    retryable: false,
    data: {
      decision,
      idempotentReplay:
        false,
    },
  };
}