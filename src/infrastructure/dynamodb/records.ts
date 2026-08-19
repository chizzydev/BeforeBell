import {
  z,
} from "zod";

import type {
  AbsenceCase,
  ActivityEvent,
  CoverageAssignment,
  CoverageCandidate,
  CoverageOffer,
  CoveragePolicy,
  HumanDecision,
} from "@/domain/types";

import {
  dynamoKeys,
} from "@/infrastructure/dynamodb/keys";

export const DYNAMO_SCHEMA_VERSION =
  1 as const;

const periodSchema =
  z.enum([
    "P1",
    "P2",
    "P3",
    "P4",
    "P5",
    "P6",
    "P7",
    "P8",
  ]);

const subjectSchema =
  z.enum([
    "Math",
    "Science",
    "English",
    "Social Studies",
    "General",
  ]);

const absenceCaseStatusSchema =
  z.enum([
    "open",
    "offering",
    "partially_covered",
    "awaiting_human_decision",
    "resolved",
    "closed",
  ]);

const coveragePolicyRecordSchema =
  z.object({
    PK:
      z.string().min(1),

    SK:
      z.string().min(1),

    entityType:
      z.literal(
        "coverage_policy",
      ),

    schemaVersion:
      z.literal(
        DYNAMO_SCHEMA_VERSION,
      ),

    schoolId:
      z.string().min(1),

    maxDailyCoveragePeriods:
      z.number()
        .int()
        .positive(),

    preferSubjectQualifiedFor:
      z.array(
        subjectSchema,
      ),

    preferSingleCandidate:
      z.boolean(),

    requireCandidateAcceptance:
      z.boolean(),

    protectedPlanningRequiresApproval:
      z.boolean(),

    externalSubstituteRequiresApproval:
      z.boolean(),

    combineGroupsRequiresApproval:
      z.boolean(),
  });

const absenceCaseRecordSchema =
  z.object({
    PK:
      z.string().min(1),

    SK:
      z.string().min(1),

    GSI1PK:
      z.string().min(1),

    GSI1SK:
      z.string().min(1),

    entityType:
      z.literal(
        "absence_case",
      ),

    schemaVersion:
      z.literal(
        DYNAMO_SCHEMA_VERSION,
      ),

    id:
      z.string().min(1),

    schoolId:
      z.string().min(1),

    absentStaffMemberId:
      z.string().min(1),

    subject:
      subjectSchema,

    date:
      z.string().min(1),

    affectedPeriods:
      z.array(
        periodSchema,
      ),

    status:
      absenceCaseStatusSchema,

    createdAt:
      z.string().min(1),

    updatedAt:
      z.string().min(1),
  });

const coverageCandidatePayloadSchema =
  z.object({
    id:
      z.string().min(1),

    schoolId:
      z.string().min(1),

    name:
      z.string().min(1),

    qualifiedSubjects:
      z.array(
        subjectSchema,
      ),

    availablePeriods:
      z.array(
        periodSchema,
      ),

    conflictingPeriods:
      z.array(
        periodSchema,
      ),

    protectedPlanningPeriods:
      z.array(
        periodSchema,
      ),

    dailyCoverageCount:
      z.number()
        .int()
        .nonnegative(),

    active:
      z.boolean(),
  });

const coverageCandidateRecordSchema =
  z.object({
    PK:
      z.string().min(1),

    SK:
      z.literal(
        "META",
      ),

    entityType:
      z.literal(
        "coverage_candidate",
      ),

    schemaVersion:
      z.literal(
        DYNAMO_SCHEMA_VERSION,
      ),

    ...coverageCandidatePayloadSchema.shape,
  });

const schoolCoverageCandidateRecordSchema =
  z.object({
    PK:
      z.string().min(1),

    SK:
      z.string().min(1),

    entityType:
      z.literal(
        "school_coverage_candidate",
      ),

    schemaVersion:
      z.literal(
        DYNAMO_SCHEMA_VERSION,
      ),

    ...coverageCandidatePayloadSchema.shape,
  });

const smokeRecordSchema =
  z.object({
    PK:
      z.string().min(1),

    SK:
      z.string().min(1),

    entityType:
      z.literal(
        "system_smoke",
      ),

    schemaVersion:
      z.literal(
        DYNAMO_SCHEMA_VERSION,
      ),

    nonce:
      z.string().min(1),

    createdAt:
      z.string().min(1),
  });

export type CoveragePolicyRecord =
  z.infer<
    typeof coveragePolicyRecordSchema
  >;

