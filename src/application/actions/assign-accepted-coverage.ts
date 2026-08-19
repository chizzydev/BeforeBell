import type {
  ActionResult,
} from "@/application/action-result";

import type {
  BeforeBellStore,
} from "@/application/store/beforebell-store";

import {
  evaluateCoverageCandidate,
} from "@/domain/coverage/eligibility";

import {
  caseAlreadyAssignedForPeriod,
} from "@/domain/coverage/invariants";

import type {
  CoverageAssignment,
  CoverageCandidate,
  CoverageOffer,
} from "@/domain/types";

export interface AssignAcceptedCoverageInput {
  assignmentId: string;
  offerId: string;

  now: Date;

  activityEventId: string;
  correlationId: string;
}

export interface AssignAcceptedCoverageData {
  assignment: CoverageAssignment;
  idempotentReplay: boolean;
}

function samePeriodIds(
  left: CoverageAssignment["periodIds"],
  right: CoverageOffer["periodIds"],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every(
    (periodId, index) =>
      periodId === right[index],
  );
}

function assignmentMatchesOffer(
  assignment: CoverageAssignment,
  offer: CoverageOffer,
): boolean {
  return (
    assignment.caseId === offer.caseId &&
    assignment.candidateId === offer.candidateId &&
    assignment.source === "accepted_offer" &&
    assignment.offerId === offer.id &&
    samePeriodIds(
      assignment.periodIds,
      offer.periodIds,
    )
  );
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
  assignments: readonly CoverageAssignment[],
): number {
  return new Set(
    assignments.flatMap(
      (assignment) => assignment.periodIds,
    ),
  ).size;
}

function withAuthoritativeCoverageCount(
  candidate: CoverageCandidate,
  assignments: readonly CoverageAssignment[],
): CoverageCandidate {
  /**
   * dailyCoverageCount is the candidate's pre-existing daily load that is
   * not represented by BeforeBell assignment records.
   *
   * Persisted BeforeBell assignments are therefore additive.
   *
   * Using Math.max() here would allow repeated BeforeBell assignments to
   * hide beneath a larger baseline count and eventually exceed the policy
   * maximum.
   */
  return {
    ...candidate,

    dailyCoverageCount:
      candidate.dailyCoverageCount +
      countUniqueAssignedPeriods(
        assignments,
      ),
  };
}

