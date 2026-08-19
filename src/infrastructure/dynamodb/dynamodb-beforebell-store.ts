import type {
  DynamoDBDocumentClient,
  QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";

import {
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";

import type {
  BeforeBellStore,
} from "@/application/store/beforebell-store";

import type {
  AbsenceCase,
  AbsenceCaseStatus,
  ActivityEvent,
  CoverageAssignment,
  CoverageCandidate,
  CoverageOffer,
  CoverageOfferStatus,
  CoveragePolicy,
  HumanDecision,
} from "@/domain/types";

import {
  dynamoKeys,
} from "@/infrastructure/dynamodb/keys";

import {
  fromAbsenceCaseRecord,
  fromActivityEventRecord,
  fromCoverageCandidateRecord,
  fromCoverageOfferRecord,
  fromCoveragePolicyRecord,
  fromDecisionLookupRecord,
  fromHumanDecisionRecord,
  fromOfferLookupRecord,
  fromSchoolCoverageCandidateRecord,
  toAbsenceCaseRecord,
  toActivityEventRecord,
  toCoverageCandidateRecord,
  toCoverageOfferRecord,
  toCoveragePolicyRecord,
  toDecisionLookupRecord,
  toHumanDecisionRecord,
  toOfferLookupRecord,
  toSchoolCoverageCandidateRecord,
  fromAssignmentLookupRecord,
fromCandidateAssignmentRecord,
fromCoverageAssignmentRecord,
} from "@/infrastructure/dynamodb/records";

import {
  putAssignmentAtomically,
} from "@/infrastructure/dynamodb/assignment-write";

export type DynamoDocumentClientLike =
  Pick<
    DynamoDBDocumentClient,
    "send"
  >;

export type BeforeBellStore3D =
  BeforeBellStore;

export interface DynamoDbBeforeBellStoreOptions {
  documentClient:
    DynamoDocumentClientLike;

  tableName:
    string;
}

function isConditionalCheckFailed(
  error: unknown,
): boolean {
  return (
    typeof error ===
      "object" &&
    error !== null &&
    "name" in error &&
    error.name ===
      "ConditionalCheckFailedException"
  );
}

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

function requireTableName(
  tableName: string,
): string {
  const normalized =
    tableName.trim();

  if (
    normalized.length ===
    0
  ) {
    throw new Error(
      "DynamoDB table name must not be empty.",
    );
  }

  return normalized;
}

function samePeriodSet(
  left:
    readonly string[],
  right:
    readonly string[],
): boolean {
  if (
    left.length !==
    right.length
  ) {
    return false;
  }

  const leftSet =
    new Set(left);

  return right.every(
    (periodId) =>
      leftSet.has(
        periodId,
      ),
  );
}

function sameOrderedValues(
  left:
    readonly string[],
  right:
    readonly string[],
): boolean {
  return (
    left.length ===
      right.length &&
    left.every(
      (
        value,
        index,
      ) =>
        value ===
        right[index],
    )
  );
}

function assignmentsEqual(
  left:
    CoverageAssignment,
  right:
    CoverageAssignment,
): boolean {
  return (
    left.id ===
      right.id &&
    left.caseId ===
      right.caseId &&
    left.candidateId ===
      right.candidateId &&
    sameOrderedValues(
      left.periodIds,
      right.periodIds,
    ) &&
    left.source ===
      right.source &&
    left.offerId ===
      right.offerId &&
    left.decisionId ===
      right.decisionId &&
    left.createdAt ===
      right.createdAt
  );
}

function activityEventsEqual(
  left: ActivityEvent,
  right: ActivityEvent,
): boolean {
  return (
    left.eventId ===
      right.eventId &&
    left.caseId ===
      right.caseId &&
    left.timestamp ===
      right.timestamp &&
    left.actorType ===
      right.actorType &&
    left.action ===
      right.action &&
    left.toolName ===
      right.toolName &&
    left.status ===
      right.status &&
    left.summary ===
      right.summary &&
    left.durationMs ===
      right.durationMs &&
    left.correlationId ===
      right.correlationId
  );
}

export class DynamoDbBeforeBellStore
implements BeforeBellStore {
  private readonly documentClient:
    DynamoDocumentClientLike;

  private readonly tableName:
    string;

  constructor(
    options:
      DynamoDbBeforeBellStoreOptions,
  ) {
    this.documentClient =
      options.documentClient;

    this.tableName =
      requireTableName(
        options.tableName,
      );
  }

  async getPolicy(
    schoolId: string,
  ): Promise<
    CoveragePolicy | undefined
  > {
    const result =
      await this.documentClient.send(
        new GetCommand({
          TableName:
            this.tableName,

          Key:
            dynamoKeys.coveragePolicy(
              schoolId,
            ),

          ConsistentRead:
            true,
        }),
      );

    if (!result.Item) {
      return undefined;
    }

    return fromCoveragePolicyRecord(
      result.Item,
    );
  }

  async putPolicy(
    policy: CoveragePolicy,
  ): Promise<void> {
    await this.documentClient.send(
      new PutCommand({
        TableName:
          this.tableName,

        Item:
          toCoveragePolicyRecord(
            policy,
          ),
      }),
    );
  }

  async getCase(
    caseId: string,
  ): Promise<
    AbsenceCase | undefined
  > {
    const result =
      await this.documentClient.send(
        new GetCommand({
          TableName:
            this.tableName,

          Key:
            dynamoKeys.caseMeta(
              caseId,
            ),

          ConsistentRead:
            true,
        }),
      );

    if (!result.Item) {
      return undefined;
    }

    return fromAbsenceCaseRecord(
      result.Item,
    );
  }

  async putCase(
    absenceCase:
      AbsenceCase,
  ): Promise<void> {
    await this.documentClient.send(
      new PutCommand({
        TableName:
          this.tableName,

        Item:
          toAbsenceCaseRecord(
            absenceCase,
          ),
      }),
    );
  }

  async updateCaseIfStatus(
    caseId: string,
    expectedStatus:
      AbsenceCaseStatus,
    nextCase:
      AbsenceCase,
  ): Promise<boolean> {
    if (
      nextCase.id !==
      caseId
    ) {
      throw new Error(
        "Conditional case update cannot change the authoritative case ID.",
      );
    }

    try {
      await this.documentClient.send(
        new PutCommand({
          TableName:
            this.tableName,

          Item:
            toAbsenceCaseRecord(
              nextCase,
            ),

          ConditionExpression:
            "#status = :expectedStatus",

          ExpressionAttributeNames: {
            "#status":
              "status",
          },

          ExpressionAttributeValues: {
            ":expectedStatus":
              expectedStatus,
          },
        }),
      );

      return true;
    } catch (error) {
      if (
        isConditionalCheckFailed(
          error,
        )
      ) {
        return false;
      }

      throw error;
    }
  }

  async getCandidate(
    candidateId: string,
  ): Promise<
    CoverageCandidate | undefined
  > {
    const result =
      await this.documentClient.send(
        new GetCommand({
          TableName:
            this.tableName,

          Key:
            dynamoKeys.candidateMeta(
              candidateId,
            ),

          ConsistentRead:
            true,
        }),
      );

    if (!result.Item) {
      return undefined;
    }

    return fromCoverageCandidateRecord(
      result.Item,
    );
  }

  async listCandidatesBySchool(
    schoolId: string,
  ): Promise<
    CoverageCandidate[]
  > {
    const candidates:
      CoverageCandidate[] = [];

    let exclusiveStartKey:
      QueryCommandInput[
        "ExclusiveStartKey"
      ];

    do {
      const result =
        await this.documentClient.send(
          new QueryCommand({
            TableName:
              this.tableName,

            KeyConditionExpression:
              "PK = :pk AND begins_with(SK, :candidatePrefix)",

            ExpressionAttributeValues: {
              ":pk":
                `SCHOOL#${schoolId}`,

              ":candidatePrefix":
                "CANDIDATE#",
            },

            ConsistentRead:
              true,

            ExclusiveStartKey:
              exclusiveStartKey,
          }),
        );

      for (
        const item of
        result.Items ?? []
      ) {
        candidates.push(
          fromSchoolCoverageCandidateRecord(
            item,
          ),
        );
      }

      exclusiveStartKey =
        result.LastEvaluatedKey;
    } while (
      exclusiveStartKey
    );

    return candidates.sort(
      (
        left,
        right,
      ) =>
        left.id.localeCompare(
          right.id,
        ),
    );
  }

  async putCandidate(
    candidate:
      CoverageCandidate,
  ): Promise<void> {
    const existing =
      await this.getCandidate(
        candidate.id,
      );

    if (
      existing &&
      existing.schoolId !==
        candidate.schoolId
    ) {
      throw new Error(
        "Coverage candidate schoolId cannot be changed through putCandidate.",
      );
    }

    await this.documentClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName:
                this.tableName,

              Item:
                toCoverageCandidateRecord(
                  candidate,
                ),
            },
          },
          {
            Put: {
              TableName:
                this.tableName,

              Item:
                toSchoolCoverageCandidateRecord(
                  candidate,
                ),
            },
          },
        ],
      }),
    );
  }

  private async getOfferLookup(
    offerId: string,
  ) {
    const result =
      await this.documentClient.send(
        new GetCommand({
          TableName:
            this.tableName,

          Key:
            dynamoKeys.offerLookup(
              offerId,
            ),

          ConsistentRead:
            true,
        }),
      );

    if (!result.Item) {
      return undefined;
    }

    return fromOfferLookupRecord(
      result.Item,
    );
  }

  async getOffer(
    offerId: string,
  ): Promise<
    CoverageOffer | undefined
  > {
    const lookup =
      await this.getOfferLookup(
        offerId,
      );

    if (!lookup) {
      return undefined;
    }

    const result =
      await this.documentClient.send(
        new GetCommand({
          TableName:
            this.tableName,

          Key: {
            PK:
              lookup.targetPK,

            SK:
              lookup.targetSK,
          },

          ConsistentRead:
            true,
        }),
      );

    if (!result.Item) {
      throw new Error(
        `Offer lookup ${offerId} points to a missing canonical offer record.`,
      );
    }

    const offer =
      fromCoverageOfferRecord(
        result.Item,
      );

    if (
      offer.id !==
        offerId ||
      offer.caseId !==
        lookup.caseId
    ) {
      throw new Error(
        "Offer lookup and canonical offer disagree about authoritative identity.",
      );
    }

    return offer;
  }

  async listOffersByCase(
    caseId: string,
  ): Promise<
    CoverageOffer[]
  > {
    const offers:
      CoverageOffer[] = [];

    let exclusiveStartKey:
      QueryCommandInput[
        "ExclusiveStartKey"
      ];

    do {
      const result =
        await this.documentClient.send(
          new QueryCommand({
            TableName:
              this.tableName,

            KeyConditionExpression:
              "PK = :pk AND begins_with(SK, :offerPrefix)",

            ExpressionAttributeValues: {
              ":pk":
                `CASE#${caseId}`,

              ":offerPrefix":
                "OFFER#",
            },

            ConsistentRead:
              true,

            ExclusiveStartKey:
              exclusiveStartKey,
          }),
        );

      for (
        const item of
        result.Items ?? []
      ) {
        offers.push(
          fromCoverageOfferRecord(
            item,
          ),
        );
      }

      exclusiveStartKey =
        result.LastEvaluatedKey;
    } while (
      exclusiveStartKey
    );

    return offers.sort(
      (
        left,
        right,
      ) =>
        left.createdAt.localeCompare(
          right.createdAt,
        ) ||
        left.id.localeCompare(
          right.id,
        ),
    );
  }

  async putOffer(
    offer:
      CoverageOffer,
  ): Promise<void> {
    const existing =
      await this.getOffer(
        offer.id,
      );

    if (
      existing &&
      existing.caseId !==
        offer.caseId
    ) {
      throw new Error(
        "Coverage offer caseId cannot be changed through putOffer.",
      );
    }

    await this.documentClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName:
                this.tableName,

              Item:
                toCoverageOfferRecord(
                  offer,
                ),
            },
          },
          {
            Put: {
              TableName:
                this.tableName,

              Item:
                toOfferLookupRecord(
                  offer,
                ),
            },
          },
        ],
      }),
    );
  }

  async putOfferIfAbsent(
    offer:
      CoverageOffer,
  ): Promise<boolean> {
    const canonical =
      toCoverageOfferRecord(
        offer,
      );

    const lookup =
      toOfferLookupRecord(
        offer,
      );

    try {
      await this.documentClient.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName:
                  this.tableName,

                Item:
                  canonical,

                ConditionExpression:
                  "attribute_not_exists(PK) AND attribute_not_exists(SK)",
              },
            },
            {
              Put: {
                TableName:
                  this.tableName,

                Item:
                  lookup,

                ConditionExpression:
                  "attribute_not_exists(PK) AND attribute_not_exists(SK)",
              },
            },
          ],
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

      const [
        canonicalResult,
        lookupResult,
      ] = await Promise.all([
        this.documentClient.send(
          new GetCommand({
            TableName:
              this.tableName,

            Key: {
              PK:
                canonical.PK,

              SK:
                canonical.SK,
            },

            ConsistentRead:
              true,
          }),
        ),

        this.documentClient.send(
          new GetCommand({
            TableName:
              this.tableName,

            Key: {
              PK:
                lookup.PK,

              SK:
                lookup.SK,
            },

            ConsistentRead:
              true,
          }),
        ),
      ]);

      if (
        canonicalResult.Item ||
        lookupResult.Item
      ) {
        return false;
      }

      throw error;
    }
  }

  async updateOfferIfStatus(
    offerId: string,
    expectedStatus:
      CoverageOfferStatus,
    nextOffer:
      CoverageOffer,
  ): Promise<boolean> {
    if (
      nextOffer.id !==
      offerId
    ) {
      throw new Error(
        "Conditional offer update cannot change the authoritative offer ID.",
      );
    }

    const current =
      await this.getOffer(
        offerId,
      );

    if (!current) {
      return false;
    }

    if (
      current.caseId !==
        nextOffer.caseId
    ) {
      throw new Error(
        "Conditional offer update cannot change caseId.",
      );
    }

    if (
      current.candidateId !==
        nextOffer.candidateId
    ) {
      throw new Error(
        "Conditional offer update cannot change candidateId.",
      );
    }

    if (
      !samePeriodSet(
        current.periodIds,
        nextOffer.periodIds,
      )
    ) {
      throw new Error(
        "Conditional offer update cannot change coverage periods.",
      );
    }

    if (
      current.createdAt !==
        nextOffer.createdAt ||
      current.expiresAt !==
        nextOffer.expiresAt
    ) {
      throw new Error(
        "Conditional offer update cannot rewrite creation or expiration identity.",
      );
    }

    try {
      await this.documentClient.send(
        new PutCommand({
          TableName:
            this.tableName,

          Item:
            toCoverageOfferRecord(
              nextOffer,
            ),

          ConditionExpression:
            "#status = :expectedStatus",

          ExpressionAttributeNames: {
            "#status":
              "status",
          },

          ExpressionAttributeValues: {
            ":expectedStatus":
              expectedStatus,
          },
        }),
      );

      return true;
    } catch (error) {
      if (
        isConditionalCheckFailed(
          error,
        )
      ) {
        return false;
      }

      throw error;
    }
  }