export type AbsenceCaseRecord =
  z.infer<
    typeof absenceCaseRecordSchema
  >;

export type CoverageOfferRecord =
  z.infer<
    typeof coverageOfferRecordSchema
  >;

export type OfferLookupRecord =
  z.infer<
    typeof offerLookupRecordSchema
  >;

export type CoverageCandidateRecord =
  z.infer<
    typeof coverageCandidateRecordSchema
  >;

export type SchoolCoverageCandidateRecord =
  z.infer<
    typeof schoolCoverageCandidateRecordSchema
  >;

export type SmokeRecord =
  z.infer<
    typeof smokeRecordSchema
  >;

export type HumanDecisionRecord =
  z.infer<
    typeof humanDecisionRecordSchema
  >;

export type DecisionLookupRecord =
  z.infer<
    typeof decisionLookupRecordSchema
  >;

export type ActivityEventRecord =
  z.infer<
    typeof activityEventRecordSchema
  >;

export type CoverageAssignmentRecord =
  z.infer<
    typeof coverageAssignmentRecordSchema
  >;

export type CandidateAssignmentRecord =
  z.infer<
    typeof candidateAssignmentRecordSchema
  >;

export type AssignmentLookupRecord =
  z.infer<
    typeof assignmentLookupRecordSchema
  >;

export type CasePeriodLockRecord =
  z.infer<
    typeof casePeriodLockRecordSchema
  >;

export type CandidatePeriodLockRecord =
  z.infer<
    typeof candidatePeriodLockRecordSchema
  >;

export type CandidateCapacityRecord =
  z.infer<
    typeof candidateCapacityRecordSchema
  >;

function assertKeyMatches(
  actual: {
    PK: string;
    SK: string;
  },
  expected: {
    PK: string;
    SK: string;
  },
  entityName: string,
): void {
  if (
    actual.PK !==
      expected.PK ||
    actual.SK !==
      expected.SK
  ) {
    throw new Error(
      `${entityName} DynamoDB key does not match its authoritative domain identifiers.`,
    );
  }
}

export function toHumanDecisionRecord(
  decision: HumanDecision,
): HumanDecisionRecord {
  return {
    ...dynamoKeys.caseDecision(
      decision.caseId,
      decision.id,
    ),

    entityType:
      "human_decision",

    schemaVersion:
      DYNAMO_SCHEMA_VERSION,

    id:
      decision.id,

    caseId:
      decision.caseId,

    kind:
      decision.kind,

    status:
      decision.status,

    periodIds: [
      ...decision.periodIds,
    ],

    ...(decision.candidateId
      ? {
          candidateId:
            decision.candidateId,
        }
      : {}),

    summary:
      decision.summary,

    requestedAt:
      decision.requestedAt,

    ...(decision.decidedAt
      ? {
          decidedAt:
            decision.decidedAt,
        }
      : {}),

    ...(decision.decidedBy
      ? {
          decidedBy:
            decision.decidedBy,
        }
      : {}),
  };
}

export function fromHumanDecisionRecord(
  value: unknown,
): HumanDecision {
  const record =
    humanDecisionRecordSchema.parse(
      value,
    );

  assertKeyMatches(
    record,
    dynamoKeys.caseDecision(
      record.caseId,
      record.id,
    ),
    "Human decision",
  );

  return {
    id:
      record.id,

    caseId:
      record.caseId,

    kind:
      record.kind,

    status:
      record.status,

    periodIds: [
      ...record.periodIds,
    ],

    ...(record.candidateId
      ? {
          candidateId:
            record.candidateId,
        }
      : {}),

    summary:
      record.summary,

    requestedAt:
      record.requestedAt,

    ...(record.decidedAt
      ? {
          decidedAt:
            record.decidedAt,
        }
      : {}),

    ...(record.decidedBy
      ? {
          decidedBy:
            record.decidedBy,
        }
      : {}),
  };
}

export function toDecisionLookupRecord(
  decision: HumanDecision,
): DecisionLookupRecord {
  const target =
    dynamoKeys.caseDecision(
      decision.caseId,
      decision.id,
    );

  return {
    ...dynamoKeys.decisionLookup(
      decision.id,
    ),

    entityType:
      "decision_lookup",

    schemaVersion:
      DYNAMO_SCHEMA_VERSION,

    decisionId:
      decision.id,

    caseId:
      decision.caseId,

    targetPK:
      target.PK,

    targetSK:
      target.SK,
  };
}

