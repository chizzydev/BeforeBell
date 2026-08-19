import type {
  DynamoDBDocumentClient,
  TransactWriteCommandInput,
} from "@aws-sdk/lib-dynamodb";

import {
  GetCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";

import type {
  AbsenceCase,
  CoverageAssignment,
  CoverageCandidate,
  CoveragePolicy,
} from "@/domain/types";

import {
  dynamoKeys,
} from "@/infrastructure/dynamodb/keys";

import {
  fromAbsenceCaseRecord,
  fromCoverageCandidateRecord,
  fromCoveragePolicyRecord,
  parseCandidateCapacityRecord,
  toAssignmentLookupRecord,
  toCandidateAssignmentRecord,
  toCandidatePeriodLockRecord,
  toCasePeriodLockRecord,
  toCoverageAssignmentRecord,
} from "@/infrastructure/dynamodb/records";

type DynamoDocumentClientLike =
  Pick<
    DynamoDBDocumentClient,
    "send"
  >;

export interface PutAssignmentAtomicallyInput {
  documentClient:
    DynamoDocumentClientLike;

  tableName:
    string;

  assignment:
    CoverageAssignment;

  absenceCase:
    AbsenceCase;

  candidate?:
    CoverageCandidate;

  policy:
    CoveragePolicy;
}

const MAX_TRANSACTION_ATTEMPTS =
  3;

function isTransactionCanceled(
  error: unknown,
): boolean {
  return (
    typeof error ===
      "object" &&
    error !== null &&
    "name" in error &&
    error.name ===
      "TransactionCanceledException"
  );
}

function cancellationCodes(
  error: unknown,
): string[] {
  if (
    typeof error !==
      "object" ||
    error === null
  ) {
    return [];
  }

  const reasons =
    (
      error as {
        CancellationReasons?:
          unknown;
      }
    ).CancellationReasons;

  if (
    !Array.isArray(
      reasons,
    )
  ) {
    return [];
  }

  return reasons.flatMap(
    (reason) => {
      if (
        typeof reason !==
          "object" ||
        reason === null ||
        !(
          "Code" in
          reason
        ) ||
        typeof reason.Code !==
          "string"
      ) {
        return [];
      }

      return [
        reason.Code,
      ];
    },
  );
}

function hasConditionalFailure(
  error: unknown,
): boolean {
  return cancellationCodes(
    error,
  ).includes(
    "ConditionalCheckFailed",
  );
}

function hasTransactionConflict(
  error: unknown,
): boolean {
  return cancellationCodes(
    error,
  ).includes(
    "TransactionConflict",
  );
}

function sleep(
  milliseconds: number,
): Promise<void> {
  return new Promise(
    (resolve) => {
      setTimeout(
        resolve,
        milliseconds,
      );
    },
  );
}

function periodsAreUnique(
  assignment:
    CoverageAssignment,
): boolean {
  return (
    new Set(
      assignment.periodIds,
    ).size ===
    assignment.periodIds.length
  );
}

function caseStillAllowsAssignment(
  absenceCase:
    AbsenceCase,
  assignment:
    CoverageAssignment,
): boolean {
  if (
    absenceCase.id !==
      assignment.caseId
  ) {
    return false;
  }

  if (
    absenceCase.status ===
      "resolved" ||
    absenceCase.status ===
      "closed"
  ) {
    return false;
  }

  return assignment.periodIds.every(
    (periodId) =>
      absenceCase
        .affectedPeriods
        .includes(
          periodId,
        ),
  );
}

function candidateStillAllowsAssignment(
  candidate:
    CoverageCandidate | undefined,
  absenceCase:
    AbsenceCase,
  assignment:
    CoverageAssignment,
  policy:
    CoveragePolicy,
): boolean {
  /**
   * Accepted offers always represent an internal coverage candidate.
   */
  if (
    assignment.source ===
      "accepted_offer" &&
    !candidate
  ) {
    return false;
  }

  /**
   * Approved exceptions may represent an external substitute that does not
   * have a canonical internal candidate record.
   */
  if (!candidate) {
    return true;
  }

  if (
    !candidate.active ||
    candidate.schoolId !==
      absenceCase.schoolId
  ) {
    return false;
  }

  for (
    const periodId of
    assignment.periodIds
  ) {
    if (
      !candidate
        .availablePeriods
        .includes(
          periodId,
        )
    ) {
      return false;
    }

    if (
      candidate
        .conflictingPeriods
        .includes(
          periodId,
        )
    ) {
      return false;
    }

    /**
     * Protected planning is forbidden for routine accepted-offer coverage
     * when policy requires human approval.
     *
     * approved_exception is intentionally allowed through this check because
     * its human decision has already occurred in the application layer.
     */
    if (
      assignment.source ===
        "accepted_offer" &&
      policy
        .protectedPlanningRequiresApproval &&
      candidate
        .protectedPlanningPeriods
        .includes(
          periodId,
        )
    ) {
      return false;
    }
  }

  return true;
}

function candidateBaseline(
  candidate:
    CoverageCandidate | undefined,
): number {
  return (
    candidate
      ?.dailyCoverageCount ??
    0
  );
}

function buildCaseConditionCheck(
  tableName: string,
  absenceCase:
    AbsenceCase,
  assignment:
    CoverageAssignment,
) {
  const names:
    Record<
      string,
      string
    > = {
      "#status":
        "status",

      "#schoolId":
        "schoolId",

      "#date":
        "date",

      "#affectedPeriods":
        "affectedPeriods",
    };

  const values:
    Record<
      string,
      string | number | boolean
    > = {
      ":resolved":
        "resolved",

      ":closed":
        "closed",

      ":schoolId":
        absenceCase.schoolId,

      ":date":
        absenceCase.date,
    };

  const periodConditions =
    assignment.periodIds.map(
      (
        periodId,
        index,
      ) => {
        const placeholder =
          `:period${index}`;

        values[
          placeholder
        ] =
          periodId;

        return `contains(#affectedPeriods, ${placeholder})`;
      },
    );

  return {
    ConditionCheck: {
      TableName:
        tableName,

      Key:
        dynamoKeys.caseMeta(
          absenceCase.id,
        ),

      ConditionExpression: [
        "attribute_exists(PK)",
        "#status <> :resolved",
        "#status <> :closed",
        "#schoolId = :schoolId",
        "#date = :date",
        ...periodConditions,
      ].join(
        " AND ",
      ),

      ExpressionAttributeNames:
        names,

      ExpressionAttributeValues:
        values,
    },
  };
}

function buildCandidateConditionCheck(
  tableName: string,
  absenceCase:
    AbsenceCase,
  assignment:
    CoverageAssignment,
  candidate:
    CoverageCandidate | undefined,
  policy:
    CoveragePolicy,
) {
  const key =
    dynamoKeys.candidateMeta(
      assignment.candidateId,
    );

  if (!candidate) {
    return {
      ConditionCheck: {
        TableName:
          tableName,

        Key:
          key,

        ConditionExpression:
          "attribute_not_exists(PK)",
      },
    };
  }

  const names:
    Record<
      string,
      string
    > = {
      "#active":
        "active",

      "#schoolId":
        "schoolId",

      "#dailyCoverageCount":
        "dailyCoverageCount",

      "#availablePeriods":
        "availablePeriods",

      "#conflictingPeriods":
        "conflictingPeriods",

      "#protectedPlanningPeriods":
        "protectedPlanningPeriods",
    };

  const values:
    Record<
      string,
      string | number | boolean
    > = {
      ":active":
        true,

      ":schoolId":
        absenceCase.schoolId,

      ":baseline":
        candidate.dailyCoverageCount,
    };

  const periodConditions:
    string[] = [];

  assignment.periodIds.forEach(
    (
      periodId,
      index,
    ) => {
      const placeholder =
        `:candidatePeriod${index}`;

      values[
        placeholder
      ] =
        periodId;

      periodConditions.push(
        `contains(#availablePeriods, ${placeholder})`,
      );

      periodConditions.push(
        `NOT contains(#conflictingPeriods, ${placeholder})`,
      );

      if (
        assignment.source ===
          "accepted_offer" &&
        policy
          .protectedPlanningRequiresApproval
      ) {
        periodConditions.push(
          `NOT contains(#protectedPlanningPeriods, ${placeholder})`,
        );
      }
    },
  );

  return {
    ConditionCheck: {
      TableName:
        tableName,

      Key:
        key,

      ConditionExpression: [
        "attribute_exists(PK)",
        "#active = :active",
        "#schoolId = :schoolId",
        "#dailyCoverageCount = :baseline",
        ...periodConditions,
      ].join(
        " AND ",
      ),

      ExpressionAttributeNames:
        names,

      ExpressionAttributeValues:
        values,
    },
  };
}

function buildPolicyConditionCheck(
  tableName: string,
  policy:
    CoveragePolicy,
) {
  return {
    ConditionCheck: {
      TableName:
        tableName,

      Key:
        dynamoKeys.coveragePolicy(
          policy.schoolId,
        ),

      ConditionExpression: [
        "attribute_exists(PK)",
        "#maxDailyCoveragePeriods = :maxDailyCoveragePeriods",
        "#protectedPlanningRequiresApproval = :protectedPlanningRequiresApproval",
      ].join(
        " AND ",
      ),

      ExpressionAttributeNames: {
        "#maxDailyCoveragePeriods":
          "maxDailyCoveragePeriods",

        "#protectedPlanningRequiresApproval":
          "protectedPlanningRequiresApproval",
      },

      ExpressionAttributeValues: {
        ":maxDailyCoveragePeriods":
          policy.maxDailyCoveragePeriods,

        ":protectedPlanningRequiresApproval":
          policy
            .protectedPlanningRequiresApproval,
      },
    },
  };
}

export function buildAssignmentTransaction(
  input:
    Omit<
      PutAssignmentAtomicallyInput,
      "documentClient"
    >,
): NonNullable<
  TransactWriteCommandInput[
    "TransactItems"
  ]
> {
  const {
    tableName,
    assignment,
    absenceCase,
    candidate,
    policy,
  } =
    input;

  const date =
    absenceCase.date;

  const increment =
    assignment.periodIds.length;

  const baseline =
    candidateBaseline(
      candidate,
    );

  const maximumBeforeBellCountBeforeIncrement =
    policy
      .maxDailyCoveragePeriods -
    baseline -
    increment;

  if (
    maximumBeforeBellCountBeforeIncrement <
    0
  ) {
    throw new Error(
      "Assignment exceeds candidate daily capacity before the transaction can be constructed.",
    );
  }

  const canonical =
    toCoverageAssignmentRecord(
      assignment,
      date,
    );

  const lookup =
    toAssignmentLookupRecord(
      assignment,
    );

  const candidateMirror =
    toCandidateAssignmentRecord(
      assignment,
      date,
    );

  const transactItems:
    NonNullable<
      TransactWriteCommandInput[
        "TransactItems"
      ]
    > = [
      buildCaseConditionCheck(
        tableName,
        absenceCase,
        assignment,
      ),

      buildCandidateConditionCheck(
        tableName,
        absenceCase,
        assignment,
        candidate,
        policy,
      ),

      buildPolicyConditionCheck(
        tableName,
        policy,
      ),

      {
        Put: {
          TableName:
            tableName,

          Item:
            canonical,

          ConditionExpression:
            "attribute_not_exists(PK) AND attribute_not_exists(SK)",
        },
      },

      {
        Put: {
          TableName:
            tableName,

          Item:
            lookup,

          ConditionExpression:
            "attribute_not_exists(PK) AND attribute_not_exists(SK)",
        },
      },

      {
        Put: {
          TableName:
            tableName,

          Item:
            candidateMirror,

          ConditionExpression:
            "attribute_not_exists(PK) AND attribute_not_exists(SK)",
        },
      },
    ];

  for (
    const periodId of
    assignment.periodIds
  ) {
    transactItems.push({
      Put: {
        TableName:
          tableName,

        Item:
          toCasePeriodLockRecord(
            assignment,
            date,
            periodId,
          ),

        ConditionExpression:
          "attribute_not_exists(PK) AND attribute_not_exists(SK)",
      },
    });

    transactItems.push({
      Put: {
        TableName:
          tableName,

        Item:
          toCandidatePeriodLockRecord(
            assignment,
            date,
            periodId,
          ),

        ConditionExpression:
          "attribute_not_exists(PK) AND attribute_not_exists(SK)",
      },
    });
  }

  transactItems.push({
    Update: {
      TableName:
        tableName,

      Key:
        dynamoKeys.candidateCapacity(
          assignment.candidateId,
          date,
        ),

      UpdateExpression: [
        "SET",
        "#entityType = if_not_exists(#entityType, :entityType),",
        "#schemaVersion = if_not_exists(#schemaVersion, :schemaVersion),",
        "#candidateId = if_not_exists(#candidateId, :candidateId),",
        "#date = if_not_exists(#date, :date),",
        "#count = if_not_exists(#count, :zero) + :increment",
      ].join(
        " ",
      ),

      ConditionExpression: [
        "(attribute_not_exists(#entityType) OR #entityType = :entityType)",
        "(attribute_not_exists(#schemaVersion) OR #schemaVersion = :schemaVersion)",
        "(attribute_not_exists(#candidateId) OR #candidateId = :candidateId)",
        "(attribute_not_exists(#date) OR #date = :date)",
        "(attribute_not_exists(#count) OR (#count >= :zero AND #count <= :maximumBeforeIncrement))",
      ].join(
        " AND ",
      ),

      ExpressionAttributeNames: {
        "#entityType":
          "entityType",

        "#schemaVersion":
          "schemaVersion",

        "#candidateId":
          "candidateId",

        "#date":
          "date",

        "#count":
          "beforeBellAssignedPeriodCount",
      },

      ExpressionAttributeValues: {
        ":entityType":
          "candidate_capacity",

        ":schemaVersion":
          1,

        ":candidateId":
          assignment.candidateId,

        ":date":
          date,

        ":zero":
          0,

        ":increment":
          increment,

        ":maximumBeforeIncrement":
          maximumBeforeBellCountBeforeIncrement,
      },
    },
  });

  return transactItems;
}

async function getRawItem(
  documentClient:
    DynamoDocumentClientLike,
  tableName: string,
  key: {
    PK: string;
    SK: string;
  },
) {
  const result =
    await documentClient.send(
      new GetCommand({
        TableName:
          tableName,

        Key:
          key,

        ConsistentRead:
          true,
      }),
    );

  return result.Item;
}

async function observableBusinessConflict(
  input:
    PutAssignmentAtomicallyInput,
): Promise<boolean> {
  const {
    documentClient,
    tableName,
    assignment,
    absenceCase,
    candidate,
    policy,
  } =
    input;

  /**
   * Stable assignment ID already claimed.
   */
  const lookup =
    await getRawItem(
      documentClient,
      tableName,
      dynamoKeys.assignmentLookup(
        assignment.id,
      ),
    );

  if (lookup) {
    return true;
  }

  /**
   * Any requested case/candidate period lock proves a real business conflict.
   */
  for (
    const periodId of
    assignment.periodIds
  ) {
    const [
      caseLock,
      candidateLock,
    ] =
      await Promise.all([
        getRawItem(
          documentClient,
          tableName,
          dynamoKeys.casePeriodLock(
            assignment.caseId,
            periodId,
          ),
        ),

        getRawItem(
          documentClient,
          tableName,
          dynamoKeys.candidatePeriodLock(
            assignment.candidateId,
            absenceCase.date,
            periodId,
          ),
        ),
      ]);

    if (
      caseLock ||
      candidateLock
    ) {
      return true;
    }
  }

  /**
   * Recheck daily capacity from the authoritative counter.
   */
  const capacityItem =
    await getRawItem(
      documentClient,
      tableName,
      dynamoKeys.candidateCapacity(
        assignment.candidateId,
        absenceCase.date,
      ),
    );

  const beforeBellCount =
    capacityItem
      ? parseCandidateCapacityRecord(
          capacityItem,
        )
          .beforeBellAssignedPeriodCount
      : 0;

  if (
    candidateBaseline(
      candidate,
    ) +
      beforeBellCount +
      assignment.periodIds.length >
    policy.maxDailyCoveragePeriods
  ) {
    return true;
  }

  /**
   * Re-read the three authoritative configuration/state records to detect
   * a state change that invalidated one of our transaction ConditionChecks.
   */
  const [
    caseItem,
    candidateItem,
    policyItem,
  ] =
    await Promise.all([
      getRawItem(
        documentClient,
        tableName,
        dynamoKeys.caseMeta(
          absenceCase.id,
        ),
      ),

      getRawItem(
        documentClient,
        tableName,
        dynamoKeys.candidateMeta(
          assignment.candidateId,
        ),
      ),

      getRawItem(
        documentClient,
        tableName,
        dynamoKeys.coveragePolicy(
          absenceCase.schoolId,
        ),
      ),
    ]);

  if (
    !caseItem ||
    !policyItem
  ) {
    return true;
  }

  const currentCase =
    fromAbsenceCaseRecord(
      caseItem,
    );

  const currentPolicy =
    fromCoveragePolicyRecord(
      policyItem,
    );

  if (
    !caseStillAllowsAssignment(
      currentCase,
      assignment,
    ) ||
    currentCase.date !==
      absenceCase.date ||
    currentCase.schoolId !==
      absenceCase.schoolId
  ) {
    return true;
  }

  if (
    currentPolicy
      .maxDailyCoveragePeriods !==
      policy
        .maxDailyCoveragePeriods ||
    currentPolicy
      .protectedPlanningRequiresApproval !==
      policy
        .protectedPlanningRequiresApproval
  ) {
    return true;
  }

  const currentCandidate =
    candidateItem
      ? fromCoverageCandidateRecord(
          candidateItem,
        )
      : undefined;

  if (
    Boolean(
      currentCandidate,
    ) !==
    Boolean(
      candidate,
    )
  ) {
    return true;
  }

  if (
    currentCandidate &&
    candidate &&
    currentCandidate
      .dailyCoverageCount !==
      candidate
        .dailyCoverageCount
  ) {
    return true;
  }

  if (
    !candidateStillAllowsAssignment(
      currentCandidate,
      currentCase,
      assignment,
      currentPolicy,
    )
  ) {
    return true;
  }

  return false;
}

export async function putAssignmentAtomically(
  input:
    PutAssignmentAtomicallyInput,
): Promise<boolean> {
  const {
    assignment,
    absenceCase,
    candidate,
    policy,
  } =
    input;

  if (
    assignment.periodIds.length ===
    0
  ) {
    throw new Error(
      "Coverage assignment must contain at least one period.",
    );
  }

  if (
    !periodsAreUnique(
      assignment,
    )
  ) {
    throw new Error(
      "Coverage assignment cannot contain duplicate period IDs.",
    );
  }

  if (
    !caseStillAllowsAssignment(
      absenceCase,
      assignment,
    )
  ) {
    return false;
  }

  if (
    policy.schoolId !==
      absenceCase.schoolId
  ) {
    return false;
  }

  if (
    candidate &&
    candidate.id !==
      assignment.candidateId
  ) {
    return false;
  }

  if (
    !candidateStillAllowsAssignment(
      candidate,
      absenceCase,
      assignment,
      policy,
    )
  ) {
    return false;
  }

  const baseline =
    candidateBaseline(
      candidate,
    );

  if (
    baseline +
      assignment.periodIds.length >
    policy.maxDailyCoveragePeriods
  ) {
    return false;
  }

  const transactItems =
    buildAssignmentTransaction({
      tableName:
        input.tableName,

      assignment,
      absenceCase,
      candidate,
      policy,
    });

  for (
    let attempt = 1;
    attempt <=
    MAX_TRANSACTION_ATTEMPTS;
    attempt += 1
  ) {
    try {
      await input.documentClient.send(
        new TransactWriteCommand({
          TransactItems:
            transactItems,
        }),
      );

      return true;
    } catch (error) {
      if (
        !isTransactionCanceled(
          error,
        )
      ) {
        throw error;
      }

      /**
       * A failed DynamoDB condition represents a real state/uniqueness/
       * capacity conflict, not an infrastructure failure.
       */
      if (
        hasConditionalFailure(
          error,
        )
      ) {
        return false;
      }

      /**
       * Two disjoint assignments for the same candidate/day may temporarily
       * collide on the shared capacity counter. Retry that transient
       * transaction conflict instead of misreporting it as a business rule
       * failure.
       */
      if (
        hasTransactionConflict(
          error,
        ) &&
        attempt <
          MAX_TRANSACTION_ATTEMPTS
      ) {
        await sleep(
          attempt * 15,
        );

        continue;
      }

      /**
       * If cancellation reasons were omitted or the cancellation was not one
       * of the expected conditional outcomes, classify only conflicts that
       * can be proven from strongly consistent authoritative reads.
       */
      if (
        await observableBusinessConflict(
          input,
        )
      ) {
        return false;
      }

      throw error;
    }
  }

  throw new Error(
    "Assignment transaction exhausted its retry budget without a definitive outcome.",
  );
}