import {
  describe,
  expect,
  it,
} from "vitest";

import {
  riversideCoveragePolicy,
  scenarioBAbsence,
  scenarioBCandidates,
} from "@/fixtures/riverside";

import {
  createSmokeRecord,
  fromAbsenceCaseRecord,
  fromCoverageCandidateRecord,
  fromCoveragePolicyRecord,
  fromSchoolCoverageCandidateRecord,
  toAbsenceCaseRecord,
  toCoverageCandidateRecord,
  toCoveragePolicyRecord,
  toSchoolCoverageCandidateRecord,
  fromCoverageOfferRecord,
fromOfferLookupRecord,
toCoverageOfferRecord,
toOfferLookupRecord,
fromActivityEventRecord,
fromDecisionLookupRecord,
fromHumanDecisionRecord,
toActivityEventRecord,
toDecisionLookupRecord,
toHumanDecisionRecord,
createCandidateCapacityRecord,
fromAssignmentLookupRecord,
fromCandidateAssignmentRecord,
fromCandidatePeriodLockRecord,
fromCasePeriodLockRecord,
fromCoverageAssignmentRecord,
parseCandidateCapacityRecord,
toAssignmentLookupRecord,
toCandidateAssignmentRecord,
toCandidatePeriodLockRecord,
toCasePeriodLockRecord,
toCoverageAssignmentRecord,
} from "@/infrastructure/dynamodb/records";

