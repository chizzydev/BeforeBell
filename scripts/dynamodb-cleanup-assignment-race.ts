import {
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

import {
  config as loadEnvironment,
} from "dotenv";

import {
  createBeforeBellDynamoClients,
} from "../src/infrastructure/dynamodb/client";

import {
  getBeforeBellDynamoConfig,
} from "../src/infrastructure/dynamodb/env";

import {
  dynamoKeys,
} from "../src/infrastructure/dynamodb/keys";

loadEnvironment({
  path:
    ".env.local",
});

const DEV_TABLE_NAME =
  "beforebell-dev";

/**
 * Exact nonce from the interrupted 3D.3 run.
 *
 * This cleanup intentionally targets only that synthetic run.
 */
const NONCE =
  "e3afa8ca4c79";

const DATE_ONE =
  "2026-09-14";

const DATE_TWO =
  "2026-09-15";

type PhysicalKey = {
  PK: string;
  SK: string;
};

function keyIdentity(
  key: PhysicalKey,
): string {
  return `${key.PK}\u0000${key.SK}`;
}

async function main() {
  const config =
    getBeforeBellDynamoConfig();

  if (
    config.tableName !==
    DEV_TABLE_NAME
  ) {
    throw new Error(
      `Refusing cleanup against "${config.tableName}". Expected exactly "${DEV_TABLE_NAME}".`,
    );
  }

  const {
    serviceClient,
    documentClient,
  } =
    createBeforeBellDynamoClients(
      config,
    );

  const schoolId =
    `school-assignment-race-${NONCE}`;

  const candidateIds = [
    `candidate-same-id-${NONCE}`,
    `candidate-case-period-a-${NONCE}`,
    `candidate-case-period-b-${NONCE}`,
    `candidate-period-race-${NONCE}`,
    `candidate-capacity-race-${NONCE}`,
    `candidate-cross-date-${NONCE}`,
  ];

  const caseIds = [
    `case-same-id-${NONCE}`,
    `case-period-race-${NONCE}`,
    `case-candidate-period-a-${NONCE}`,
    `case-candidate-period-b-${NONCE}`,
    `case-capacity-a-${NONCE}`,
    `case-capacity-b-${NONCE}`,
    `case-cross-date-a-${NONCE}`,
    `case-cross-date-b-${NONCE}`,
  ];

  const assignments = [
    {
      assignmentId:
        `assignment-same-id-${NONCE}`,

      caseId:
        `case-same-id-${NONCE}`,

      candidateId:
        `candidate-same-id-${NONCE}`,

      date:
        DATE_ONE,

      periodIds: [
        "P1",
      ],
    },

    {
      assignmentId:
        `assignment-case-period-a-${NONCE}`,

      caseId:
        `case-period-race-${NONCE}`,

      candidateId:
        `candidate-case-period-a-${NONCE}`,

      date:
        DATE_ONE,

      periodIds: [
        "P2",
      ],
    },

    {
      assignmentId:
        `assignment-case-period-b-${NONCE}`,

      caseId:
        `case-period-race-${NONCE}`,

      candidateId:
        `candidate-case-period-b-${NONCE}`,

      date:
        DATE_ONE,

      periodIds: [
        "P2",
      ],
    },

    {
      assignmentId:
        `assignment-candidate-period-a-${NONCE}`,

      caseId:
        `case-candidate-period-a-${NONCE}`,

      candidateId:
        `candidate-period-race-${NONCE}`,

      date:
        DATE_ONE,

      periodIds: [
        "P3",
      ],
    },

    {
      assignmentId:
        `assignment-candidate-period-b-${NONCE}`,

      caseId:
        `case-candidate-period-b-${NONCE}`,

      candidateId:
        `candidate-period-race-${NONCE}`,

      date:
        DATE_ONE,

      periodIds: [
        "P3",
      ],
    },

    {
      assignmentId:
        `assignment-capacity-a-${NONCE}`,

      caseId:
        `case-capacity-a-${NONCE}`,

      candidateId:
        `candidate-capacity-race-${NONCE}`,

      date:
        DATE_ONE,

      periodIds: [
        "P4",
      ],
    },

    {
      assignmentId:
        `assignment-capacity-b-${NONCE}`,

      caseId:
        `case-capacity-b-${NONCE}`,

      candidateId:
        `candidate-capacity-race-${NONCE}`,

      date:
        DATE_ONE,

      periodIds: [
        "P5",
      ],
    },

    {
      assignmentId:
        `assignment-cross-date-a-${NONCE}`,

      caseId:
        `case-cross-date-a-${NONCE}`,

      candidateId:
        `candidate-cross-date-${NONCE}`,

      date:
        DATE_ONE,

      periodIds: [
        "P6",
      ],
    },

    {
      assignmentId:
        `assignment-cross-date-b-${NONCE}`,

      caseId:
        `case-cross-date-b-${NONCE}`,

      candidateId:
        `candidate-cross-date-${NONCE}`,

      date:
        DATE_TWO,

      periodIds: [
        "P6",
      ],
    },
  ] as const;

  const keys =
    new Map<
      string,
      PhysicalKey
    >();

  const addKey = (
    key: PhysicalKey,
  ) => {
    keys.set(
      keyIdentity(
        key,
      ),
      key,
    );
  };

  /**
   * Policy.
   */
  addKey(
    dynamoKeys.coveragePolicy(
      schoolId,
    ),
  );

  /**
   * Candidate canonical records + school roster mirrors.
   */
  for (
    const candidateId of
    candidateIds
  ) {
    addKey(
      dynamoKeys.candidateMeta(
        candidateId,
      ),
    );

    addKey(
      dynamoKeys.schoolCandidate(
        schoolId,
        candidateId,
      ),
    );
  }

  /**
   * Case canonical records.
   */
  for (
    const caseId of
    caseIds
  ) {
    addKey(
      dynamoKeys.caseMeta(
        caseId,
      ),
    );
  }

  /**
   * Every artifact each attempted assignment could have produced.
   */
  for (
    const assignment of
    assignments
  ) {
    addKey(
      dynamoKeys.caseAssignment(
        assignment.caseId,
        assignment.assignmentId,
      ),
    );

    addKey(
      dynamoKeys.assignmentLookup(
        assignment.assignmentId,
      ),
    );

    addKey(
      dynamoKeys.candidateAssignment(
        assignment.candidateId,
        assignment.date,
        assignment.assignmentId,
      ),
    );

    addKey(
      dynamoKeys.candidateCapacity(
        assignment.candidateId,
        assignment.date,
      ),
    );

    for (
      const periodId of
      assignment.periodIds
    ) {
      addKey(
        dynamoKeys.casePeriodLock(
          assignment.caseId,
          periodId,
        ),
      );

      addKey(
        dynamoKeys.candidatePeriodLock(
          assignment.candidateId,
          assignment.date,
          periodId,
        ),
      );
    }
  }

  console.log(
    "\n=== BeforeBell 3D.3 Interrupted-Run Cleanup ===\n",
  );

  console.log(
    `Region: ${config.region}`,
  );

  console.log(
    `Table: ${config.tableName}`,
  );

  console.log(
    `Run nonce: ${NONCE}`,
  );

  console.log(
    `Explicit keys targeted: ${keys.size}`,
  );

  console.log(
    "\nDeleting only records belonging to this synthetic run...",
  );

  let deleted =
    0;

  try {
    for (
      const key of
      keys.values()
    ) {
      await documentClient.send(
        new DeleteCommand({
          TableName:
            config.tableName,

          Key:
            key,
        }),
      );

      deleted +=
        1;
    }

    console.log(
      `Delete operations completed: ${deleted}/${keys.size} ✅`,
    );

    console.log(
      "\n=== Interrupted 3D.3 Run Cleaned ===",
    );

    console.log(
      `Nonce ${NONCE}: cleanup PASS ✅`,
    );
  } finally {
    serviceClient.destroy();
  }
}

main().catch(
  (error) => {
    console.error(
      "\nBeforeBell interrupted-run cleanup failed.",
    );

    console.error(
      error,
    );

    process.exitCode =
      1;
  },
);