private async getAssignmentLookup(
  assignmentId: string,
) {
  const result =
    await this.documentClient.send(
      new GetCommand({
        TableName:
          this.tableName,

        Key:
          dynamoKeys.assignmentLookup(
            assignmentId,
          ),

        ConsistentRead:
          true,
      }),
    );

  if (!result.Item) {
    return undefined;
  }

  return fromAssignmentLookupRecord(
    result.Item,
  );
}

async getAssignment(
  assignmentId: string,
): Promise<
  CoverageAssignment | undefined
> {
  const lookup =
    await this.getAssignmentLookup(
      assignmentId,
    );

  if (!lookup) {
    return undefined;
  }

  const result =
    await this.documentClient.send(
      new GetCommand({
        TableName:
          this.tableName,

        Key: {
          PK:
            lookup.targetPK,

          SK:
            lookup.targetSK,
        },

        ConsistentRead:
          true,
      }),
    );

  if (!result.Item) {
    throw new Error(
      `Assignment lookup ${assignmentId} points to a missing canonical assignment record.`,
    );
  }

  const assignment =
    fromCoverageAssignmentRecord(
      result.Item,
    );

  if (
    assignment.id !==
      assignmentId ||
    assignment.caseId !==
      lookup.caseId ||
    assignment.candidateId !==
      lookup.candidateId
  ) {
    throw new Error(
      "Assignment lookup and canonical assignment disagree about authoritative identity.",
    );
  }

  return assignment;
}