export function fromDecisionLookupRecord(
  value: unknown,
): DecisionLookupRecord {
  const record =
    decisionLookupRecordSchema.parse(
      value,
    );

  assertKeyMatches(
    record,
    dynamoKeys.decisionLookup(
      record.decisionId,
    ),
    "Decision lookup",
  );

  const expectedTarget =
    dynamoKeys.caseDecision(
      record.caseId,
      record.decisionId,
    );

  if (
    record.targetPK !==
      expectedTarget.PK ||
    record.targetSK !==
      expectedTarget.SK
  ) {
    throw new Error(
      "Decision lookup target does not match its authoritative decision identifiers.",
    );
  }

  return record;
}

export function toActivityEventRecord(
  event: ActivityEvent,
): ActivityEventRecord {
  return {
    ...dynamoKeys.caseActivity(
      event.caseId,
      event.eventId,
    ),

    entityType:
      "activity_event",

    schemaVersion:
      DYNAMO_SCHEMA_VERSION,

    eventId:
      event.eventId,

    caseId:
      event.caseId,

    timestamp:
      event.timestamp,

    actorType:
      event.actorType,

    action:
      event.action,

    ...(event.toolName
      ? {
          toolName:
            event.toolName,
        }
      : {}),

    status:
      event.status,

    summary:
      event.summary,

    ...(event.durationMs !==
      undefined
      ? {
          durationMs:
            event.durationMs,
        }
      : {}),

    correlationId:
      event.correlationId,
  };
}

export function fromActivityEventRecord(
  value: unknown,
): ActivityEvent {
  const record =
    activityEventRecordSchema.parse(
      value,
    );

  assertKeyMatches(
    record,
    dynamoKeys.caseActivity(
      record.caseId,
      record.eventId,
    ),
    "Activity event",
  );

  return {
    eventId:
      record.eventId,

    caseId:
      record.caseId,

    timestamp:
      record.timestamp,

    actorType:
      record.actorType,

    action:
      record.action,

    ...(record.toolName
      ? {
          toolName:
            record.toolName,
        }
      : {}),

    status:
      record.status,

    summary:
      record.summary,

    ...(record.durationMs !==
      undefined
      ? {
          durationMs:
            record.durationMs,
        }
      : {}),

    correlationId:
      record.correlationId,
  };
}

function assignmentPayload(
  assignment:
    CoverageAssignment,
) {
  return {
    id:
      assignment.id,

    caseId:
      assignment.caseId,

    candidateId:
      assignment.candidateId,

    periodIds: [
      ...assignment.periodIds,
    ],

    source:
      assignment.source,

    ...(assignment.offerId
      ? {
          offerId:
            assignment.offerId,
        }
      : {}),

    ...(assignment.decisionId
      ? {
          decisionId:
            assignment.decisionId,
        }
      : {}),

    createdAt:
      assignment.createdAt,
  };
}

function assignmentFromPayload(
  record:
    z.infer<
      typeof coverageAssignmentPayloadSchema
    >,
): CoverageAssignment {
  return {
    id:
      record.id,

    caseId:
      record.caseId,

    candidateId:
      record.candidateId,

    periodIds: [
      ...record.periodIds,
    ],

    source:
      record.source,

    ...(record.offerId
      ? {
          offerId:
            record.offerId,
        }
      : {}),

    ...(record.decisionId
      ? {
          decisionId:
            record.decisionId,
        }
      : {}),

    createdAt:
      record.createdAt,
  };
}

export function toCoverageAssignmentRecord(
  assignment:
    CoverageAssignment,
  date: string,
): CoverageAssignmentRecord {
  return {
    ...dynamoKeys.caseAssignment(
      assignment.caseId,
      assignment.id,
    ),

    entityType:
      "coverage_assignment",

    schemaVersion:
      DYNAMO_SCHEMA_VERSION,

    date,

    ...assignmentPayload(
      assignment,
    ),
  };
}

export function fromCoverageAssignmentRecord(
  value: unknown,
): CoverageAssignment {
  const record =
    coverageAssignmentRecordSchema.parse(
      value,
    );

  assertKeyMatches(
    record,
    dynamoKeys.caseAssignment(
      record.caseId,
      record.id,
    ),
    "Coverage assignment",
  );

  return assignmentFromPayload(
    record,
  );
}

export function toCandidateAssignmentRecord(
  assignment:
    CoverageAssignment,
  date: string,
): CandidateAssignmentRecord {
  return {
    ...dynamoKeys.candidateAssignment(
      assignment.candidateId,
      date,
      assignment.id,
    ),

    entityType:
      "candidate_assignment",

    schemaVersion:
      DYNAMO_SCHEMA_VERSION,

    date,

    ...assignmentPayload(
      assignment,
    ),
  };
}

