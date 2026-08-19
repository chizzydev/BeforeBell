import type {
  AbsenceCase,
  ActivityEvent,
  CoverageAssignment,
  CoverageCandidate,
  CoverageOffer,
  CoveragePolicy,
  HumanDecision,
} from "@/domain/types";

import type {
  BeforeBellStore,
  BeforeBellStoreSeed,
} from "@/application/store/beforebell-store";

function clone<T>(value: T): T {
  return structuredClone(value);
}

/**
 * Deterministic in-memory implementation of the BeforeBell persistence port.
 *
 * All reads and writes use defensive copies so callers cannot accidentally
 * mutate authoritative state by retaining an object reference.
 */
export class InMemoryBeforeBellStore implements BeforeBellStore {
  private readonly policies = new Map<string, CoveragePolicy>();

  private readonly cases = new Map<string, AbsenceCase>();

  private readonly candidates = new Map<
    string,
    CoverageCandidate
  >();

  private readonly offers = new Map<string, CoverageOffer>();

  private readonly assignments = new Map<
    string,
    CoverageAssignment
  >();

  private readonly decisions = new Map<
    string,
    HumanDecision
  >();

  private readonly activityEvents = new Map<
    string,
    ActivityEvent
  >();

  constructor(seed: BeforeBellStoreSeed = {}) {
    for (const policy of seed.policies ?? []) {
      this.policies.set(policy.schoolId, clone(policy));
    }

    for (const absenceCase of seed.cases ?? []) {
      this.cases.set(absenceCase.id, clone(absenceCase));
    }

    for (const candidate of seed.candidates ?? []) {
      this.candidates.set(candidate.id, clone(candidate));
    }

    for (const offer of seed.offers ?? []) {
      this.offers.set(offer.id, clone(offer));
    }

    for (const assignment of seed.assignments ?? []) {
      this.assignments.set(assignment.id, clone(assignment));
    }

    for (const decision of seed.decisions ?? []) {
      this.decisions.set(decision.id, clone(decision));
    }

    for (const event of seed.activityEvents ?? []) {
      this.activityEvents.set(event.eventId, clone(event));
    }
  }

  async getPolicy(
    schoolId: string,
  ): Promise<CoveragePolicy | undefined> {
    const policy = this.policies.get(schoolId);

    return policy ? clone(policy) : undefined;
  }

  async putPolicy(policy: CoveragePolicy): Promise<void> {
    this.policies.set(policy.schoolId, clone(policy));
  }

  async getCase(
    caseId: string,
  ): Promise<AbsenceCase | undefined> {
    const absenceCase = this.cases.get(caseId);

    return absenceCase ? clone(absenceCase) : undefined;
  }

  async putCase(absenceCase: AbsenceCase): Promise<void> {
    this.cases.set(absenceCase.id, clone(absenceCase));
  }
 
    async updateCaseIfStatus(
    caseId: string,
    expectedStatus: AbsenceCase["status"],
    nextCase: AbsenceCase,
  ): Promise<boolean> {
    const currentCase = this.cases.get(caseId);

    if (!currentCase) {
      return false;
    }

    if (currentCase.status !== expectedStatus) {
      return false;
    }

    if (nextCase.id !== caseId) {
      return false;
    }

    this.cases.set(
      caseId,
      clone(nextCase),
    );

    return true;
  }

  async getCandidate(
    candidateId: string,
  ): Promise<CoverageCandidate | undefined> {
    const candidate = this.candidates.get(candidateId);

    return candidate ? clone(candidate) : undefined;
  }

  async listCandidatesBySchool(
    schoolId: string,
  ): Promise<CoverageCandidate[]> {
    return [...this.candidates.values()]
      .filter((candidate) => candidate.schoolId === schoolId)
      .map(clone);
  }

  async putCandidate(
    candidate: CoverageCandidate,
  ): Promise<void> {
    this.candidates.set(candidate.id, clone(candidate));
  }

  async getOffer(
    offerId: string,
  ): Promise<CoverageOffer | undefined> {
    const offer = this.offers.get(offerId);

    return offer ? clone(offer) : undefined;
  }

  async listOffersByCase(
    caseId: string,
  ): Promise<CoverageOffer[]> {
    return [...this.offers.values()]
      .filter((offer) => offer.caseId === caseId)
      .map(clone);
  }

  async putOffer(offer: CoverageOffer): Promise<void> {
    this.offers.set(offer.id, clone(offer));
  }

     async putOfferIfAbsent(
    offer: CoverageOffer,
  ): Promise<boolean> {
    if (this.offers.has(offer.id)) {
      return false;
    }

    this.offers.set(offer.id, clone(offer));

    return true;
  }