async listAssignmentsByCase(
  caseId: string,
): Promise<
  CoverageAssignment[]
> {
  const assignments:
    CoverageAssignment[] = [];

  let exclusiveStartKey:
    QueryCommandInput[
      "ExclusiveStartKey"
    ];

  do {
    const result =
      await this.documentClient.send(
        new QueryCommand({
          TableName:
            this.tableName,

          KeyConditionExpression:
            "PK = :pk AND begins_with(SK, :assignmentPrefix)",

          ExpressionAttributeValues: {
            ":pk":
              `CASE#${caseId}`,

            ":assignmentPrefix":
              "ASSIGNMENT#",
          },

          ConsistentRead:
            true,

          ExclusiveStartKey:
            exclusiveStartKey,
        }),
      );

    for (
      const item of
      result.Items ?? []
    ) {
      assignments.push(
        fromCoverageAssignmentRecord(
          item,
        ),
      );
    }

    exclusiveStartKey =
      result.LastEvaluatedKey;
  } while (
    exclusiveStartKey
  );

  return assignments.sort(
    (
      left,
      right,
    ) =>
      left.createdAt.localeCompare(
        right.createdAt,
      ) ||
      left.id.localeCompare(
        right.id,
      ),
  );
}

async listAssignmentsByCandidate(
  candidateId: string,
  date?: string,
): Promise<
  CoverageAssignment[]