export function fromCandidateAssignmentRecord(
  value: unknown,
): CoverageAssignment {
  const record =
    candidateAssignmentRecordSchema.parse(
      value,
    );

  assertKeyMatches(
    record,
    dynamoKeys.candidateAssignment(
      record.candidateId,
      record.date,
      record.id,
    ),
    "Candidate assignment",
  );

  return assignmentFromPayload(
    record,
  );
}

export function toAssignmentLookupRecord(
  assignment:
    CoverageAssignment,
): AssignmentLookupRecord {
  const target =
    dynamoKeys.caseAssignment(
      assignment.caseId,
      assignment.id,
    );

  return {
    ...dynamoKeys.assignmentLookup(
      assignment.id,
    ),

    entityType:
      "assignment_lookup",

    schemaVersion:
      DYNAMO_SCHEMA_VERSION,

    assignmentId:
      assignment.id,

    caseId:
      assignment.caseId,

    candidateId:
      assignment.candidateId,

    targetPK:
      target.PK,

    targetSK:
      target.SK,
  };
}

export function fromAssignmentLookupRecord(
  value: unknown,
): AssignmentLookupRecord {
  const record =
    assignmentLookupRecordSchema.parse(
      value,
    );

  assertKeyMatches(
    record,
    dynamoKeys.assignmentLookup(
      record.assignmentId,
    ),
    "Assignment lookup",
  );

  const expectedTarget =
    dynamoKeys.caseAssignment(
      record.caseId,
      record.assignmentId,
    );

  if (
    record.targetPK !==
      expectedTarget.PK ||
    record.targetSK !==
      expectedTarget.SK
  ) {
    throw new Error(
      "Assignment lookup target does not match its authoritative assignment identifiers.",
    );
  }

  return record;
}

export function toCasePeriodLockRecord(
  assignment:
    CoverageAssignment,
  date: string,
  periodId:
    CoverageAssignment["periodIds"][number],
): CasePeriodLockRecord {
  return {
    ...dynamoKeys.casePeriodLock(
      assignment.caseId,
      periodId,
    ),

    entityType:
      "case_period_lock",

    schemaVersion:
      DYNAMO_SCHEMA_VERSION,

    assignmentId:
      assignment.id,

    caseId:
      assignment.caseId,

    candidateId:
      assignment.candidateId,

    periodId,

    date,

    createdAt:
      assignment.createdAt,
  };
}

export function fromCasePeriodLockRecord(
  value: unknown,
): CasePeriodLockRecord {
  const record =
    casePeriodLockRecordSchema.parse(
      value,
    );

  assertKeyMatches(
    record,
    dynamoKeys.casePeriodLock(
      record.caseId,
      record.periodId,
    ),
    "Case period lock",
  );

  return record;
}

export function toCandidatePeriodLockRecord(
  assignment:
    CoverageAssignment,
  date: string,
  periodId:
    CoverageAssignment["periodIds"][number],
): CandidatePeriodLockRecord {
  return {
    ...dynamoKeys.candidatePeriodLock(
      assignment.candidateId,
      date,
      periodId,
    ),

    entityType:
      "candidate_period_lock",

    schemaVersion:
      DYNAMO_SCHEMA_VERSION,

    assignmentId:
      assignment.id,

    caseId:
      assignment.caseId,

    candidateId:
      assignment.candidateId,

    periodId,

    date,

    createdAt:
      assignment.createdAt,
  };
}

export function fromCandidatePeriodLockRecord(
  value: unknown,
): CandidatePeriodLockRecord {
  const record =
    candidatePeriodLockRecordSchema.parse(
      value,
    );

  assertKeyMatches(
    record,
    dynamoKeys.candidatePeriodLock(
      record.candidateId,
      record.date,
      record.periodId,
    ),
    "Candidate period lock",
  );

  return record;
}

export function createCandidateCapacityRecord(
  candidateId: string,
  date: string,
  beforeBellAssignedPeriodCount:
    number,
): CandidateCapacityRecord {
  return candidateCapacityRecordSchema.parse({
    ...dynamoKeys.candidateCapacity(
      candidateId,
      date,
    ),

    entityType:
      "candidate_capacity",

    schemaVersion:
      DYNAMO_SCHEMA_VERSION,

    candidateId,

    date,

    beforeBellAssignedPeriodCount,
  });
}