describe("DynamoDB record mappers", () => {
  it("round-trips a coverage policy", () => {
    const record =
      toCoveragePolicyRecord(
        riversideCoveragePolicy,
      );

    expect(
      record.PK,
    ).toBe(
      "SCHOOL#school-riverside",
    );

    expect(
      record.SK,
    ).toBe(
      "POLICY#COVERAGE",
    );

    expect(
      fromCoveragePolicyRecord(
        record,
      ),
    ).toEqual(
      riversideCoveragePolicy,
    );
  });

  it("round-trips an absence case with its dashboard index", () => {
    const record =
      toAbsenceCaseRecord(
        scenarioBAbsence,
      );

    expect(
      record.PK,
    ).toBe(
      "CASE#case-scenario-b",
    );

    expect(
      record.SK,
    ).toBe(
      "META",
    );

    expect(
      record.GSI1PK,
    ).toBe(
      "SCHOOL#school-riverside",
    );

    expect(
      fromAbsenceCaseRecord(
        record,
      ),
    ).toEqual(
      scenarioBAbsence,
    );
  });

  it("round-trips a canonical coverage candidate", () => {
    const candidate =
      scenarioBCandidates[0];

    const record =
      toCoverageCandidateRecord(
        candidate,
      );

    expect(record.PK).toBe(
      `CANDIDATE#${candidate.id}`,
    );

    expect(record.SK).toBe(
      "META",
    );

    expect(
      record.entityType,
    ).toBe(
      "coverage_candidate",
    );

    expect(
      fromCoverageCandidateRecord(
        record,
      ),
    ).toEqual(
      candidate,
    );
  });

  it("round-trips a school-roster candidate mirror", () => {
    const candidate =
      scenarioBCandidates[0];

    const record =
      toSchoolCoverageCandidateRecord(
        candidate,
      );

    expect(record.PK).toBe(
      `SCHOOL#${candidate.schoolId}`,
    );

    expect(record.SK).toBe(
      `CANDIDATE#${candidate.id}`,
    );

    expect(
      record.entityType,
    ).toBe(
      "school_coverage_candidate",
    );

    expect(
      fromSchoolCoverageCandidateRecord(
        record,
      ),
    ).toEqual(
      candidate,
    );
  });

  it("rejects an unsupported schema version", () => {
    const record =
      toCoveragePolicyRecord(
        riversideCoveragePolicy,
      );

    expect(() =>
      fromCoveragePolicyRecord({
        ...record,
        schemaVersion: 2,
      }),
    ).toThrow();
  });

  it("rejects a domain record stored under the wrong physical key", () => {
    const record =
      toAbsenceCaseRecord(
        scenarioBAbsence,
      );

    expect(() =>
      fromAbsenceCaseRecord({
        ...record,

        PK:
          "CASE#some-other-case",
      }),
    ).toThrow(
      /key does not match/i,
    );
  });

  it("creates a versioned temporary smoke record", () => {
    const record =
      createSmokeRecord(
        "smoke-123",
        new Date(
          "2026-09-14T06:00:00.000Z",
        ),
      );

    expect(record).toEqual({
      PK:
        "SYSTEM#SMOKE#smoke-123",

      SK:
        "META",

      entityType:
        "system_smoke",

      schemaVersion:
        1,

      nonce:
        "smoke-123",

      createdAt:
        "2026-09-14T06:00:00.000Z",
    });
  });

  it("round-trips a canonical coverage offer", () => {
  const offer = {
    id:
      "offer-test-123",

    caseId:
      scenarioBAbsence.id,

    candidateId:
      scenarioBCandidates[0].id,

    periodIds: [
      "P2",
      "P3",
    ] as const,

    status:
      "pending" as const,

    createdAt:
      "2026-09-14T05:55:00.000Z",

    expiresAt:
      "2026-09-14T06:15:00.000Z",
  };

  const record =
    toCoverageOfferRecord(
      offer,
    );

  expect(record).toMatchObject({
    PK:
      "CASE#case-scenario-b",

    SK:
      "OFFER#offer-test-123",

    entityType:
      "coverage_offer",
  });

  expect(
    fromCoverageOfferRecord(
      record,
    ),
  ).toEqual(
    offer,
  );
});

it("builds and validates the immutable offer lookup", () => {
  const offer = {
    id:
      "offer-test-123",

    caseId:
      scenarioBAbsence.id,

    candidateId:
      scenarioBCandidates[0].id,

    periodIds: [
      "P2",
    ] as const,

    status:
      "pending" as const,

    createdAt:
      "2026-09-14T05:55:00.000Z",

    expiresAt:
      "2026-09-14T06:15:00.000Z",
  };

  const lookup =
    toOfferLookupRecord(
      offer,
    );

  expect(lookup).toEqual({
    PK:
      "LOOKUP#OFFER#offer-test-123",

    SK:
      "META",

    entityType:
      "offer_lookup",

    schemaVersion:
      1,

    offerId:
      "offer-test-123",

    caseId:
      scenarioBAbsence.id,

    targetPK:
      "CASE#case-scenario-b",

    targetSK:
      "OFFER#offer-test-123",
  });

  expect(
    fromOfferLookupRecord(
      lookup,
    ),
  ).toEqual(
    lookup,
  );
});

it("rejects a corrupted offer lookup target", () => {
  const offer = {
    id:
      "offer-test-123",

    caseId:
      scenarioBAbsence.id,

    candidateId:
      scenarioBCandidates[0].id,

    periodIds: [
      "P2",
    ] as const,

    status:
      "pending" as const,

    createdAt:
      "2026-09-14T05:55:00.000Z",

    expiresAt:
      "2026-09-14T06:15:00.000Z",
  };

  const lookup =
    toOfferLookupRecord(
      offer,
    );

  expect(() =>
    fromOfferLookupRecord({
      ...lookup,

      targetPK:
        "CASE#wrong-case",
    }),
  ).toThrow(
    /lookup target/i,
  );
});

it("round-trips an approved human decision", () => {
  const decision = {
    id:
      "decision-test-123",

    caseId:
      scenarioBAbsence.id,

    kind:
      "request_external_substitute" as const,

    status:
      "approved" as const,

    periodIds: [
      "P5",
    ] as const,

    summary:
      "Request an external substitute for P5.",

    requestedAt:
      "2026-09-14T06:10:00.000Z",

    decidedAt:
      "2026-09-14T06:10:00.000Z",

    decidedBy:
      "administrator-demo",
  };

  const record =
    toHumanDecisionRecord(
      decision,
    );

  expect(record).toMatchObject({
    PK:
      "CASE#case-scenario-b",

    SK:
      "DECISION#decision-test-123",

    entityType:
      "human_decision",
  });

  expect(
    fromHumanDecisionRecord(
      record,
    ),
  ).toEqual(
    decision,
  );
});

it("preserves candidate binding for protected-planning decisions", () => {
  const decision = {
    id:
      "decision-protected-123",

    caseId:
      scenarioBAbsence.id,

    kind:
      "use_protected_planning_period" as const,

    status:
      "approved" as const,

    periodIds: [
      "P5",
    ] as const,

    candidateId:
      "candidate-ms-taylor",

    summary:
      "Use Ms. Taylor's protected planning period for P5.",

    requestedAt:
      "2026-09-14T06:10:00.000Z",

    decidedAt:
      "2026-09-14T06:10:00.000Z",

    decidedBy:
      "administrator-demo",
  };

  expect(
    fromHumanDecisionRecord(
      toHumanDecisionRecord(
        decision,
      ),
    ),
  ).toEqual(
    decision,
  );
});

it("builds and validates the immutable decision lookup", () => {
  const decision = {
    id:
      "decision-test-123",

    caseId:
      scenarioBAbsence.id,

    kind:
      "request_external_substitute" as const,

    status:
      "approved" as const,

    periodIds: [
      "P5",
    ] as const,

    summary:
      "Request an external substitute for P5.",

    requestedAt:
      "2026-09-14T06:10:00.000Z",

    decidedAt:
      "2026-09-14T06:10:00.000Z",

    decidedBy:
      "administrator-demo",
  };

  const lookup =
    toDecisionLookupRecord(
      decision,
    );

  expect(lookup).toEqual({
    PK:
      "LOOKUP#DECISION#decision-test-123",

    SK:
      "META",

    entityType:
      "decision_lookup",

    schemaVersion:
      1,

    decisionId:
      "decision-test-123",

    caseId:
      scenarioBAbsence.id,

    targetPK:
      "CASE#case-scenario-b",

    targetSK:
      "DECISION#decision-test-123",
  });

  expect(
    fromDecisionLookupRecord(
      lookup,
    ),
  ).toEqual(
    lookup,
  );

  expect(() =>
    fromDecisionLookupRecord({
      ...lookup,

      targetSK:
        "DECISION#wrong-decision",
    }),
  ).toThrow(
    /lookup target/i,
  );
});

it("round-trips a complete activity event", () => {
  const event = {
    eventId:
      "activity-test-123",

    caseId:
      scenarioBAbsence.id,

    timestamp:
      "2026-09-14T06:10:00.000Z",

    actorType:
      "administrator" as const,

    action:
      "human_exception_decision_approved",

    toolName:
      "request_exception_decision",

    status:
      "succeeded" as const,

    summary:
      "Administrator approved an external substitute for P5.",

    durationMs:
      42,

    correlationId:
      "correlation-test-123",
  };

  const record =
    toActivityEventRecord(
      event,
    );

  expect(record).toMatchObject({
    PK:
      "CASE#case-scenario-b",

    SK:
      "ACTIVITY#activity-test-123",

    entityType:
      "activity_event",
  });

  expect(
    fromActivityEventRecord(
      record,
    ),
  ).toEqual(
    event,
  );
});

it("round-trips a canonical coverage assignment", () => {
  const assignment = {
    id:
      "assignment-test-123",

    caseId:
      scenarioBAbsence.id,

    candidateId:
      scenarioBCandidates[0].id,

    periodIds: [
      "P2",
      "P3",
    ] as const,

    source:
      "accepted_offer" as const,

    offerId:
      "offer-test-123",

    createdAt:
      "2026-09-14T06:00:00.000Z",
  };

  const record =
    toCoverageAssignmentRecord(
      assignment,
      "2026-09-14",
    );

  expect(record).toMatchObject({
    PK:
      "CASE#case-scenario-b",

    SK:
      "ASSIGNMENT#assignment-test-123",

    entityType:
      "coverage_assignment",

    date:
      "2026-09-14",
  });

  expect(
    fromCoverageAssignmentRecord(
      record,
    ),
  ).toEqual(
    assignment,
  );
});

it("round-trips the date-scoped candidate assignment mirror", () => {
  const assignment = {
    id:
      "assignment-test-123",

    caseId:
      scenarioBAbsence.id,

    candidateId:
      scenarioBCandidates[0].id,

    periodIds: [
      "P2",
    ] as const,

    source:
      "approved_exception" as const,

    decisionId:
      "decision-test-123",

    createdAt:
      "2026-09-14T06:00:00.000Z",
  };

  const record =
    toCandidateAssignmentRecord(
      assignment,
      "2026-09-14",
    );

  expect(record).toMatchObject({
    PK:
      `CANDIDATE#${scenarioBCandidates[0].id}`,

    SK:
      "ASSIGNMENT#2026-09-14#assignment-test-123",

    entityType:
      "candidate_assignment",
  });

  expect(
    fromCandidateAssignmentRecord(
      record,
    ),
  ).toEqual(
    assignment,
  );
});

it("builds and validates the immutable assignment lookup", () => {
  const assignment = {
    id:
      "assignment-test-123",

    caseId:
      scenarioBAbsence.id,

    candidateId:
      scenarioBCandidates[0].id,

    periodIds: [
      "P2",
    ] as const,

    source:
      "accepted_offer" as const,

    offerId:
      "offer-test-123",

    createdAt:
      "2026-09-14T06:00:00.000Z",
  };

  const lookup =
    toAssignmentLookupRecord(
      assignment,
    );

  expect(lookup).toEqual({
    PK:
      "LOOKUP#ASSIGNMENT#assignment-test-123",

    SK:
      "META",

    entityType:
      "assignment_lookup",

    schemaVersion:
      1,

    assignmentId:
      "assignment-test-123",

    caseId:
      scenarioBAbsence.id,

    candidateId:
      scenarioBCandidates[0].id,

    targetPK:
      "CASE#case-scenario-b",

    targetSK:
      "ASSIGNMENT#assignment-test-123",
  });

  expect(
    fromAssignmentLookupRecord(
      lookup,
    ),
  ).toEqual(
    lookup,
  );

  expect(() =>
    fromAssignmentLookupRecord({
      ...lookup,

      targetPK:
        "CASE#wrong-case",
    }),
  ).toThrow(
    /lookup target/i,
  );
});

it("builds distinct case and candidate period locks", () => {
  const assignment = {
    id:
      "assignment-test-123",

    caseId:
      scenarioBAbsence.id,

    candidateId:
      scenarioBCandidates[0].id,

    periodIds: [
      "P5",
    ] as const,

    source:
      "approved_exception" as const,

    decisionId:
      "decision-test-123",

    createdAt:
      "2026-09-14T06:00:00.000Z",
  };

  const caseLock =
    toCasePeriodLockRecord(
      assignment,
      "2026-09-14",
      "P5",
    );

  const candidateLock =
    toCandidatePeriodLockRecord(
      assignment,
      "2026-09-14",
      "P5",
    );

  expect(caseLock).toMatchObject({
    PK:
      "CASE#case-scenario-b",

    SK:
      "LOCK#PERIOD#P5",

    periodId:
      "P5",
  });

  expect(candidateLock).toMatchObject({
    PK:
      `CANDIDATE#${scenarioBCandidates[0].id}`,

    SK:
      "LOCK#2026-09-14#P5",

    periodId:
      "P5",
  });

  expect(
    fromCasePeriodLockRecord(
      caseLock,
    ),
  ).toEqual(
    caseLock,
  );

  expect(
    fromCandidatePeriodLockRecord(
      candidateLock,
    ),
  ).toEqual(
    candidateLock,
  );
});

it("creates and validates the candidate-date BeforeBell capacity record", () => {
  const record =
    createCandidateCapacityRecord(
      scenarioBCandidates[0].id,
      "2026-09-14",
      3,
    );

  expect(record).toEqual({
    PK:
      `CANDIDATE#${scenarioBCandidates[0].id}`,

    SK:
      "CAPACITY#2026-09-14",

    entityType:
      "candidate_capacity",

    schemaVersion:
      1,

    candidateId:
      scenarioBCandidates[0].id,

    date:
      "2026-09-14",

    beforeBellAssignedPeriodCount:
      3,
  });

  expect(
    parseCandidateCapacityRecord(
      record,
    ),
  ).toEqual(
    record,
  );

  expect(() =>
    parseCandidateCapacityRecord({
      ...record,

      SK:
        "CAPACITY#2026-09-15",
    }),
  ).toThrow(
    /key does not match/i,
  );
});
});