> {
  const assignments:
    CoverageAssignment[] = [];

  const assignmentPrefix =
    date
      ? `ASSIGNMENT#${date}#`
      : "ASSIGNMENT#";

  let exclusiveStartKey:
    QueryCommandInput[
      "ExclusiveStartKey"
    ];

  do {
    const result =
      await this.documentClient.send(
        new QueryCommand({
          TableName:
            this.tableName,

          KeyConditionExpression:
            "PK = :pk AND begins_with(SK, :assignmentPrefix)",

          ExpressionAttributeValues: {
            ":pk":
              `CANDIDATE#${candidateId}`,

            ":assignmentPrefix":
              assignmentPrefix,
          },

          ConsistentRead:
            true,

          ExclusiveStartKey:
            exclusiveStartKey,
        }),
      );

    for (
      const item of
      result.Items ?? []
    ) {
      assignments.push(
        fromCandidateAssignmentRecord(
          item,
        ),
      );
    }

    exclusiveStartKey =
      result.LastEvaluatedKey;
  } while (
    exclusiveStartKey
  );

  return assignments.sort(
    (
      left,
      right,
    ) =>
      left.createdAt.localeCompare(
        right.createdAt,
      ) ||
      left.id.localeCompare(
        right.id,
      ),
  );
}

async putAssignment(
  assignment:
    CoverageAssignment,
): Promise<void> {
  /**
   * Bootstrap/seed writes still use the guarded path so that they create
   * exactly the same locks, mirrors and capacity state as production writes.
   */
  const created =
    await this
      .putAssignmentIfPeriodsFree(
        assignment,
      );

  if (created) {
    return;
  }

  const existing =
    await this.getAssignment(
      assignment.id,
    );

  if (
    existing &&
    assignmentsEqual(
      existing,
      assignment,
    )
  ) {
    /**
     * Exact bootstrap replay.
     */
    return;
  }

  throw new Error(
    `Coverage assignment ${assignment.id} could not be persisted because its authoritative identity, period ownership, or daily capacity conflicts with existing state.`,
  );
}

