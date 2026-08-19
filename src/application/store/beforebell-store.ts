import type {
  AbsenceCase,
  ActivityEvent,
  CoverageAssignment,
  CoverageCandidate,
  CoverageOffer,
  CoveragePolicy,
  HumanDecision,
} from "@/domain/types";

export interface BeforeBellStoreSeed {
  policies?: readonly CoveragePolicy[];
  cases?: readonly AbsenceCase[];
  candidates?: readonly CoverageCandidate[];
  offers?: readonly CoverageOffer[];
  assignments?: readonly CoverageAssignment[];
  decisions?: readonly HumanDecision[];
  activityEvents?: readonly ActivityEvent[];
}

/**
 * Persistence boundary used by BeforeBell application services.
 *
 * The application layer depends on this interface rather than directly on
 * DynamoDB. The in-memory implementation is used for tests and deterministic
 * local workflows. A DynamoDB implementation can later satisfy the same
 * contract.
 */
export interface BeforeBellStore {
  getPolicy(schoolId: string): Promise<CoveragePolicy | undefined>;
  putPolicy(policy: CoveragePolicy): Promise<void>;

  getCase(caseId: string): Promise<AbsenceCase | undefined>;
  putCase(absenceCase: AbsenceCase): Promise<void>;
    /**
   * Replaces a case only when its authoritative current status matches
   * the expected status.
   *
   * A DynamoDB implementation will later map this to a conditional update.
   */
  updateCaseIfStatus(
    caseId: string,
    expectedStatus: AbsenceCase["status"],
    nextCase: AbsenceCase,
  ): Promise<boolean>;

  getCandidate(
    candidateId: string,
  ): Promise<CoverageCandidate | undefined>;

  listCandidatesBySchool(
    schoolId: string,
  ): Promise<CoverageCandidate[]>;

  putCandidate(candidate: CoverageCandidate): Promise<void>;

  getOffer(offerId: string): Promise<CoverageOffer | undefined>;

  listOffersByCase(
    caseId: string,
  ): Promise<CoverageOffer[]>;

  putOffer(offer: CoverageOffer): Promise<void>;
    /**
   * Creates the offer only when the same offer ID does not already exist.
   *
   * Returns true when created and false when an item with that ID already
   * exists. A DynamoDB implementation will later map this to a conditional
   * write.
   */
  putOfferIfAbsent(
    offer: CoverageOffer,
  ): Promise<boolean>;

  /**
   * Replaces an offer only when its authoritative current status matches
   * the expected status.
   *
   * A DynamoDB implementation will later use a conditional update for
   * this operation.
   */
  updateOfferIfStatus(
    offerId: string,
    expectedStatus: CoverageOffer["status"],
    nextOffer: CoverageOffer,
  ): Promise<boolean>;

  getAssignment(
    assignmentId: string,
  ): Promise<CoverageAssignment | undefined>;

  listAssignmentsByCase(
    caseId: string,
  ): Promise<CoverageAssignment[]>;

  listAssignmentsByCandidate(
  candidateId: string,
  date?: string,
): Promise<CoverageAssignment[]>;

  putAssignment(
    assignment: CoverageAssignment,
  ): Promise<void>;

    /**
   * Creates an assignment only when:
   *
   * - the assignment ID does not already exist;
   * - none of its periods are already assigned for the same case; and
   * - the candidate is not already assigned during any requested period.
   *
   * A DynamoDB implementation will later map this to transactional /
   * conditional writes.
   */
  putAssignmentIfPeriodsFree(
    assignment: CoverageAssignment,
  ): Promise<boolean>;

  getDecision(
    decisionId: string,
  ): Promise<HumanDecision | undefined>;

  listDecisionsByCase(
    caseId: string,
  ): Promise<HumanDecision[]>;

    putDecision(decision: HumanDecision): Promise<void>;

  /**
   * Creates a human decision only when the same decision ID does not
   * already exist.
   *
   * Returns true when created and false when an item with that ID already
   * exists. A DynamoDB implementation will later map this to a conditional
   * write.
   */
  putDecisionIfAbsent(
    decision: HumanDecision,
  ): Promise<boolean>;

  appendActivity(event: ActivityEvent): Promise<void>;

  listActivityByCase(
    caseId: string,
  ): Promise<ActivityEvent[]>;
}