export function parseCandidateCapacityRecord(
  value: unknown,
): CandidateCapacityRecord {
  const record =
    candidateCapacityRecordSchema.parse(
      value,
    );

  assertKeyMatches(
    record,
    dynamoKeys.candidateCapacity(
      record.candidateId,
      record.date,
    ),
    "Candidate capacity",
  );

  return record;
}

function candidatePayload(
  candidate:
    CoverageCandidate,
) {
  return {
    id:
      candidate.id,

    schoolId:
      candidate.schoolId,

    name:
      candidate.name,

    qualifiedSubjects: [
      ...candidate.qualifiedSubjects,
    ],

    availablePeriods: [
      ...candidate.availablePeriods,
    ],

    conflictingPeriods: [
      ...candidate.conflictingPeriods,
    ],

    protectedPlanningPeriods: [
      ...candidate
        .protectedPlanningPeriods,
    ],

    dailyCoverageCount:
      candidate.dailyCoverageCount,

    active:
      candidate.active,
  };
}

function candidateFromPayload(
  record:
    z.infer<
      typeof coverageCandidatePayloadSchema
    >,
): CoverageCandidate {
  return {
    id:
      record.id,

    schoolId:
      record.schoolId,

    name:
      record.name,

    qualifiedSubjects: [
      ...record.qualifiedSubjects,
    ],

    availablePeriods: [
      ...record.availablePeriods,
    ],

    conflictingPeriods: [
      ...record.conflictingPeriods,
    ],

    protectedPlanningPeriods: [
      ...record
        .protectedPlanningPeriods,
    ],

    dailyCoverageCount:
      record.dailyCoverageCount,

    active:
      record.active,
  };
}

export function toCoveragePolicyRecord(
  policy: CoveragePolicy,
): CoveragePolicyRecord {
  return {
    ...dynamoKeys.coveragePolicy(
      policy.schoolId,
    ),

    entityType:
      "coverage_policy",

    schemaVersion:
      DYNAMO_SCHEMA_VERSION,

    schoolId:
      policy.schoolId,

    maxDailyCoveragePeriods:
      policy.maxDailyCoveragePeriods,

    preferSubjectQualifiedFor: [
      ...policy.preferSubjectQualifiedFor,
    ],

    preferSingleCandidate:
      policy.preferSingleCandidate,

    requireCandidateAcceptance:
      policy.requireCandidateAcceptance,

    protectedPlanningRequiresApproval:
      policy.protectedPlanningRequiresApproval,

    externalSubstituteRequiresApproval:
      policy.externalSubstituteRequiresApproval,

    combineGroupsRequiresApproval:
      policy.combineGroupsRequiresApproval,
  };
}

export function fromCoveragePolicyRecord(
  value: unknown,
): CoveragePolicy {
  const record =
    coveragePolicyRecordSchema.parse(
      value,
    );

  assertKeyMatches(
    record,
    dynamoKeys.coveragePolicy(
      record.schoolId,
    ),
    "Coverage policy",
  );

  return {
    schoolId:
      record.schoolId,

    maxDailyCoveragePeriods:
      record.maxDailyCoveragePeriods,

    preferSubjectQualifiedFor: [
      ...record.preferSubjectQualifiedFor,
    ],

    preferSingleCandidate:
      record.preferSingleCandidate,

    requireCandidateAcceptance:
      record.requireCandidateAcceptance,

    protectedPlanningRequiresApproval:
      record.protectedPlanningRequiresApproval,

    externalSubstituteRequiresApproval:
      record.externalSubstituteRequiresApproval,

    combineGroupsRequiresApproval:
      record.combineGroupsRequiresApproval,
  };
}

export function toAbsenceCaseRecord(
  absenceCase: AbsenceCase,
): AbsenceCaseRecord {
  const key =
    dynamoKeys.caseMeta(
      absenceCase.id,
    );

  const index =
    dynamoKeys.caseDashboardIndex(
      absenceCase.schoolId,
      absenceCase.date,
      absenceCase.createdAt,
      absenceCase.id,
    );

  return {
    ...key,
    ...index,

    entityType:
      "absence_case",

    schemaVersion:
      DYNAMO_SCHEMA_VERSION,

    id:
      absenceCase.id,

    schoolId:
      absenceCase.schoolId,

    absentStaffMemberId:
      absenceCase
        .absentStaffMemberId,

    subject:
      absenceCase.subject,

    date:
      absenceCase.date,

    affectedPeriods: [
      ...absenceCase.affectedPeriods,
    ],

    status:
      absenceCase.status,

    createdAt:
      absenceCase.createdAt,

    updatedAt:
      absenceCase.updatedAt,
  };
}