async putAssignmentIfPeriodsFree(
  assignment:
    CoverageAssignment,
): Promise<boolean> {
  const absenceCase =
    await this.getCase(
      assignment.caseId,
    );

  if (!absenceCase) {
    return false;
  }

  const policy =
    await this.getPolicy(
      absenceCase.schoolId,
    );

  if (!policy) {
    return false;
  }

  const candidate =
    await this.getCandidate(
      assignment.candidateId,
    );

  return putAssignmentAtomically({
    documentClient:
      this.documentClient,

    tableName:
      this.tableName,

    assignment,

    absenceCase,

    candidate,

    policy,
  });
}

  private async getDecisionLookup(
    decisionId: string,
  ) {
    const result =
      await this.documentClient.send(
        new GetCommand({
          TableName:
            this.tableName,

          Key:
            dynamoKeys.decisionLookup(
              decisionId,
            ),

          ConsistentRead:
            true,
        }),
      );

    if (!result.Item) {
      return undefined;
    }

    return fromDecisionLookupRecord(
      result.Item,
    );
  }

  async getDecision(
    decisionId: string,
  ): Promise<
    HumanDecision | undefined
  > {
    const lookup =
      await this.getDecisionLookup(
        decisionId,
      );

    if (!lookup) {
      return undefined;
    }

    const result =
      await this.documentClient.send(
        new GetCommand({
          TableName:
            this.tableName,

          Key: {
            PK:
              lookup.targetPK,

            SK:
              lookup.targetSK,
          },

          ConsistentRead:
            true,
        }),
      );

    if (!result.Item) {
      throw new Error(
        `Decision lookup ${decisionId} points to a missing canonical decision record.`,
      );
    }

    const decision =
      fromHumanDecisionRecord(
        result.Item,
      );

    if (
      decision.id !==
        decisionId ||
      decision.caseId !==
        lookup.caseId
    ) {
      throw new Error(
        "Decision lookup and canonical decision disagree about authoritative identity.",
      );
    }

    return decision;
  }

  async listDecisionsByCase(
    caseId: string,
  ): Promise<
    HumanDecision[]
  > {
    const decisions:
      HumanDecision[] = [];

    let exclusiveStartKey:
      QueryCommandInput[
        "ExclusiveStartKey"
      ];

    do {
      const result =
        await this.documentClient.send(
          new QueryCommand({
            TableName:
              this.tableName,

            KeyConditionExpression:
              "PK = :pk AND begins_with(SK, :decisionPrefix)",

            ExpressionAttributeValues: {
              ":pk":
                `CASE#${caseId}`,

              ":decisionPrefix":
                "DECISION#",
            },

            ConsistentRead:
              true,

            ExclusiveStartKey:
              exclusiveStartKey,
          }),
        );

      for (
        const item of
        result.Items ?? []
      ) {
        decisions.push(
          fromHumanDecisionRecord(
            item,
          ),
        );
      }

      exclusiveStartKey =
        result.LastEvaluatedKey;
    } while (
      exclusiveStartKey
    );

    return decisions.sort(
      (
        left,
        right,
      ) =>
        left.requestedAt.localeCompare(
          right.requestedAt,
        ) ||
        left.id.localeCompare(
          right.id,
        ),
    );
  }

  async putDecision(
    decision:
      HumanDecision,
  ): Promise<void> {
    const existing =
      await this.getDecision(
        decision.id,
      );

    if (
      existing &&
      existing.caseId !==
        decision.caseId
    ) {
      throw new Error(
        "Human decision caseId cannot be changed through putDecision.",
      );
    }

    await this.documentClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName:
                this.tableName,

              Item:
                toHumanDecisionRecord(
                  decision,
                ),
            },
          },
          {
            Put: {
              TableName:
                this.tableName,

              Item:
                toDecisionLookupRecord(
                  decision,
                ),
            },
          },
        ],
      }),
    );
  }

  async putDecisionIfAbsent(
    decision:
      HumanDecision,
  ): Promise<boolean> {
    const canonical =
      toHumanDecisionRecord(
        decision,
      );

    const lookup =
      toDecisionLookupRecord(
        decision,
      );

    try {
      await this.documentClient.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName:
                  this.tableName,

                Item:
                  canonical,

                ConditionExpression:
                  "attribute_not_exists(PK) AND attribute_not_exists(SK)",
              },
            },
            {
              Put: {
                TableName:
                  this.tableName,

                Item:
                  lookup,

                ConditionExpression:
                  "attribute_not_exists(PK) AND attribute_not_exists(SK)",
              },
            },
          ],
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

      const [
        canonicalResult,
        lookupResult,
      ] = await Promise.all([
        this.documentClient.send(
          new GetCommand({
            TableName:
              this.tableName,

            Key: {
              PK:
                canonical.PK,

              SK:
                canonical.SK,
            },

            ConsistentRead:
              true,
          }),
        ),

        this.documentClient.send(
          new GetCommand({
            TableName:
              this.tableName,

            Key: {
              PK:
                lookup.PK,

              SK:
                lookup.SK,
            },

            ConsistentRead:
              true,
          }),
        ),
      ]);

      if (
        canonicalResult.Item ||
        lookupResult.Item
      ) {
        return false;
      }

      throw error;
    }
  }

  async appendActivity(
    event:
      ActivityEvent,
  ): Promise<void> {
    const record =
      toActivityEventRecord(
        event,
      );

    try {
      await this.documentClient.send(
        new PutCommand({
          TableName:
            this.tableName,

          Item:
            record,

          ConditionExpression:
            "attribute_not_exists(PK) AND attribute_not_exists(SK)",
        }),
      );
    } catch (error) {
      if (
        !isConditionalCheckFailed(
          error,
        )
      ) {
        throw error;
      }

      const existingResult =
        await this.documentClient.send(
          new GetCommand({
            TableName:
              this.tableName,

            Key: {
              PK:
                record.PK,

              SK:
                record.SK,
            },

            ConsistentRead:
              true,
          }),
        );

      if (!existingResult.Item) {
        throw error;
      }

      const existing =
        fromActivityEventRecord(
          existingResult.Item,
        );

      if (
        activityEventsEqual(
          existing,
          event,
        )
      ) {
        /**
         * Exact replay.
         * Existing activity is already the authoritative evidence.
         */
        return;
      }

      throw new Error(
        `Activity event ID ${event.eventId} already exists with different authoritative data.`,
      );
    }
  }

  async listActivityByCase(
    caseId: string,
  ): Promise<
    ActivityEvent[]
  > {
    const events:
      ActivityEvent[] = [];

    let exclusiveStartKey:
      QueryCommandInput[
        "ExclusiveStartKey"
      ];

    do {
      const result =
        await this.documentClient.send(
          new QueryCommand({
            TableName:
              this.tableName,

            KeyConditionExpression:
              "PK = :pk AND begins_with(SK, :activityPrefix)",

            ExpressionAttributeValues: {
              ":pk":
                `CASE#${caseId}`,

              ":activityPrefix":
                "ACTIVITY#",
            },

            ConsistentRead:
              true,

            ExclusiveStartKey:
              exclusiveStartKey,
          }),
        );

      for (
        const item of
        result.Items ?? []
      ) {
        events.push(
          fromActivityEventRecord(
            item,
          ),
        );
      }

      exclusiveStartKey =
        result.LastEvaluatedKey;
    } while (
      exclusiveStartKey
    );

    return events.sort(
      (
        left,
        right,
      ) =>
        left.timestamp.localeCompare(
          right.timestamp,
        ) ||
        left.eventId.localeCompare(
          right.eventId,
        ),
    );
  }
}