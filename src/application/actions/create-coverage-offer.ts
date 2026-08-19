import type {
  BeforeBellStore,
} from "@/application/store/beforebell-store";

import type {
  ActionResult,
} from "@/application/action-result";

import {
  evaluateCoverageCandidate,
} from "@/domain/coverage/eligibility";

import {
  caseAlreadyAssignedForPeriod,
  hasDuplicatePeriods,
  offerIsActive,
} from "@/domain/coverage/invariants";

import type {
  ActivityActorType,
  CoverageAssignment,
  CoverageOffer,
  PeriodId,
} from "@/domain/types";

export interface CreateCoverageOfferInput {
  offerId: string;
  caseId: string;
  candidateId: string;
  periodIds: readonly PeriodId[];

  now: Date;
  expiresAt: Date;

  activityEventId: string;
  correlationId: string;

  actorType?: ActivityActorType;
}

export interface CreateCoverageOfferData {
  offer: CoverageOffer;
  idempotentReplay: boolean;
}

function samePeriodIds(
  left: readonly PeriodId[],
  right: readonly PeriodId[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every(
    (periodId, index) => periodId === right[index],
  );
}

function existingOfferMatchesRequest(
  offer: CoverageOffer,
  input: CreateCoverageOfferInput,
): boolean {
  return (
    offer.caseId === input.caseId &&
    offer.candidateId === input.candidateId &&
    samePeriodIds(offer.periodIds, input.periodIds) &&
    offer.expiresAt === input.expiresAt.toISOString()
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

function periodsOverlap(
  left: readonly PeriodId[],
  right: readonly PeriodId[],
): boolean {
  const rightPeriods = new Set(right);

  return left.some((periodId) =>
    rightPeriods.has(periodId),
  );
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

async function recordOfferCreatedActivity(
  store: BeforeBellStore,
  input: CreateCoverageOfferInput,
  offer: CoverageOffer,
): Promise<void> {
  await store.appendActivity({
    eventId: input.activityEventId,
    caseId: offer.caseId,
    timestamp: offer.createdAt,
    actorType:
      input.actorType ?? "system",
    action: "coverage_offer_created",
    status: "succeeded",
    summary: `Coverage offer created for ${offer.candidateId} covering ${offer.periodIds.join(
      ", ",
    )}.`,
    correlationId:
      input.correlationId,
  });
}

export async function createCoverageOffer(
  store: BeforeBellStore,
  input: CreateCoverageOfferInput,
): Promise<ActionResult<CreateCoverageOfferData>> {
  if (input.periodIds.length === 0) {
    return {
      success: false,
      code: "no_periods_requested",
      message: "A coverage offer must contain at least one period.",
      retryable: false,
    };
  }

  if (hasDuplicatePeriods(input.periodIds)) {
    return {
      success: false,
      code: "duplicate_periods",
      message: "A coverage offer cannot contain duplicate periods.",
      retryable: false,
    };
  }

  if (input.expiresAt.getTime() <= input.now.getTime()) {
    return {
      success: false,
      code: "invalid_offer_expiry",
      message: "Coverage offer expiry must be later than creation time.",
      retryable: false,
    };
  }

  /**
   * Idempotency check happens early.
   *
   * A replay of an operation that already succeeded should return the
   * authoritative result rather than being re-evaluated as a new action.
   */
  const existingOffer = await store.getOffer(
    input.offerId,
  );

  if (existingOffer) {
    if (
      !existingOfferMatchesRequest(
        existingOffer,
        input,
      )
    ) {
      return {
        success: false,
        code: "offer_idempotency_conflict",
        message:
          "The offer ID already belongs to a different coverage-offer request.",
        retryable: false,
      };
    }

    /**
     * A previous invocation may have committed the offer but failed before
     * activity evidence was written. appendActivity is idempotent by event ID,
     * so replay safely backfills the evidence without duplicating it.
     */
    await recordOfferCreatedActivity(
      store,
      input,
      existingOffer,
    );

    return {
      success: true,
      code: "offer_already_created",
      message: "Coverage offer was already created.",
      retryable: false,
      data: {
        offer: existingOffer,
        idempotentReplay: true,
      },
    };
  }

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
      message: `Coverage offers cannot be created for a case in status "${absenceCase.status}".`,
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
      message: "The school's coverage policy was not found.",
      retryable: false,
    };
  }

  const candidate = await store.getCandidate(
    input.candidateId,
  );

  if (!candidate) {
    return {
      success: false,
      code: "candidate_not_found",
      message: "Coverage candidate was not found.",
      retryable: false,
    };
  }

  if (candidate.schoolId !== absenceCase.schoolId) {
    return {
      success: false,
      code: "candidate_school_mismatch",
      message:
        "The candidate does not belong to the school associated with this case.",
      retryable: false,
    };
  }

  const invalidPeriod = input.periodIds.find(
    (periodId) =>
      !absenceCase.affectedPeriods.includes(periodId),
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

  const existingAssignments = mergeAssignments(
    caseAssignments,
    candidateAssignments,
  );

  const alreadyCoveredPeriod =
    input.periodIds.find((periodId) =>
      caseAlreadyAssignedForPeriod(
        caseAssignments,
        absenceCase.id,
        periodId,
      ),
    );

  if (alreadyCoveredPeriod) {
    return {
      success: false,
      code: "period_already_covered",
      message: `${alreadyCoveredPeriod} already has an active coverage assignment for this case.`,
      retryable: false,
    };
  }

  const requestedAbsence = {
    ...absenceCase,
    affectedPeriods: input.periodIds,
  };

  /**
   * Assignment records are authoritative evidence of how much coverage the
   * candidate already has. This protects us if the candidate snapshot's
   * dailyCoverageCount is temporarily stale.
   */
  const effectiveCandidate = {
  ...candidate,

  /**
   * Candidate snapshot represents pre-existing daily load.
   * BeforeBell assignments persisted for this same date are additive.
   */
  dailyCoverageCount:
    candidate.dailyCoverageCount +
    countUniqueAssignedPeriods(
      candidateAssignments,
    ),
};

  const evaluation = evaluateCoverageCandidate({
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
        "The candidate is no longer automatically eligible for every requested period.",
      retryable: false,
    };
  }

  const caseOffers = await store.listOffersByCase(
    absenceCase.id,
  );

  const conflictingActiveOffer = caseOffers.find(
    (offer) =>
      offer.id !== input.offerId &&
      offerIsActive(offer, input.now) &&
      periodsOverlap(
        offer.periodIds,
        input.periodIds,
      ),
  );

  if (conflictingActiveOffer) {
    return {
      success: false,
      code: "period_already_offered",
      message:
        "At least one requested period already has another active coverage offer.",
      retryable: false,
    };
  }

  const offer: CoverageOffer = {
    id: input.offerId,
    caseId: absenceCase.id,
    candidateId: candidate.id,
    periodIds: [...input.periodIds],
    status: "pending",
    createdAt: input.now.toISOString(),
    expiresAt: input.expiresAt.toISOString(),
  };

  const created = await store.putOfferIfAbsent(
    offer,
  );

  if (!created) {
    /**
     * Another invocation may have won the conditional write.
     * Reload authoritative state and resolve the race idempotently.
     */
    const concurrentlyCreatedOffer =
      await store.getOffer(input.offerId);

    if (
      concurrentlyCreatedOffer &&
      existingOfferMatchesRequest(
        concurrentlyCreatedOffer,
        input,
      )
    ) {
      /**
       * The competing invocation may have committed the offer but failed
       * before recording activity. Safely ensure the evidence exists.
       */
      await recordOfferCreatedActivity(
        store,
        input,
        concurrentlyCreatedOffer,
      );

      return {
        success: true,
        code: "offer_already_created",
        message: "Coverage offer was already created.",
        retryable: false,
        data: {
          offer: concurrentlyCreatedOffer,
          idempotentReplay: true,
        },
      };
    }

    return {
      success: false,
      code: "offer_idempotency_conflict",
      message:
        "The offer ID was concurrently used for a different request.",
      retryable: false,
    };
  }

  await recordOfferCreatedActivity(
    store,
    input,
    offer,
  );

  return {
    success: true,
    code: "offer_created",
    message:
      "Coverage offer was created successfully.",
    retryable: false,
    data: {
      offer,
      idempotentReplay: false,
    },
  };
}