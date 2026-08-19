import {
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";

import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  riversideCoveragePolicy,
  scenarioBAbsence,
  scenarioBCandidates,
} from "@/fixtures/riverside";

import {
  DynamoDbBeforeBellStore,
} from "@/infrastructure/dynamodb/dynamodb-beforebell-store";

import type {
  DynamoDocumentClientLike,
} from "@/infrastructure/dynamodb/dynamodb-beforebell-store";

import {
  toCoverageCandidateRecord,
  toCoverageOfferRecord,
  toCoveragePolicyRecord,
  toOfferLookupRecord,
  toSchoolCoverageCandidateRecord,
  toActivityEventRecord,
toDecisionLookupRecord,
toHumanDecisionRecord,
toAbsenceCaseRecord,
toAssignmentLookupRecord,
toCandidateAssignmentRecord,
toCoverageAssignmentRecord,
} from "@/infrastructure/dynamodb/records";

function createHarness() {
  const send =
    vi.fn();

  const documentClient = {
    send,
  } as unknown as
    DynamoDocumentClientLike;

  const store =
    new DynamoDbBeforeBellStore({
      documentClient,

      tableName:
        "beforebell-dev",
    });

  return {
    send,
    store,
  };
}

describe("DynamoDbBeforeBellStore 3A", () => {
  it("loads coverage policy with a strongly consistent Get", async () => {
    const {
      send,
      store,
    } =
      createHarness();

    send.mockResolvedValueOnce({
      Item:
        toCoveragePolicyRecord(
          riversideCoveragePolicy,
        ),
    });

    const policy =
      await store.getPolicy(
        riversideCoveragePolicy
          .schoolId,
      );

    expect(policy).toEqual(
      riversideCoveragePolicy,
    );

    expect(send).toHaveBeenCalledTimes(
      1,
    );

    const command =
      send.mock.calls[0]?.[0];

    expect(command).toBeInstanceOf(
      GetCommand,
    );

    expect(
      command.input,
    ).toMatchObject({
      TableName:
        "beforebell-dev",

      ConsistentRead:
        true,

      Key: {
        PK:
          "SCHOOL#school-riverside",

        SK:
          "POLICY#COVERAGE",
      },
    });
  });

  it("writes the complete absence-case record", async () => {
    const {
      send,
      store,
    } =
      createHarness();

    send.mockResolvedValueOnce(
      {},
    );

    await store.putCase(
      scenarioBAbsence,
    );

    const command =
      send.mock.calls[0]?.[0];

    expect(command).toBeInstanceOf(
      PutCommand,
    );

    expect(
      command.input.Item,
    ).toMatchObject({
      PK:
        "CASE#case-scenario-b",

      SK:
        "META",

      entityType:
        "absence_case",

      id:
        scenarioBAbsence.id,

      schoolId:
        scenarioBAbsence
          .schoolId,

      GSI1PK:
        "SCHOOL#school-riverside",
    });
  });

  it("returns false when the expected case status loses a conditional race", async () => {
    const {
      send,
      store,
    } =
      createHarness();

    send.mockRejectedValueOnce({
      name:
        "ConditionalCheckFailedException",
    });

    const updated =
      await store.updateCaseIfStatus(
        scenarioBAbsence.id,
        "open",
        {
          ...scenarioBAbsence,

          status:
            "offering",

          updatedAt:
            "2026-09-14T06:00:00.000Z",
        },
      );

    expect(updated).toBe(
      false,
    );

    const command =
      send.mock.calls[0]?.[0];

    expect(command).toBeInstanceOf(
      PutCommand,
    );

    expect(
      command.input
        .ConditionExpression,
    ).toBe(
      "#status = :expectedStatus",
    );

    expect(
      command.input
        .ExpressionAttributeValues,
    ).toEqual({
      ":expectedStatus":
        "open",
    });
  });

  it("loads a canonical candidate with a strongly consistent Get", async () => {
    const candidate =
      scenarioBCandidates[0];

    const {
      send,
      store,
    } =
      createHarness();

    send.mockResolvedValueOnce({
      Item:
        toCoverageCandidateRecord(
          candidate,
        ),
    });

    const result =
      await store.getCandidate(
        candidate.id,
      );

    expect(result).toEqual(
      candidate,
    );

    const command =
      send.mock.calls[0]?.[0];

    expect(command).toBeInstanceOf(
      GetCommand,
    );

    expect(
      command.input,
    ).toMatchObject({
      ConsistentRead:
        true,

      Key: {
        PK:
          `CANDIDATE#${candidate.id}`,

        SK:
          "META",
      },
    });
  });

  it("paginates the school roster using strongly consistent base-table queries", async () => {
    const firstCandidate =
      scenarioBCandidates[0];

    const secondCandidate =
      scenarioBCandidates[1];

    const {
      send,
      store,
    } =
      createHarness();

    send
      .mockResolvedValueOnce({
        Items: [
          toSchoolCoverageCandidateRecord(
            firstCandidate,
          ),
        ],

        LastEvaluatedKey: {
          PK:
            `SCHOOL#${firstCandidate.schoolId}`,

          SK:
            `CANDIDATE#${firstCandidate.id}`,
        },
      })
      .mockResolvedValueOnce({
        Items: [
          toSchoolCoverageCandidateRecord(
            secondCandidate,
          ),
        ],
      });

    const candidates =
      await store.listCandidatesBySchool(
        firstCandidate.schoolId,
      );

    expect(send).toHaveBeenCalledTimes(
      2,
    );

    expect(
      candidates,
    ).toEqual(
      [
        firstCandidate,
        secondCandidate,
      ].sort(
        (
          left,
          right,
        ) =>
          left.id.localeCompare(
            right.id,
          ),
      ),
    );

    for (
      const call of
      send.mock.calls
    ) {
      const command =
        call[0];

      expect(command).toBeInstanceOf(
        QueryCommand,
      );

      expect(
        command.input
          .ConsistentRead,
      ).toBe(true);

      expect(
        command.input
          .KeyConditionExpression,
      ).toBe(
        "PK = :pk AND begins_with(SK, :candidatePrefix)",
      );
    }
  });

  it("writes candidate canonical and school-roster records atomically", async () => {
    const candidate =
      scenarioBCandidates[0];

    const {
      send,
      store,
    } =
      createHarness();

    /**
     * putCandidate first performs a strongly consistent canonical lookup to
     * prevent accidentally moving an existing candidate between schools.
     */
    send
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce(
        {},
      );

    await store.putCandidate(
      candidate,
    );

    expect(send).toHaveBeenCalledTimes(
      2,
    );

    expect(
      send.mock.calls[0]?.[0],
    ).toBeInstanceOf(
      GetCommand,
    );

    const command =
      send.mock.calls[1]?.[0];

    expect(command).toBeInstanceOf(
      TransactWriteCommand,
    );

    expect(
      command.input
        .TransactItems,
    ).toEqual([
      {
        Put: {
          TableName:
            "beforebell-dev",

          Item:
            toCoverageCandidateRecord(
              candidate,
            ),
        },
      },
      {
        Put: {
          TableName:
            "beforebell-dev",

          Item:
            toSchoolCoverageCandidateRecord(
              candidate,
            ),
        },
      },
    ]);
  });

  it("loads an offer through immutable lookup and canonical strong reads", async () => {
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

  const {
    send,
    store,
  } =
    createHarness();

  send
    .mockResolvedValueOnce({
      Item:
        toOfferLookupRecord(
          offer,
        ),
    })
    .mockResolvedValueOnce({
      Item:
        toCoverageOfferRecord(
          offer,
        ),
    });

  const result =
    await store.getOffer(
      offer.id,
    );

  expect(result).toEqual(
    offer,
  );

  expect(send).toHaveBeenCalledTimes(
    2,
  );

  for (
    const call of
    send.mock.calls
  ) {
    expect(
      call[0],
    ).toBeInstanceOf(
      GetCommand,
    );

    expect(
      call[0].input
        .ConsistentRead,
    ).toBe(true);
  }
});

it("queries offers by case with strongly consistent pagination", async () => {
  const first = {
    id:
      "offer-a",

    caseId:
      scenarioBAbsence.id,

    candidateId:
      scenarioBCandidates[0].id,

    periodIds: [
      "P2",
    ] as const,

    status:
      "declined" as const,

    createdAt:
      "2026-09-14T05:55:00.000Z",

    expiresAt:
      "2026-09-14T06:15:00.000Z",

    respondedAt:
      "2026-09-14T05:57:00.000Z",
  };

  const second = {
    id:
      "offer-b",

    caseId:
      scenarioBAbsence.id,

    candidateId:
      scenarioBCandidates[1].id,

    periodIds: [
      "P5",
    ] as const,

    status:
      "pending" as const,

    createdAt:
      "2026-09-14T06:00:00.000Z",

    expiresAt:
      "2026-09-14T06:20:00.000Z",
  };

  const {
    send,
    store,
  } =
    createHarness();

  send
    .mockResolvedValueOnce({
      Items: [
        toCoverageOfferRecord(
          first,
        ),
      ],

      LastEvaluatedKey: {
        PK:
          "CASE#case-scenario-b",

        SK:
          "OFFER#offer-a",
      },
    })
    .mockResolvedValueOnce({
      Items: [
        toCoverageOfferRecord(
          second,
        ),
      ],
    });

  const result =
    await store.listOffersByCase(
      scenarioBAbsence.id,
    );

  expect(result).toEqual([
    first,
    second,
  ]);

  expect(send).toHaveBeenCalledTimes(
    2,
  );

  for (
    const call of
    send.mock.calls
  ) {
    expect(
      call[0],
    ).toBeInstanceOf(
      QueryCommand,
    );

    expect(
      call[0].input
        .ConsistentRead,
    ).toBe(true);
  }
});

it("writes canonical offer and immutable lookup atomically", async () => {
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

  const {
    send,
    store,
  } =
    createHarness();

  /**
   * putOffer first checks whether this stable offer ID already resolves.
   */
  send
    .mockResolvedValueOnce({})
    .mockResolvedValueOnce(
      {},
    );

  await store.putOffer(
    offer,
  );

  expect(send).toHaveBeenCalledTimes(
    2,
  );

  expect(
    send.mock.calls[1]?.[0],
  ).toBeInstanceOf(
    TransactWriteCommand,
  );

  expect(
    send.mock.calls[1]?.[0]
      .input.TransactItems,
  ).toEqual([
    {
      Put: {
        TableName:
          "beforebell-dev",

        Item:
          toCoverageOfferRecord(
            offer,
          ),
      },
    },
    {
      Put: {
        TableName:
          "beforebell-dev",

        Item:
          toOfferLookupRecord(
            offer,
          ),
      },
    },
  ]);
});

it("creates an offer only when canonical and lookup records are absent", async () => {
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

  const {
    send,
    store,
  } =
    createHarness();

  send.mockResolvedValueOnce(
    {},
  );

  const created =
    await store.putOfferIfAbsent(
      offer,
    );

  expect(created).toBe(
    true,
  );

  const command =
    send.mock.calls[0]?.[0];

  expect(command).toBeInstanceOf(
    TransactWriteCommand,
  );

  expect(
    command.input
      .TransactItems,
  ).toHaveLength(2);

  expect(
    command.input
      .TransactItems?.[0]
      ?.Put
      ?.ConditionExpression,
  ).toBe(
    "attribute_not_exists(PK) AND attribute_not_exists(SK)",
  );
});

it("returns false for an idempotent offer-creation collision", async () => {
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

  const {
    send,
    store,
  } =
    createHarness();

  send
    .mockRejectedValueOnce({
      name:
        "TransactionCanceledException",
    })
    .mockResolvedValueOnce({
      Item:
        toCoverageOfferRecord(
          offer,
        ),
    })
    .mockResolvedValueOnce({
      Item:
        toOfferLookupRecord(
          offer,
        ),
    });

  const created =
    await store.putOfferIfAbsent(
      offer,
    );

  expect(created).toBe(
    false,
  );
});

it("conditionally transitions a pending offer while preserving offer identity", async () => {
  const pending = {
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

  const accepted = {
    ...pending,

    status:
      "accepted" as const,

    respondedAt:
      "2026-09-14T06:00:00.000Z",
  };

  const {
    send,
    store,
  } =
    createHarness();

  send
    .mockResolvedValueOnce({
      Item:
        toOfferLookupRecord(
          pending,
        ),
    })
    .mockResolvedValueOnce({
      Item:
        toCoverageOfferRecord(
          pending,
        ),
    })
    .mockResolvedValueOnce(
      {},
    );

  const updated =
    await store.updateOfferIfStatus(
      pending.id,
      "pending",
      accepted,
    );

  expect(updated).toBe(
    true,
  );

  const command =
    send.mock.calls[2]?.[0];

  expect(command).toBeInstanceOf(
    PutCommand,
  );

  expect(
    command.input
      .ConditionExpression,
  ).toBe(
    "#status = :expectedStatus",
  );

  expect(
    command.input
      .ExpressionAttributeValues,
  ).toEqual({
    ":expectedStatus":
      "pending",
  });
});

it("returns false when a competing offer response wins first", async () => {
  const pending = {
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

  const declined = {
    ...pending,

    status:
      "declined" as const,

    respondedAt:
      "2026-09-14T06:00:00.000Z",
  };

  const {
    send,
    store,
  } =
    createHarness();

  send
    .mockResolvedValueOnce({
      Item:
        toOfferLookupRecord(
          pending,
        ),
    })
    .mockResolvedValueOnce({
      Item:
        toCoverageOfferRecord(
          pending,
        ),
    })
    .mockRejectedValueOnce({
      name:
        "ConditionalCheckFailedException",
    });

  const updated =
    await store.updateOfferIfStatus(
      pending.id,
      "pending",
      declined,
    );

  expect(updated).toBe(
    false,
  );
});

it("loads a human decision through immutable lookup and canonical strong reads", async () => {
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

  const {
    send,
    store,
  } =
    createHarness();

  send
    .mockResolvedValueOnce({
      Item:
        toDecisionLookupRecord(
          decision,
        ),
    })
    .mockResolvedValueOnce({
      Item:
        toHumanDecisionRecord(
          decision,
        ),
    });

  const result =
    await store.getDecision(
      decision.id,
    );

  expect(result).toEqual(
    decision,
  );

  expect(send).toHaveBeenCalledTimes(
    2,
  );

  for (
    const call of
    send.mock.calls
  ) {
    expect(
      call[0],
    ).toBeInstanceOf(
      GetCommand,
    );

    expect(
      call[0].input
        .ConsistentRead,
    ).toBe(true);
  }
});

it("queries human decisions by case with strongly consistent pagination", async () => {
  const first = {
    id:
      "decision-a",

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

  const second = {
    id:
      "decision-b",

    caseId:
      scenarioBAbsence.id,

    kind:
      "combine_coverage_groups" as const,

    status:
      "rejected" as const,

    periodIds: [
      "P5",
    ] as const,

    summary:
      "Combine coverage groups for P5.",

    requestedAt:
      "2026-09-14T06:11:00.000Z",

    decidedAt:
      "2026-09-14T06:12:00.000Z",

    decidedBy:
      "administrator-demo",
  };

  const {
    send,
    store,
  } =
    createHarness();

  send
    .mockResolvedValueOnce({
      Items: [
        toHumanDecisionRecord(
          first,
        ),
      ],

      LastEvaluatedKey: {
        PK:
          "CASE#case-scenario-b",

        SK:
          "DECISION#decision-a",
      },
    })
    .mockResolvedValueOnce({
      Items: [
        toHumanDecisionRecord(
          second,
        ),
      ],
    });

  const result =
    await store.listDecisionsByCase(
      scenarioBAbsence.id,
    );

  expect(result).toEqual([
    first,
    second,
  ]);

  expect(send).toHaveBeenCalledTimes(
    2,
  );

  for (
    const call of
    send.mock.calls
  ) {
    expect(
      call[0],
    ).toBeInstanceOf(
      QueryCommand,
    );

    expect(
      call[0].input
        .ConsistentRead,
    ).toBe(true);
  }
});

it("writes human decision canonical and lookup records atomically", async () => {
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

  const {
    send,
    store,
  } =
    createHarness();

  send
    .mockResolvedValueOnce({})
    .mockResolvedValueOnce(
      {},
    );

  await store.putDecision(
    decision,
  );

  expect(send).toHaveBeenCalledTimes(
    2,
  );

  expect(
    send.mock.calls[1]?.[0],
  ).toBeInstanceOf(
    TransactWriteCommand,
  );
});

it("creates a stable human decision only once", async () => {
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

  const {
    send,
    store,
  } =
    createHarness();

  send.mockResolvedValueOnce(
    {},
  );

  const created =
    await store.putDecisionIfAbsent(
      decision,
    );

  expect(created).toBe(
    true,
  );

  const command =
    send.mock.calls[0]?.[0];

  expect(command).toBeInstanceOf(
    TransactWriteCommand,
  );

  expect(
    command.input
      .TransactItems,
  ).toHaveLength(2);
});

it("returns false for an existing stable human decision", async () => {
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

  const {
    send,
    store,
  } =
    createHarness();

  send
    .mockRejectedValueOnce({
      name:
        "TransactionCanceledException",
    })
    .mockResolvedValueOnce({
      Item:
        toHumanDecisionRecord(
          decision,
        ),
    })
    .mockResolvedValueOnce({
      Item:
        toDecisionLookupRecord(
          decision,
        ),
    });

  const created =
    await store.putDecisionIfAbsent(
      decision,
    );

  expect(created).toBe(
    false,
  );
});

it("replays the exact same activity event without creating a duplicate", async () => {
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

    correlationId:
      "correlation-test-123",
  };

  const {
    send,
    store,
  } =
    createHarness();

  send
    .mockRejectedValueOnce({
      name:
        "ConditionalCheckFailedException",
    })
    .mockResolvedValueOnce({
      Item:
        toActivityEventRecord(
          event,
        ),
    });

  await expect(
    store.appendActivity(
      event,
    ),
  ).resolves.toBeUndefined();

  expect(send).toHaveBeenCalledTimes(
    2,
  );
});

it("rejects reuse of an activity event ID for different evidence", async () => {
  const existing = {
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

    status:
      "succeeded" as const,

    summary:
      "Administrator approved an external substitute for P5.",

    correlationId:
      "correlation-test-123",
  };

  const conflicting = {
    ...existing,

    summary:
      "Different evidence under the same event ID.",
  };

  const {
    send,
    store,
  } =
    createHarness();

  send
    .mockRejectedValueOnce({
      name:
        "ConditionalCheckFailedException",
    })
    .mockResolvedValueOnce({
      Item:
        toActivityEventRecord(
          existing,
        ),
    });

  await expect(
    store.appendActivity(
      conflicting,
    ),
  ).rejects.toThrow(
    /different authoritative data/i,
  );
});

it("loads an assignment through immutable lookup and canonical strong reads", async () => {
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

  const {
    send,
    store,
  } =
    createHarness();

  send
    .mockResolvedValueOnce({
      Item:
        toAssignmentLookupRecord(
          assignment,
        ),
    })
    .mockResolvedValueOnce({
      Item:
        toCoverageAssignmentRecord(
          assignment,
          "2026-09-14",
        ),
    });

  const result =
    await store.getAssignment(
      assignment.id,
    );

  expect(result).toEqual(
    assignment,
  );

  expect(send).toHaveBeenCalledTimes(
    2,
  );

  for (
    const call of
    send.mock.calls
  ) {
    expect(
      call[0],
    ).toBeInstanceOf(
      GetCommand,
    );

    expect(
      call[0].input
        .ConsistentRead,
    ).toBe(true);
  }
});

it("queries assignments by case using the canonical case partition", async () => {
  const assignment = {
    id:
      "assignment-case-query",

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

  const {
    send,
    store,
  } =
    createHarness();

  send.mockResolvedValueOnce({
    Items: [
      toCoverageAssignmentRecord(
        assignment,
        "2026-09-14",
      ),
    ],
  });

  const result =
    await store
      .listAssignmentsByCase(
        scenarioBAbsence.id,
      );

  expect(result).toEqual([
    assignment,
  ]);

  const command =
    send.mock.calls[0]?.[0];

  expect(command).toBeInstanceOf(
    QueryCommand,
  );

  expect(
    command.input
      .ConsistentRead,
  ).toBe(true);

  expect(
    command.input
      .ExpressionAttributeValues,
  ).toEqual({
    ":pk":
      "CASE#case-scenario-b",

    ":assignmentPrefix":
      "ASSIGNMENT#",
  });
});

it("queries candidate assignment mirrors across date-scoped sort keys", async () => {
  const assignment = {
    id:
      "assignment-candidate-query",

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

  const {
    send,
    store,
  } =
    createHarness();

  send.mockResolvedValueOnce({
    Items: [
      toCandidateAssignmentRecord(
        assignment,
        "2026-09-14",
      ),
    ],
  });

  const result =
    await store
      .listAssignmentsByCandidate(
        assignment.candidateId,
      );

  expect(result).toEqual([
    assignment,
  ]);

  const command =
    send.mock.calls[0]?.[0];

  expect(command).toBeInstanceOf(
    QueryCommand,
  );

  expect(
    command.input
      .ConsistentRead,
  ).toBe(true);

  expect(
    command.input
      .ExpressionAttributeValues,
  ).toEqual({
    ":pk":
      `CANDIDATE#${assignment.candidateId}`,

    ":assignmentPrefix":
      "ASSIGNMENT#",
  });
});

it("constructs one atomic transaction for canonical assignment, mirror, locks and capacity", async () => {
  const assignment = {
    id:
      "assignment-atomic-test",

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

  const {
    send,
    store,
  } =
    createHarness();

  send
    .mockResolvedValueOnce({
      Item:
        toAbsenceCaseRecord(
          scenarioBAbsence,
        ),
    })
    .mockResolvedValueOnce({
      Item:
        toCoveragePolicyRecord(
          riversideCoveragePolicy,
        ),
    })
    .mockResolvedValueOnce({
      Item:
        toCoverageCandidateRecord(
          scenarioBCandidates[0],
        ),
    })
    .mockResolvedValueOnce(
      {},
    );

  const created =
    await store
      .putAssignmentIfPeriodsFree(
        assignment,
      );

  expect(created).toBe(
    true,
  );

  expect(send).toHaveBeenCalledTimes(
    4,
  );

  const transaction =
    send.mock.calls[3]?.[0];

  expect(
    transaction,
  ).toBeInstanceOf(
    TransactWriteCommand,
  );

  /**
   * 3 authoritative ConditionChecks
   * 3 identity/materialization Puts
   * 2 case period locks
   * 2 candidate period locks
   * 1 capacity Update
   */
  expect(
    transaction.input
      .TransactItems,
  ).toHaveLength(
    11,
  );

  expect(
    transaction.input
      .TransactItems?.at(
        -1,
      )?.Update
      ?.Key,
  ).toEqual({
    PK:
      `CANDIDATE#${scenarioBCandidates[0].id}`,

    SK:
      "CAPACITY#2026-09-14",
  });
});

it("rejects an assignment before transaction when candidate baseline already exhausts daily capacity", async () => {
  const fullCandidate = {
    ...scenarioBCandidates[0],

    dailyCoverageCount:
      riversideCoveragePolicy
        .maxDailyCoveragePeriods,
  };

  const assignment = {
    id:
      "assignment-full-capacity",

    caseId:
      scenarioBAbsence.id,

    candidateId:
      fullCandidate.id,

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

  const {
    send,
    store,
  } =
    createHarness();

  send
    .mockResolvedValueOnce({
      Item:
        toAbsenceCaseRecord(
          scenarioBAbsence,
        ),
    })
    .mockResolvedValueOnce({
      Item:
        toCoveragePolicyRecord(
          riversideCoveragePolicy,
        ),
    })
    .mockResolvedValueOnce({
      Item:
        toCoverageCandidateRecord(
          fullCandidate,
        ),
    });

  const created =
    await store
      .putAssignmentIfPeriodsFree(
        assignment,
      );

  expect(created).toBe(
    false,
  );

  expect(send).toHaveBeenCalledTimes(
    3,
  );

  expect(
    send.mock.calls.some(
      (call) =>
        call[0] instanceof
          TransactWriteCommand,
    ),
  ).toBe(false);
});

it("returns false when a transactional assignment condition loses a race", async () => {
  const assignment = {
    id:
      "assignment-condition-race",

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

  const {
    send,
    store,
  } =
    createHarness();

  send
    .mockResolvedValueOnce({
      Item:
        toAbsenceCaseRecord(
          scenarioBAbsence,
        ),
    })
    .mockResolvedValueOnce({
      Item:
        toCoveragePolicyRecord(
          riversideCoveragePolicy,
        ),
    })
    .mockResolvedValueOnce({
      Item:
        toCoverageCandidateRecord(
          scenarioBCandidates[0],
        ),
    })
    .mockRejectedValueOnce({
      name:
        "TransactionCanceledException",

      CancellationReasons: [
        {
          Code:
            "None",
        },
        {
          Code:
            "None",
        },
        {
          Code:
            "None",
        },
        {
          Code:
            "ConditionalCheckFailed",
        },
      ],
    });

  const created =
    await store
      .putAssignmentIfPeriodsFree(
        assignment,
      );

  expect(created).toBe(
    false,
  );
});

it("retries a transient DynamoDB transaction conflict instead of misclassifying it as unavailable coverage", async () => {
  const assignment = {
    id:
      "assignment-transaction-retry",

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

  const {
    send,
    store,
  } =
    createHarness();

  send
    .mockResolvedValueOnce({
      Item:
        toAbsenceCaseRecord(
          scenarioBAbsence,
        ),
    })
    .mockResolvedValueOnce({
      Item:
        toCoveragePolicyRecord(
          riversideCoveragePolicy,
        ),
    })
    .mockResolvedValueOnce({
      Item:
        toCoverageCandidateRecord(
          scenarioBCandidates[0],
        ),
    })
    .mockRejectedValueOnce({
      name:
        "TransactionCanceledException",

      CancellationReasons: [
        {
          Code:
            "TransactionConflict",
        },
      ],
    })
    .mockResolvedValueOnce(
      {},
    );

  const created =
    await store
      .putAssignmentIfPeriodsFree(
        assignment,
      );

  expect(created).toBe(
    true,
  );

  expect(
    send.mock.calls.filter(
      (call) =>
        call[0] instanceof
          TransactWriteCommand,
    ),
  ).toHaveLength(
    2,
  );
});

it("allows an approved external-substitute assignment without requiring an internal candidate record", async () => {
  const assignment = {
    id:
      "assignment-external-substitute",

    caseId:
      scenarioBAbsence.id,

    candidateId:
      "external-substitute-morgan-ellis",

    periodIds: [
      "P5",
    ] as const,

    source:
      "approved_exception" as const,

    decisionId:
      "decision-external-substitute",

    createdAt:
      "2026-09-14T06:15:00.000Z",
  };

  const {
    send,
    store,
  } =
    createHarness();

  send
    .mockResolvedValueOnce({
      Item:
        toAbsenceCaseRecord(
          scenarioBAbsence,
        ),
    })
    .mockResolvedValueOnce({
      Item:
        toCoveragePolicyRecord(
          riversideCoveragePolicy,
        ),
    })
    .mockResolvedValueOnce(
      {},
    )
    .mockResolvedValueOnce(
      {},
    );

  const created =
    await store
      .putAssignmentIfPeriodsFree(
        assignment,
      );

  expect(created).toBe(
    true,
  );

  const transaction =
    send.mock.calls[3]?.[0];

  expect(
    transaction,
  ).toBeInstanceOf(
    TransactWriteCommand,
  );

  /**
   * Transaction item #2 is the candidate-meta guard.
   *
   * Because this is an approved external substitute with no internal
   * candidate record, its invariant is that the canonical candidate META
   * record remains absent during commit.
   */
  expect(
    transaction.input
      .TransactItems?.[1]
      ?.ConditionCheck
      ?.ConditionExpression,
  ).toBe(
    "attribute_not_exists(PK)",
  );
});
});