export async function assignAcceptedCoverage(
  store: BeforeBellStore,
  input: AssignAcceptedCoverageInput,
): Promise<ActionResult<AssignAcceptedCoverageData>> {
  const offer = await store.getOffer(
    input.offerId,
  );

  if (!offer) {
    return {
      success: false,
      code: "offer_not_found",
      message: "Coverage offer was not found.",
      retryable: false,
    };
  }

  /**
   * Resolve successful replay before checking mutable lifecycle state.
   *
   * A previously committed assignment remains a successful operation even
   * if the case has since become resolved or the offer has since expired.
   */
  const existingAssignment =
    await store.getAssignment(
      input.assignmentId,
    );

  if (existingAssignment) {
    if (
      assignmentMatchesOffer(
        existingAssignment,
        offer,
      )
    ) {
      return {
        success: true,
        code: "assignment_already_created",
        message:
          "Coverage assignment was already created.",
        retryable: false,
        data: {
          assignment: existingAssignment,
          idempotentReplay: true,
        },
      };
    }

    return {
      success: false,
      code: "assignment_idempotency_conflict",
      message:
        "The assignment ID already belongs to a different assignment.",
      retryable: false,
    };
  }

  if (offer.status !== "accepted") {
    return {
      success: false,
      code: "offer_not_accepted",
      message:
        "Coverage cannot be assigned without an accepted offer.",
      retryable: false,
    };
  }

  if (
    new Date(offer.expiresAt).getTime() <=
    input.now.getTime()
  ) {
    return {
      success: false,
      code: "offer_expired",
      message:
        "The accepted coverage offer expired before assignment.",
      retryable: false,
    };
  }

  const absenceCase = await store.getCase(
    offer.caseId,
  );

  if (!absenceCase) {
    return {
      success: false,
      code: "case_not_found",
      message:
        "The coverage case associated with this offer was not found.",
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
      message: `Coverage cannot be assigned to a case in status "${absenceCase.status}".`,
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

  const candidate = await store.getCandidate(
    offer.candidateId,
  );

  if (!candidate) {
    return {
      success: false,
      code: "candidate_not_found",
      message:
        "The coverage candidate associated with this offer was not found.",
      retryable: false,
    };
  }

  if (
    candidate.schoolId !== absenceCase.schoolId
  ) {
    return {
      success: false,
      code: "candidate_school_mismatch",
      message:
        "The candidate does not belong to the school associated with this case.",
      retryable: false,
    };
  }

  const invalidPeriod = offer.periodIds.find(
    (periodId) =>
      !absenceCase.affectedPeriods.includes(
        periodId,
      ),
  );

  if (invalidPeriod) {
    return {
      success: false,
      code: "period_not_in_absence",
      message: `${invalidPeriod} is not an affected period for this absence.`,
      retryable: false,
    };
  }

  const [
    caseAssignments,
    candidateAssignments,
  ] = await Promise.all([
    store.listAssignmentsByCase(
      absenceCase.id,
    ),
    store.listAssignmentsByCandidate(
  candidate.id,
  absenceCase.date,
),
  ]);

  const alreadyAssignedPeriod =
    offer.periodIds.find((periodId) =>
      caseAlreadyAssignedForPeriod(
        caseAssignments,
        absenceCase.id,
        periodId,
      ),
    );

  if (alreadyAssignedPeriod) {
    return {
      success: false,
      code: "period_already_assigned",
      message: `${alreadyAssignedPeriod} already has coverage for this case.`,
      retryable: false,
    };
  }

  const existingAssignments =
    mergeAssignments(
      caseAssignments,
      candidateAssignments,
    );

  const effectiveCandidate =
    withAuthoritativeCoverageCount(
      candidate,
      candidateAssignments,
    );

  const requestedAbsence = {
    ...absenceCase,
    affectedPeriods: offer.periodIds,
  };

  const evaluation =
    evaluateCoverageCandidate({
      candidate: effectiveCandidate,
      absence: requestedAbsence,
      policy,
      existingAssignments,
    });

  if (!evaluation.canCoverEntireAbsence) {
    return {
      success: false,
      code: "candidate_no_longer_eligible",
      message:
        "The candidate is no longer eligible for every accepted period. No assignment was created.",
      retryable: false,
    };
  }

  const assignment: CoverageAssignment = {
    id: input.assignmentId,
    caseId: absenceCase.id,
    candidateId: candidate.id,
    periodIds: [...offer.periodIds],
    source: "accepted_offer",
    offerId: offer.id,
    createdAt: input.now.toISOString(),
  };

  const created =
    await store.putAssignmentIfPeriodsFree(
      assignment,
    );

  if (!created) {
    /**
     * Another invocation may have committed the same assignment first.
     */
    const concurrentlyCreatedAssignment =
      await store.getAssignment(
        input.assignmentId,
      );

    if (
      concurrentlyCreatedAssignment &&
      assignmentMatchesOffer(
        concurrentlyCreatedAssignment,
        offer,
      )
    ) {
      return {
        success: true,
        code: "assignment_already_created",
        message:
          "Coverage assignment was already created.",
        retryable: false,
        data: {
          assignment:
            concurrentlyCreatedAssignment,
          idempotentReplay: true,
        },
      };
    }

    return {
      success: false,
      code: "assignment_conflict",
      message:
        "The assignment could not be created because a requested case or candidate period is no longer free.",
      retryable: false,
    };
  }

  await store.appendActivity({
    eventId: input.activityEventId,
    caseId: absenceCase.id,
    timestamp: input.now.toISOString(),
    actorType: "system",
    action: "coverage_assignment_created",
    status: "succeeded",
    summary: `${candidate.name} assigned to ${offer.periodIds.join(
      ", ",
    )}.`,
    correlationId: input.correlationId,
  });

  return {
    success: true,
    code: "assignment_created",
    message:
      "Coverage assignment was created successfully.",
    retryable: false,
    data: {
      assignment,
      idempotentReplay: false,
    },
  };
}