    async updateOfferIfStatus(
    offerId: string,
    expectedStatus: CoverageOffer["status"],
    nextOffer: CoverageOffer,
  ): Promise<boolean> {
    const currentOffer = this.offers.get(offerId);

    if (!currentOffer) {
      return false;
    }

    if (currentOffer.status !== expectedStatus) {
      return false;
    }

    if (nextOffer.id !== offerId) {
      return false;
    }

    this.offers.set(
      offerId,
      clone(nextOffer),
    );

    return true;
  }

  async getAssignment(
    assignmentId: string,
  ): Promise<CoverageAssignment | undefined> {
    const assignment = this.assignments.get(assignmentId);

    return assignment ? clone(assignment) : undefined;
  }

  async listAssignmentsByCase(
    caseId: string,
  ): Promise<CoverageAssignment[]> {
    return [...this.assignments.values()]
      .filter((assignment) => assignment.caseId === caseId)
      .map(clone);
  }

  async listAssignmentsByCandidate(
  candidateId: string,
  date?: string,
): Promise<CoverageAssignment[]> {
  const assignments =
    [...this.assignments.values()]
      .filter(
        (assignment) =>
          assignment.candidateId ===
          candidateId,
      )
      .map(clone);

  if (!date) {
    return assignments;
  }

  const assignmentsOnDate:
    CoverageAssignment[] = [];

  for (
    const assignment of
    assignments
  ) {
    const absenceCase =
      await this.getCase(
        assignment.caseId,
      );

    /**
     * If legacy/incomplete test data has no corresponding case, retain the
     * assignment conservatively rather than under-counting candidate load.
     */
    if (
      !absenceCase ||
      absenceCase.date === date
    ) {
      assignmentsOnDate.push(
        assignment,
      );
    }
  }

  return assignmentsOnDate;
}

  async putAssignment(
    assignment: CoverageAssignment,
  ): Promise<void> {
    this.assignments.set(
      assignment.id,
      clone(assignment),
    );
  }

   async putAssignmentIfPeriodsFree(
  assignment: CoverageAssignment,
): Promise<boolean> {
  if (
    this.assignments.has(
      assignment.id,
    )
  ) {
    return false;
  }

  const assignmentCase =
    await this.getCase(
      assignment.caseId,
    );

  for (
    const currentAssignment of
    this.assignments.values()
  ) {
    const periodsOverlap =
      assignment.periodIds.some(
        (periodId) =>
          currentAssignment.periodIds.includes(
            periodId,
          ),
      );

    if (!periodsOverlap) {
      continue;
    }

    const sameCase =
      currentAssignment.caseId ===
      assignment.caseId;

    const sameCandidate =
      currentAssignment.candidateId ===
      assignment.candidateId;

    let sameCandidateSameDate =
      sameCandidate;

    if (
      sameCandidate &&
      assignmentCase
    ) {
      const currentAssignmentCase =
        await this.getCase(
          currentAssignment.caseId,
        );

      /**
       * Candidate-period ownership is scoped to the school date,
       * matching the DynamoDB candidate/date/period lock.
       *
       * If legacy assignment data has no corresponding case,
       * remain conservative rather than allowing a possible conflict.
       */
      sameCandidateSameDate =
        !currentAssignmentCase ||
        currentAssignmentCase.date ===
          assignmentCase.date;
    }

    if (
      sameCase ||
      sameCandidateSameDate
    ) {
      return false;
    }
  }

  this.assignments.set(
    assignment.id,
    clone(
      assignment,
    ),
  );

  return true;
}

  async getDecision(
    decisionId: string,
  ): Promise<HumanDecision | undefined> {
    const decision = this.decisions.get(decisionId);

    return decision ? clone(decision) : undefined;
  }

  async listDecisionsByCase(
    caseId: string,
  ): Promise<HumanDecision[]> {
    return [...this.decisions.values()]
      .filter((decision) => decision.caseId === caseId)
      .map(clone);
  }

    async putDecision(
    decision: HumanDecision,
  ): Promise<void> {
    this.decisions.set(
      decision.id,
      clone(decision),
    );
  }

  async putDecisionIfAbsent(
    decision: HumanDecision,
  ): Promise<boolean> {
    if (
      this.decisions.has(
        decision.id,
      )
    ) {
      return false;
    }

    this.decisions.set(
      decision.id,
      clone(decision),
    );

    return true;
  }

  async appendActivity(
    event: ActivityEvent,
  ): Promise<void> {
    /**
     * Activity event IDs are idempotency identifiers.
     * Re-appending the same event does not create a duplicate ledger entry.
     */
    if (this.activityEvents.has(event.eventId)) {
      return;
    }

    this.activityEvents.set(event.eventId, clone(event));
  }

  async listActivityByCase(
    caseId: string,
  ): Promise<ActivityEvent[]> {
    return [...this.activityEvents.values()]
      .filter((event) => event.caseId === caseId)
      .map(clone);
  }
}