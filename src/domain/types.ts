export type SchoolId = string;
export type StaffMemberId = string;
export type CandidateId = string;
export type AbsenceCaseId = string;
export type CoverageOfferId = string;
export type CoverageAssignmentId = string;
export type HumanDecisionId = string;
export type ActivityEventId = string;
export type CorrelationId = string;

export type PeriodId =
  | "P1"
  | "P2"
  | "P3"
  | "P4"
  | "P5"
  | "P6"
  | "P7"
  | "P8";

export type Subject =
  | "Math"
  | "Science"
  | "English"
  | "Social Studies"
  | "General";

export type AbsenceCaseStatus =
  | "open"
  | "offering"
  | "partially_covered"
  | "awaiting_human_decision"
  | "resolved"
  | "closed";

export type CoverageOfferStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "expired"
  | "cancelled";

export type HumanDecisionStatus =
  | "pending"
  | "approved"
  | "rejected";

export type HumanDecisionKind =
  | "use_protected_planning_period"
  | "request_external_substitute"
  | "combine_coverage_groups";

export type ActivityActorType =
  | "system"
  | "agent"
  | "administrator"
  | "candidate";

export type ActivityStatus =
  | "started"
  | "succeeded"
  | "failed"
  | "waiting";

export interface School {
  id: SchoolId;
  name: string;
}

export interface StaffMember {
  id: StaffMemberId;
  schoolId: SchoolId;
  name: string;
  subject: Subject;
}

export interface CoverageCandidate {
  id: CandidateId;
  schoolId: SchoolId;
  name: string;

  /**
   * Subjects this candidate is specifically qualified to cover.
   * "General" can be used for candidates without a subject specialization.
   */
  qualifiedSubjects: readonly Subject[];

  /**
   * Periods the candidate is normally available for coverage.
   */
  availablePeriods: readonly PeriodId[];

  /**
   * Periods where the candidate already has another obligation or assignment.
   */
  conflictingPeriods: readonly PeriodId[];

  /**
   * Planning periods that may only be consumed with administrator approval.
   */
  protectedPlanningPeriods: readonly PeriodId[];

  /**
   * Number of periods already assigned as coverage today.
   */
  dailyCoverageCount: number;

  active: boolean;
}

export interface AbsenceCase {
  id: AbsenceCaseId;
  schoolId: SchoolId;
  absentStaffMemberId: StaffMemberId;
  subject: Subject;
  date: string;
  affectedPeriods: readonly PeriodId[];
  status: AbsenceCaseStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CoverageOffer {
  id: CoverageOfferId;
  caseId: AbsenceCaseId;
  candidateId: CandidateId;
  periodIds: readonly PeriodId[];
  status: CoverageOfferStatus;
  createdAt: string;
  expiresAt: string;
  respondedAt?: string;
}

export type CoverageAssignmentSource =
  | "accepted_offer"
  | "approved_exception";

export interface CoverageAssignment {
  id: CoverageAssignmentId;
  caseId: AbsenceCaseId;
  candidateId: CandidateId;
  periodIds: readonly PeriodId[];
  source: CoverageAssignmentSource;
  offerId?: CoverageOfferId;
  decisionId?: HumanDecisionId;
  createdAt: string;
}

export interface CoveragePolicy {
  schoolId: SchoolId;

  /**
   * Maximum total coverage periods a candidate may carry in one day.
   */
  maxDailyCoveragePeriods: number;

  /**
   * Subjects where subject-qualified candidates should rank above
   * otherwise-valid general coverage candidates.
   */
  preferSubjectQualifiedFor: readonly Subject[];

  /**
   * Prefer one candidate for the complete absence when possible.
   */
  preferSingleCandidate: boolean;

  /**
   * Normal coverage assignments require the candidate to accept an offer.
   */
  requireCandidateAcceptance: boolean;

  /**
   * These actions always require administrator judgment.
   */
  protectedPlanningRequiresApproval: boolean;
  externalSubstituteRequiresApproval: boolean;
  combineGroupsRequiresApproval: boolean;
}

export interface HumanDecision {
  id: HumanDecisionId;
  caseId: AbsenceCaseId;
  kind: HumanDecisionKind;
  status: HumanDecisionStatus;
  periodIds: readonly PeriodId[];
  candidateId?: CandidateId;
  summary: string;
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string;
}

export interface ActivityEvent {
  eventId: ActivityEventId;
  caseId: AbsenceCaseId;
  timestamp: string;
  actorType: ActivityActorType;
  action: string;
  toolName?: string;
  status: ActivityStatus;
  summary: string;
  durationMs?: number;
  correlationId: CorrelationId;
}