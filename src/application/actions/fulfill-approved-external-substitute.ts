import type {
  ActionResult,
} from "@/application/action-result";

import {
  reconcileCoverageCase,
} from "@/application/actions/reconcile-coverage-case";

import {
  buildStableOperationId,
} from "@/application/idempotency";

import type {
  BeforeBellStore,
} from "@/application/store/beforebell-store";

import type {
  CoverageAssignment,
  HumanDecision,
  PeriodId,
} from "@/domain/types";

export interface FulfillApprovedExternalSubstituteInput {
  /**
   * The approved administrator decision being fulfilled.
   */
  decisionId: string;

  /**
   * Authoritative identifier supplied by the external-substitute
   * fulfillment integration.
   *
   * This value is not supplied by the LLM.
   */
  externalSubstituteId: string;

  now: Date;
}

export interface FulfillApprovedExternalSubstituteData {
  assignment: CoverageAssignment;
  idempotentReplay: boolean;
  caseStatus: string;
  caseStatusChanged: boolean;
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

function assignmentMatchesFulfillment(
  assignment: CoverageAssignment,
  decision: HumanDecision,
  externalSubstituteId: string,
): boolean {
  return (
    assignment.caseId ===
      decision.caseId &&
    assignment.source ===
      "approved_exception" &&
    assignment.decisionId ===
      decision.id &&
    assignment.candidateId ===
      externalSubstituteId &&
    samePeriodSet(
      assignment.periodIds,
      decision.periodIds,
    )
  );
}

function buildAssignmentId(
  decisionId: string,
): string {
  /**
   * One approved external-substitute decision may produce at most
   * one logical assignment.
   *
   * The external substitute ID deliberately does not affect assignment
   * identity. A retry with different assignee data therefore conflicts
   * rather than silently creating another assignment.
   */
  return buildStableOperationId(
    "assignment",
    [
      "approved-external-substitute",
      decisionId,
    ].join(":"),
  );
}

function buildAssignmentActivityEventId(
  decisionId: string,
): string {
  return buildStableOperationId(
    "activity",
    [
      "approved-external-substitute",
      decisionId,
      "assignment-created",
    ].join(":"),
  );
}

function buildReconciliationActivityEventId(
  decisionId: string,
): string {
  return buildStableOperationId(
    "activity",
    [
      "approved-external-substitute",
      decisionId,
      "case-reconciliation",
    ].join(":"),
  );
}

function buildCorrelationId(
  caseId: string,
): string {
  return buildStableOperationId(
    "correlation",
    caseId,
  );
}

async function recordAssignmentActivity(
  store: BeforeBellStore,
  assignment: CoverageAssignment,
  decision: HumanDecision,
  eventId: string,
  correlationId: string,
): Promise<void> {
  await store.appendActivity({
    eventId,

    caseId:
      decision.caseId,

    timestamp:
      assignment.createdAt,

    actorType:
      "system",

    action:
      "coverage_assignment_created",

    status:
      "succeeded",

    summary:
      `External substitute ${assignment.candidateId} assigned to ${assignment.periodIds.join(
        ", ",
      )} from approved administrator decision ${decision.id}.`,

    correlationId,
  });
}

export async function fulfillApprovedExternalSubstitute(
  store: BeforeBellStore,
  input: FulfillApprovedExternalSubstituteInput,
): Promise<
  ActionResult<FulfillApprovedExternalSubstituteData>
> {
  if (
    Number.isNaN(
      input.now.getTime(),
    )
  ) {
    return {
      success: false,
      code:
        "invalid_fulfillment_time",
      message:
        "External-substitute fulfillment time is invalid.",
      retryable: false,
    };
  }

  const externalSubstituteId =
    input.externalSubstituteId.trim();

  if (
    externalSubstituteId.length ===
    0
  ) {
    return {
      success: false,
      code:
        "external_substitute_id_required",
      message:
        "External-substitute fulfillment requires an authoritative substitute identifier.",
      retryable: false,
    };
  }

  const decision =
    await store.getDecision(
      input.decisionId,
    );

  if (!decision) {
    return {
      success: false,
      code:
        "decision_not_found",
      message:
        "Human exception decision was not found.",
      retryable: false,
    };
  }

  /**
   * Only a genuinely approved external-substitute decision can reach
   * the fulfillment path.
   */
  if (
    decision.status !==
    "approved"
  ) {
    return {
      success: false,
      code:
        "decision_not_approved",
      message:
        "The external-substitute decision has not been approved.",
      retryable: false,
    };
  }

  if (
    decision.kind !==
    "request_external_substitute"
  ) {
    return {
      success: false,
      code:
        "decision_kind_not_external_substitute",
      message:
        "The approved human decision is not an external-substitute decision.",
      retryable: false,
    };
  }

  if (
    decision.periodIds.length ===
    0
  ) {
    return {
      success: false,
      code:
        "decision_has_no_periods",
      message:
        "The approved external-substitute decision has no coverage periods.",
      retryable: false,
    };
  }

  const absenceCase =
    await store.getCase(
      decision.caseId,
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

  /**
   * Check for an existing fulfillment BEFORE rejecting terminal case
   * state. This lets an exact retry remain successful after its first
   * execution already resolved the case.
   */
  const existingAssignments =
    await store.listAssignmentsByCase(
      decision.caseId,
    );

  const existingForDecision =
    existingAssignments.find(
      (assignment) =>
        assignment.decisionId ===
        decision.id,
    );

  const assignmentId =
    buildAssignmentId(
      decision.id,
    );

  const assignmentActivityEventId =
    buildAssignmentActivityEventId(
      decision.id,
    );

  const reconciliationActivityEventId =
    buildReconciliationActivityEventId(
      decision.id,
    );

  const correlationId =
    buildCorrelationId(
      decision.caseId,
    );

  if (existingForDecision) {
    if (
      !assignmentMatchesFulfillment(
        existingForDecision,
        decision,
        externalSubstituteId,
      )
    ) {
      return {
        success: false,
        code:
          "external_substitute_fulfillment_conflict",
        message:
          "This approved administrator decision has already been fulfilled by different authoritative assignment data.",
        retryable: false,
      };
    }

    /**
     * Backfill operational evidence if a prior execution committed the
     * assignment but failed before its activity event was persisted.
     */
    await recordAssignmentActivity(
      store,
      existingForDecision,
      decision,
      assignmentActivityEventId,
      correlationId,
    );

    const reconciliationResult =
      await reconcileCoverageCase(
        store,
        {
          caseId:
            decision.caseId,

          now:
            input.now,

          activityEventId:
            reconciliationActivityEventId,

          correlationId,
        },
      );

    if (
      !reconciliationResult.success ||
      !reconciliationResult.data
    ) {
      return {
        success: false,
        code:
          "external_substitute_assignment_exists_reconciliation_failed",
        message:
          `The external-substitute assignment already exists, but case reconciliation did not complete: ${reconciliationResult.message}`,
        retryable:
          reconciliationResult.retryable,
      };
    }

    return {
      success: true,
      code:
        "external_substitute_fulfillment_already_recorded",
      message:
        "The same external-substitute fulfillment was already recorded.",
      retryable: false,
      data: {
        assignment:
          existingForDecision,

        idempotentReplay:
          true,

        caseStatus:
          reconciliationResult.data
            .currentStatus,

        caseStatusChanged:
          reconciliationResult.data
            .changed,
      },
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
    decision.periodIds.some(
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
        "The approved external-substitute decision contains a period outside the coverage case.",
      retryable: false,
    };
  }

  /**
   * Periods come exclusively from the approved HumanDecision.
   *
   * The external fulfillment event cannot expand, shrink, or otherwise
   * rewrite administrator-approved scope.
   */
  const assignment:
    CoverageAssignment = {
      id:
        assignmentId,

      caseId:
        decision.caseId,

      candidateId:
        externalSubstituteId,

      periodIds: [
        ...decision.periodIds,
      ],

      source:
        "approved_exception",

      decisionId:
        decision.id,

      createdAt:
        input.now.toISOString(),
    };

  const created =
    await store.putAssignmentIfPeriodsFree(
      assignment,
    );

  if (!created) {
    /**
     * A concurrent delivery may have committed first.
     * Reload authoritative assignments before classifying the outcome.
     */
    const concurrentAssignments =
      await store.listAssignmentsByCase(
        decision.caseId,
      );

    const concurrentForDecision =
      concurrentAssignments.find(
        (current) =>
          current.decisionId ===
          decision.id,
      );

    if (
      concurrentForDecision &&
      assignmentMatchesFulfillment(
        concurrentForDecision,
        decision,
        externalSubstituteId,
      )
    ) {
      await recordAssignmentActivity(
        store,
        concurrentForDecision,
        decision,
        assignmentActivityEventId,
        correlationId,
      );

      const reconciliationResult =
        await reconcileCoverageCase(
          store,
          {
            caseId:
              decision.caseId,

            now:
              input.now,

            activityEventId:
              reconciliationActivityEventId,

            correlationId,
          },
        );

      if (
        !reconciliationResult.success ||
        !reconciliationResult.data
      ) {
        return {
          success: false,
          code:
            "external_substitute_assignment_exists_reconciliation_failed",
          message:
            `The external-substitute assignment exists, but case reconciliation did not complete: ${reconciliationResult.message}`,
          retryable:
            reconciliationResult.retryable,
        };
      }

      return {
        success: true,
        code:
          "external_substitute_fulfillment_already_recorded",
        message:
          "The same external-substitute fulfillment was already recorded.",
        retryable: false,
        data: {
          assignment:
            concurrentForDecision,

          idempotentReplay:
            true,

          caseStatus:
            reconciliationResult.data
              .currentStatus,

          caseStatusChanged:
            reconciliationResult.data
              .changed,
        },
      };
    }

    return {
      success: false,
      code:
        "external_substitute_assignment_conflict",
      message:
        "The approved external-substitute periods are no longer free for this fulfillment.",
      retryable: false,
    };
  }

  await recordAssignmentActivity(
    store,
    assignment,
    decision,
    assignmentActivityEventId,
    correlationId,
  );

  const reconciliationResult =
    await reconcileCoverageCase(
      store,
      {
        caseId:
          decision.caseId,

        now:
          input.now,

        activityEventId:
          reconciliationActivityEventId,

        correlationId,
      },
    );

  if (
    !reconciliationResult.success ||
    !reconciliationResult.data
  ) {
    /**
     * Assignment is already authoritative at this point.
     * A retry uses the exact same logical identity and will only attempt
     * evidence backfill / reconciliation rather than creating a duplicate.
     */
    return {
      success: false,
      code:
        "external_substitute_assignment_created_reconciliation_failed",
      message:
        `The external-substitute assignment was created, but case reconciliation did not complete: ${reconciliationResult.message}`,
      retryable:
        reconciliationResult.retryable,
    };
  }

  return {
    success: true,
    code:
      "external_substitute_fulfilled",
    message:
      `The approved external-substitute decision was fulfilled authoritatively. Case operational status is ${reconciliationResult.data.currentStatus}.`,
    retryable: false,
    data: {
      assignment,

      idempotentReplay:
        false,

      caseStatus:
        reconciliationResult.data
          .currentStatus,

      caseStatusChanged:
        reconciliationResult.data
          .changed,
    },
  };
}