export function fromAbsenceCaseRecord(
  value: unknown,
): AbsenceCase {
  const record =
    absenceCaseRecordSchema.parse(
      value,
    );

  assertKeyMatches(
    record,
    dynamoKeys.caseMeta(
      record.id,
    ),
    "Absence case",
  );

  const expectedIndex =
    dynamoKeys.caseDashboardIndex(
      record.schoolId,
      record.date,
      record.createdAt,
      record.id,
    );

  if (
    record.GSI1PK !==
      expectedIndex.GSI1PK ||
    record.GSI1SK !==
      expectedIndex.GSI1SK
  ) {
    throw new Error(
      "Absence case DynamoDB dashboard index does not match its authoritative domain identifiers.",
    );
  }

  return {
    id:
      record.id,

    schoolId:
      record.schoolId,

    absentStaffMemberId:
      record.absentStaffMemberId,

    subject:
      record.subject,

    date:
      record.date,

    affectedPeriods: [
      ...record.affectedPeriods,
    ],

    status:
      record.status,

    createdAt:
      record.createdAt,

    updatedAt:
      record.updatedAt,
  };
}

const coverageOfferStatusSchema =
  z.enum([
    "pending",
    "accepted",
    "declined",
    "expired",
    "cancelled",
  ]);

const coverageOfferRecordSchema =
  z.object({
    PK:
      z.string().min(1),

    SK:
      z.string().min(1),

    entityType:
      z.literal(
        "coverage_offer",
      ),

    schemaVersion:
      z.literal(
        DYNAMO_SCHEMA_VERSION,
      ),

    id:
      z.string().min(1),

    caseId:
      z.string().min(1),

    candidateId:
      z.string().min(1),

    periodIds:
      z.array(
        periodSchema,
      ),

    status:
      coverageOfferStatusSchema,

    createdAt:
      z.string().min(1),

    expiresAt:
      z.string().min(1),

    respondedAt:
      z.string()
        .min(1)
        .optional(),
  });

const offerLookupRecordSchema =
  z.object({
    PK:
      z.string().min(1),

    SK:
      z.literal(
        "META",
      ),

    entityType:
      z.literal(
        "offer_lookup",
      ),

    schemaVersion:
      z.literal(
        DYNAMO_SCHEMA_VERSION,
      ),

    offerId:
      z.string().min(1),

    caseId:
      z.string().min(1),

    targetPK:
      z.string().min(1),

    targetSK:
      z.string().min(1),
  });

const humanDecisionStatusSchema =
  z.enum([
    "pending",
    "approved",
    "rejected",
  ]);

const humanDecisionKindSchema =
  z.enum([
    "use_protected_planning_period",
    "request_external_substitute",
    "combine_coverage_groups",
  ]);

const humanDecisionRecordSchema =
  z.object({
    PK:
      z.string().min(1),

    SK:
      z.string().min(1),

    entityType:
      z.literal(
        "human_decision",
      ),

    schemaVersion:
      z.literal(
        DYNAMO_SCHEMA_VERSION,
      ),

    id:
      z.string().min(1),

    caseId:
      z.string().min(1),

    kind:
      humanDecisionKindSchema,

    status:
      humanDecisionStatusSchema,

    periodIds:
      z.array(
        periodSchema,
      ),

    candidateId:
      z.string()
        .min(1)
        .optional(),

    summary:
      z.string().min(1),

    requestedAt:
      z.string().min(1),

    decidedAt:
      z.string()
        .min(1)
        .optional(),

    decidedBy:
      z.string()
        .min(1)
        .optional(),
  });

const decisionLookupRecordSchema =
  z.object({
    PK:
      z.string().min(1),

    SK:
      z.literal(
        "META",
      ),

    entityType:
      z.literal(
        "decision_lookup",
      ),

    schemaVersion:
      z.literal(
        DYNAMO_SCHEMA_VERSION,
      ),

    decisionId:
      z.string().min(1),

    caseId:
      z.string().min(1),

    targetPK:
      z.string().min(1),

    targetSK:
      z.string().min(1),
  });

const activityActorTypeSchema =
  z.enum([
    "system",
    "agent",
    "administrator",
    "candidate",
  ]);

const activityStatusSchema =
  z.enum([
    "started",
    "succeeded",
    "failed",
    "waiting",
  ]);

