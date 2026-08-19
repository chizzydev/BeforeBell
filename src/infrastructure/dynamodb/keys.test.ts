import {
  describe,
  expect,
  it,
} from "vitest";

import {
  dynamoKeys,
} from "@/infrastructure/dynamodb/keys";

describe("dynamoKeys", () => {
  it("builds school policy and roster keys", () => {
    expect(
      dynamoKeys.coveragePolicy(
        "school-riverside",
      ),
    ).toEqual({
      PK:
        "SCHOOL#school-riverside",
      SK:
        "POLICY#COVERAGE",
    });

    expect(
      dynamoKeys.schoolCandidate(
        "school-riverside",
        "candidate-alex-johnson",
      ),
    ).toEqual({
      PK:
        "SCHOOL#school-riverside",
      SK:
        "CANDIDATE#candidate-alex-johnson",
    });
  });

  it("builds canonical candidate keys", () => {
    expect(
      dynamoKeys.candidateMeta(
        "candidate-alex-johnson",
      ),
    ).toEqual({
      PK:
        "CANDIDATE#candidate-alex-johnson",
      SK:
        "META",
    });
  });

  it("groups case entities under the case partition", () => {
    expect(
      dynamoKeys.caseMeta(
        "case-scenario-b",
      ),
    ).toEqual({
      PK:
        "CASE#case-scenario-b",
      SK:
        "META",
    });

    expect(
      dynamoKeys.caseOffer(
        "case-scenario-b",
        "offer-123",
      ).SK,
    ).toBe(
      "OFFER#offer-123",
    );

    expect(
      dynamoKeys.caseAssignment(
        "case-scenario-b",
        "assignment-123",
      ).SK,
    ).toBe(
      "ASSIGNMENT#assignment-123",
    );

    expect(
      dynamoKeys.caseDecision(
        "case-scenario-b",
        "decision-123",
      ).SK,
    ).toBe(
      "DECISION#decision-123",
    );

    expect(
      dynamoKeys.caseActivity(
        "case-scenario-b",
        "activity-123",
      ).SK,
    ).toBe(
      "ACTIVITY#activity-123",
    );
  });

  it("builds assignment concurrency guard keys", () => {
    expect(
      dynamoKeys.casePeriodLock(
        "case-scenario-b",
        "P5",
      ),
    ).toEqual({
      PK:
        "CASE#case-scenario-b",
      SK:
        "LOCK#PERIOD#P5",
    });

    expect(
      dynamoKeys.candidatePeriodLock(
        "candidate-ms-taylor",
        "2026-09-14",
        "P5",
      ),
    ).toEqual({
      PK:
        "CANDIDATE#candidate-ms-taylor",
      SK:
        "LOCK#2026-09-14#P5",
    });

    expect(
      dynamoKeys.candidateCapacity(
        "candidate-ms-taylor",
        "2026-09-14",
      ),
    ).toEqual({
      PK:
        "CANDIDATE#candidate-ms-taylor",
      SK:
        "CAPACITY#2026-09-14",
    });
  });

  it("builds immutable lookup keys", () => {
    expect(
      dynamoKeys.offerLookup(
        "offer-123",
      ),
    ).toEqual({
      PK:
        "LOOKUP#OFFER#offer-123",
      SK:
        "META",
    });

    expect(
      dynamoKeys.assignmentLookup(
        "assignment-123",
      ),
    ).toEqual({
      PK:
        "LOOKUP#ASSIGNMENT#assignment-123",
      SK:
        "META",
    });

    expect(
      dynamoKeys.decisionLookup(
        "decision-123",
      ),
    ).toEqual({
      PK:
        "LOOKUP#DECISION#decision-123",
      SK:
        "META",
    });
  });

  it("builds the school case-discovery GSI key", () => {
    expect(
      dynamoKeys.caseDashboardIndex(
        "school-riverside",
        "2026-09-14",
        "2026-09-14T05:50:00.000Z",
        "case-scenario-b",
      ),
    ).toEqual({
      GSI1PK:
        "SCHOOL#school-riverside",

      GSI1SK:
        "CASE#2026-09-14#2026-09-14T05:50:00.000Z#case-scenario-b",
    });
  });
});