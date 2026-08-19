import type {
  PeriodId,
} from "@/domain/types";

export interface DynamoKey {
  PK: string;
  SK: string;
}

export interface DynamoIndexKey {
  GSI1PK: string;
  GSI1SK: string;
}

function requireKeyPart(
  value: string,
  label: string,
): string {
  if (
    value.trim().length ===
    0
  ) {
    throw new Error(
      `${label} must not be empty.`,
    );
  }

  return value;
}

function schoolPk(
  schoolId: string,
): string {
  return `SCHOOL#${requireKeyPart(
    schoolId,
    "schoolId",
  )}`;
}

function casePk(
  caseId: string,
): string {
  return `CASE#${requireKeyPart(
    caseId,
    "caseId",
  )}`;
}

function candidatePk(
  candidateId: string,
): string {
  return `CANDIDATE#${requireKeyPart(
    candidateId,
    "candidateId",
  )}`;
}

export const dynamoKeys = {
  coveragePolicy(
    schoolId: string,
  ): DynamoKey {
    return {
      PK:
        schoolPk(
          schoolId,
        ),

      SK:
        "POLICY#COVERAGE",
    };
  },

  candidateMeta(
  candidateId: string,
): DynamoKey & {
  SK: "META";
} {
  return {
    PK:
      candidatePk(
        candidateId,
      ),

    SK:
      "META",
  };
},

  schoolCandidate(
    schoolId: string,
    candidateId: string,
  ): DynamoKey {
    return {
      PK:
        schoolPk(
          schoolId,
        ),

      SK:
        `CANDIDATE#${requireKeyPart(
          candidateId,
          "candidateId",
        )}`,
    };
  },

  caseMeta(
    caseId: string,
  ): DynamoKey {
    return {
      PK:
        casePk(
          caseId,
        ),

      SK:
        "META",
    };
  },

  caseOffer(
    caseId: string,
    offerId: string,
  ): DynamoKey {
    return {
      PK:
        casePk(
          caseId,
        ),

      SK:
        `OFFER#${requireKeyPart(
          offerId,
          "offerId",
        )}`,
    };
  },

  caseAssignment(
    caseId: string,
    assignmentId: string,
  ): DynamoKey {
    return {
      PK:
        casePk(
          caseId,
        ),

      SK:
        `ASSIGNMENT#${requireKeyPart(
          assignmentId,
          "assignmentId",
        )}`,
    };
  },

  caseDecision(
    caseId: string,
    decisionId: string,
  ): DynamoKey {
    return {
      PK:
        casePk(
          caseId,
        ),

      SK:
        `DECISION#${requireKeyPart(
          decisionId,
          "decisionId",
        )}`,
    };
  },

  caseActivity(
    caseId: string,
    eventId: string,
  ): DynamoKey {
    return {
      PK:
        casePk(
          caseId,
        ),

      SK:
        `ACTIVITY#${requireKeyPart(
          eventId,
          "eventId",
        )}`,
    };
  },

  casePeriodLock(
    caseId: string,
    periodId: PeriodId,
  ): DynamoKey {
    return {
      PK:
        casePk(
          caseId,
        ),

      SK:
        `LOCK#PERIOD#${periodId}`,
    };
  },

  candidateAssignment(
    candidateId: string,
    date: string,
    assignmentId: string,
  ): DynamoKey {
    return {
      PK:
        candidatePk(
          candidateId,
        ),

      SK:
        [
          "ASSIGNMENT",
          requireKeyPart(
            date,
            "date",
          ),
          requireKeyPart(
            assignmentId,
            "assignmentId",
          ),
        ].join("#"),
    };
  },

  candidatePeriodLock(
    candidateId: string,
    date: string,
    periodId: PeriodId,
  ): DynamoKey {
    return {
      PK:
        candidatePk(
          candidateId,
        ),

      SK:
        [
          "LOCK",
          requireKeyPart(
            date,
            "date",
          ),
          periodId,
        ].join("#"),
    };
  },

  candidateCapacity(
    candidateId: string,
    date: string,
  ): DynamoKey {
    return {
      PK:
        candidatePk(
          candidateId,
        ),

      SK:
        `CAPACITY#${requireKeyPart(
          date,
          "date",
        )}`,
    };
  },

  offerLookup(
  offerId: string,
): DynamoKey & {
  SK: "META";
} {
  return {
    PK:
      `LOOKUP#OFFER#${requireKeyPart(
        offerId,
        "offerId",
      )}`,

    SK:
      "META",
  };
},

  assignmentLookup(
  assignmentId: string,
): DynamoKey & {
  SK: "META";
} {
  return {
    PK:
      `LOOKUP#ASSIGNMENT#${requireKeyPart(
        assignmentId,
        "assignmentId",
      )}`,

    SK:
      "META",
  };
},

  decisionLookup(
  decisionId: string,
): DynamoKey & {
  SK: "META";
} {
  return {
    PK:
      `LOOKUP#DECISION#${requireKeyPart(
        decisionId,
        "decisionId",
      )}`,

    SK:
      "META",
  };
},

  caseDashboardIndex(
    schoolId: string,
    date: string,
    createdAt: string,
    caseId: string,
  ): DynamoIndexKey {
    return {
      GSI1PK:
        schoolPk(
          schoolId,
        ),

      GSI1SK:
        [
          "CASE",
          requireKeyPart(
            date,
            "date",
          ),
          requireKeyPart(
            createdAt,
            "createdAt",
          ),
          requireKeyPart(
            caseId,
            "caseId",
          ),
        ].join("#"),
    };
  },

  systemSmoke(
    nonce: string,
  ): DynamoKey {
    return {
      PK:
        `SYSTEM#SMOKE#${requireKeyPart(
          nonce,
          "nonce",
        )}`,

      SK:
        "META",
    };
  },
};