const activityEventRecordSchema =
  z.object({
    PK:
      z.string().min(1),

    SK:
      z.string().min(1),

    entityType:
      z.literal(
        "activity_event",
      ),

    schemaVersion:
      z.literal(
        DYNAMO_SCHEMA_VERSION,
      ),

    eventId:
      z.string().min(1),

    caseId:
      z.string().min(1),

    timestamp:
      z.string().min(1),

    actorType:
      activityActorTypeSchema,

    action:
      z.string().min(1),

    toolName:
      z.string()
        .min(1)
        .optional(),

    status:
      activityStatusSchema,

    summary:
      z.string().min(1),

    durationMs:
      z.number()
        .nonnegative()
        .optional(),

    correlationId:
      z.string().min(1),
  });

const coverageAssignmentSourceSchema =
  z.enum([
    "accepted_offer",
    "approved_exception",
  ]);

const coverageAssignmentPayloadSchema =
  z.object({
    id:
      z.string().min(1),

    caseId:
      z.string().min(1),

    candidateId:
      z.string().min(1),

    periodIds:
      z.array(
        periodSchema,
      )
        .min(1),

    source:
      coverageAssignmentSourceSchema,

    offerId:
      z.string()
        .min(1)
        .optional(),

    decisionId:
      z.string()
        .min(1)
        .optional(),

    createdAt:
      z.string().min(1),
  });

const coverageAssignmentRecordSchema =
  z.object({
    PK:
      z.string().min(1),

    SK:
      z.string().min(1),

    entityType:
      z.literal(
        "coverage_assignment",
      ),

    schemaVersion:
      z.literal(
        DYNAMO_SCHEMA_VERSION,
      ),

    date:
      z.string().min(1),

    ...coverageAssignmentPayloadSchema.shape,
  });

const candidateAssignmentRecordSchema =
  z.object({
    PK:
      z.string().min(1),

    SK:
      z.string().min(1),

    entityType:
      z.literal(
        "candidate_assignment",
      ),

    schemaVersion:
      z.literal(
        DYNAMO_SCHEMA_VERSION,
      ),

    date:
      z.string().min(1),

    ...coverageAssignmentPayloadSchema.shape,
  });

const assignmentLookupRecordSchema =
  z.object({
    PK:
      z.string().min(1),

    SK:
      z.literal(
        "META",
      ),

    entityType:
      z.literal(
        "assignment_lookup",
      ),

    schemaVersion:
      z.literal(
        DYNAMO_SCHEMA_VERSION,
      ),

    assignmentId:
      z.string().min(1),

    caseId:
      z.string().min(1),

    candidateId:
      z.string().min(1),

    targetPK:
      z.string().min(1),

    targetSK:
      z.string().min(1),
  });

const casePeriodLockRecordSchema =
  z.object({
    PK:
      z.string().min(1),

    SK:
      z.string().min(1),

    entityType:
      z.literal(
        "case_period_lock",
      ),

    schemaVersion:
      z.literal(
        DYNAMO_SCHEMA_VERSION,
      ),

    assignmentId:
      z.string().min(1),

    caseId:
      z.string().min(1),

    candidateId:
      z.string().min(1),

    periodId:
      periodSchema,

    date:
      z.string().min(1),

    createdAt:
      z.string().min(1),
  });

const candidatePeriodLockRecordSchema =
  z.object({
    PK:
      z.string().min(1),

    SK:
      z.string().min(1),

    entityType:
      z.literal(
        "candidate_period_lock",
      ),

    schemaVersion:
      z.literal(
        DYNAMO_SCHEMA_VERSION,
      ),

    assignmentId:
      z.string().min(1),

    caseId:
      z.string().min(1),

    candidateId:
      z.string().min(1),

    periodId:
      periodSchema,

    date:
      z.string().min(1),

    createdAt:
      z.string().min(1),
  });

const candidateCapacityRecordSchema =
  z.object({
    PK:
      z.string().min(1),

    SK:
      z.string().min(1),

    entityType:
      z.literal(
        "candidate_capacity",
      ),

    schemaVersion:
      z.literal(
        DYNAMO_SCHEMA_VERSION,
      ),

    candidateId:
      z.string().min(1),

    date:
      z.string().min(1),

    beforeBellAssignedPeriodCount:
      z.number()
        .int()
        .nonnegative(),
  });

export function toCoverageOfferRecord(
  offer: CoverageOffer,
): CoverageOfferRecord {
  return {
    ...dynamoKeys.caseOffer(
      offer.caseId,
      offer.id,
    ),

    entityType:
      "coverage_offer",

    schemaVersion:
      DYNAMO_SCHEMA_VERSION,

    id:
      offer.id,

    caseId:
      offer.caseId,

    candidateId:
      offer.candidateId,

    periodIds: [
      ...offer.periodIds,
    ],

    status:
      offer.status,

    createdAt:
      offer.createdAt,

    expiresAt:
      offer.expiresAt,

    ...(offer.respondedAt
      ? {
          respondedAt:
            offer.respondedAt,
        }
      : {}),
  };
}

export function fromCoverageOfferRecord(
  value: unknown,
): CoverageOffer {
  const record =
    coverageOfferRecordSchema.parse(
      value,
    );

  assertKeyMatches(
    record,
    dynamoKeys.caseOffer(
      record.caseId,
      record.id,
    ),
    "Coverage offer",
  );

  return {
    id:
      record.id,

    caseId:
      record.caseId,

    candidateId:
      record.candidateId,

    periodIds: [
      ...record.periodIds,
    ],

    status:
      record.status,

    createdAt:
      record.createdAt,

    expiresAt:
      record.expiresAt,

    ...(record.respondedAt
      ? {
          respondedAt:
            record.respondedAt,
        }
      : {}),
  };
}

export function toOfferLookupRecord(
  offer: CoverageOffer,
): OfferLookupRecord {
  const target =
    dynamoKeys.caseOffer(
      offer.caseId,
      offer.id,
    );

  return {
    ...dynamoKeys.offerLookup(
      offer.id,
    ),

    entityType:
      "offer_lookup",

    schemaVersion:
      DYNAMO_SCHEMA_VERSION,

    offerId:
      offer.id,

    caseId:
      offer.caseId,

    targetPK:
      target.PK,

    targetSK:
      target.SK,
  };
}

export function fromOfferLookupRecord(
  value: unknown,
): OfferLookupRecord {
  const record =
    offerLookupRecordSchema.parse(
      value,
    );

  assertKeyMatches(
    record,
    dynamoKeys.offerLookup(
      record.offerId,
    ),
    "Offer lookup",
  );

  const expectedTarget =
    dynamoKeys.caseOffer(
      record.caseId,
      record.offerId,
    );

  if (
    record.targetPK !==
      expectedTarget.PK ||
    record.targetSK !==
      expectedTarget.SK
  ) {
    throw new Error(
      "Offer lookup target does not match its authoritative offer identifiers.",
    );
  }

  return record;
}

export function toCoverageCandidateRecord(
  candidate: CoverageCandidate,
): CoverageCandidateRecord {
  return {
    ...dynamoKeys.candidateMeta(
      candidate.id,
    ),

    entityType:
      "coverage_candidate",

    schemaVersion:
      DYNAMO_SCHEMA_VERSION,

    ...candidatePayload(
      candidate,
    ),
  };
}

export function fromCoverageCandidateRecord(
  value: unknown,
): CoverageCandidate {
  const record =
    coverageCandidateRecordSchema.parse(
      value,
    );

  assertKeyMatches(
    record,
    dynamoKeys.candidateMeta(
      record.id,
    ),
    "Coverage candidate",
  );

  return candidateFromPayload(
    record,
  );
}

export function toSchoolCoverageCandidateRecord(
  candidate: CoverageCandidate,
): SchoolCoverageCandidateRecord {
  return {
    ...dynamoKeys.schoolCandidate(
      candidate.schoolId,
      candidate.id,
    ),

    entityType:
      "school_coverage_candidate",

    schemaVersion:
      DYNAMO_SCHEMA_VERSION,

    ...candidatePayload(
      candidate,
    ),
  };
}

export function fromSchoolCoverageCandidateRecord(
  value: unknown,
): CoverageCandidate {
  const record =
    schoolCoverageCandidateRecordSchema.parse(
      value,
    );

  assertKeyMatches(
    record,
    dynamoKeys.schoolCandidate(
      record.schoolId,
      record.id,
    ),
    "School coverage candidate",
  );

  return candidateFromPayload(
    record,
  );
}

export function createSmokeRecord(
  nonce: string,
  now: Date,
): SmokeRecord {
  return smokeRecordSchema.parse({
    ...dynamoKeys.systemSmoke(
      nonce,
    ),

    entityType:
      "system_smoke",

    schemaVersion:
      DYNAMO_SCHEMA_VERSION,

    nonce,

    createdAt:
      now.toISOString(),
  });
}

export function parseSmokeRecord(
  value: unknown,
): SmokeRecord {
  const record =
    smokeRecordSchema.parse(
      value,
    );

  assertKeyMatches(
    record,
    dynamoKeys.systemSmoke(
      record.nonce,
    ),
    "Smoke record",
  );

  return record;
}