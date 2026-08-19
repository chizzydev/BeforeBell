import "server-only";

import {
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

import {
  BEFOREBELL_DEMO_CASES,
  BEFOREBELL_DEMO_SCENARIO_B_BASELINE,
} from "@/demo/beforebell-demo";

import {
  scenarioBAbsence,
} from "@/fixtures/riverside";

import {
  createBeforeBellDynamoClients,
} from "@/infrastructure/dynamodb/client";

import {
  DynamoDbBeforeBellStore,
} from "@/infrastructure/dynamodb/dynamodb-beforebell-store";

import {
  getBeforeBellDynamoConfig,
} from "@/infrastructure/dynamodb/env";

import {
  dynamoKeys,
} from "@/infrastructure/dynamodb/keys";


export interface ResetScenarioBDemoResult {
  caseId:
    string;

  caseStatus:
    "partially_covered";

  coveredPeriods: [
    "P2",
    "P3",
  ];

  removedAssignments:
    number;

  removedDecisions:
    number;

  removedActivityEvents:
    number;

  idempotentReplay:
    boolean;
}


function assert(
  condition:
    unknown,
  message:
    string,
): asserts condition {
  if (
    !condition
  ) {
    throw new Error(
      message,
    );
  }
}


function samePeriods(
  actual:
    readonly string[],
  expected:
    readonly string[],
): boolean {
  return (
    [...actual]
      .sort()
      .join("|") ===
    [...expected]
      .sort()
      .join("|")
  );
}


export async function resetScenarioBDemo():
  Promise<
    ResetScenarioBDemoResult
  > {
  const definition =
    BEFOREBELL_DEMO_CASES.find(
      (
        currentCase,
      ) =>
        currentCase.scenario ===
        "B",
    );


  assert(
    definition,
    "BeforeBell Scenario B demo definition is missing.",
  );


  const config =
    getBeforeBellDynamoConfig();


  const {
    serviceClient,
    documentClient,
  } =
    createBeforeBellDynamoClients(
      config,
    );


  const store =
    new DynamoDbBeforeBellStore({
      documentClient,

      tableName:
        config.tableName,
    });


  try {
    const [
      currentCase,
      offers,
      assignments,
      decisions,
      activity,
    ] =
      await Promise.all([
        store.getCase(
          definition.caseId,
        ),

        store.listOffersByCase(
          definition.caseId,
        ),

        store.listAssignmentsByCase(
          definition.caseId,
        ),

        store.listDecisionsByCase(
          definition.caseId,
        ),

        store.listActivityByCase(
          definition.caseId,
        ),
      ]);


    assert(
      currentCase,
      "Scenario B is not seeded. Run the persistent demo seed before resetting it.",
    );


    const routineOffer =
      offers.find(
        (
          offer,
        ) =>
          offer.id ===
          BEFOREBELL_DEMO_SCENARIO_B_BASELINE
            .routineOfferId,
      );


    assert(
      routineOffer,
      "Scenario B baseline routine offer is missing.",
    );


    assert(
      routineOffer.status ===
        "accepted",
      "Scenario B baseline routine offer is no longer accepted.",
    );


    assert(
      samePeriods(
        routineOffer.periodIds,
        [
          "P2",
          "P3",
        ],
      ),
      "Scenario B baseline routine offer does not contain exactly P2/P3.",
    );


    const unexpectedOffers =
      offers.filter(
        (
          offer,
        ) =>
          offer.id !==
          BEFOREBELL_DEMO_SCENARIO_B_BASELINE
            .routineOfferId,
      );


    assert(
      unexpectedOffers.length ===
        0,
      "Scenario B contains an unexpected coverage offer. Refusing automatic reset.",
    );


    const routineAssignment =
      assignments.find(
        (
          assignment,
        ) =>
          assignment.id ===
          BEFOREBELL_DEMO_SCENARIO_B_BASELINE
            .routineAssignmentId,
      );


    assert(
      routineAssignment,
      "Scenario B baseline P2/P3 assignment is missing.",
    );


    assert(
      routineAssignment.source ===
        "accepted_offer",
      "Scenario B baseline assignment is not an accepted-offer assignment.",
    );


    assert(
      routineAssignment.offerId ===
        BEFOREBELL_DEMO_SCENARIO_B_BASELINE
          .routineOfferId,
      "Scenario B baseline assignment does not reference the expected routine offer.",
    );


    assert(
      samePeriods(
        routineAssignment.periodIds,
        [
          "P2",
          "P3",
        ],
      ),
      "Scenario B baseline assignment does not contain exactly P2/P3.",
    );


    const extraAssignments =
      assignments.filter(
        (
          assignment,
        ) =>
          assignment.id !==
          BEFOREBELL_DEMO_SCENARIO_B_BASELINE
            .routineAssignmentId,
      );


    const unexpectedAssignments =
      extraAssignments.filter(
        (
          assignment,
        ) =>
          assignment.source !==
          "approved_exception",
      );


    assert(
      unexpectedAssignments.length ===
        0,
      "Scenario B contains an unexpected non-exception assignment. Refusing automatic reset.",
    );


    const alreadyBaseline =
      currentCase.status ===
        "partially_covered" &&
      extraAssignments.length ===
        0 &&
      decisions.length ===
        0 &&
      activity.length ===
        0;


    /**
     * Remove only artifacts created after the persistent Scenario B baseline.
     *
     * Direct deletes are intentionally derived from authoritative records
     * rather than reproducing dynamic decision/assignment identity logic.
     * Every delete is idempotent, so an interrupted reset can safely be
     * attempted again.
     */
    for (
      const assignment of
      extraAssignments
    ) {
      const keys = [
        dynamoKeys.caseAssignment(
          definition.caseId,
          assignment.id,
        ),

        dynamoKeys.assignmentLookup(
          assignment.id,
        ),

        dynamoKeys.candidateAssignment(
          assignment.candidateId,
          currentCase.date,
          assignment.id,
        ),

        dynamoKeys.candidateCapacity(
          assignment.candidateId,
          currentCase.date,
        ),
      ];


      for (
        const periodId of
        assignment.periodIds
      ) {
        keys.push(
          dynamoKeys.casePeriodLock(
            definition.caseId,
            periodId,
          ),
        );

        keys.push(
          dynamoKeys.candidatePeriodLock(
            assignment.candidateId,
            currentCase.date,
            periodId,
          ),
        );
      }


      for (
        const key of
        keys
      ) {
        await documentClient.send(
          new DeleteCommand({
            TableName:
              config.tableName,

            Key:
              key,
          }),
        );
      }
    }


    for (
      const decision of
      decisions
    ) {
      await documentClient.send(
        new DeleteCommand({
          TableName:
            config.tableName,

          Key:
            dynamoKeys.caseDecision(
              definition.caseId,
              decision.id,
            ),
        }),
      );


      await documentClient.send(
        new DeleteCommand({
          TableName:
            config.tableName,

          Key:
            dynamoKeys.decisionLookup(
              decision.id,
            ),
        }),
      );
    }


    for (
      const event of
      activity
    ) {
      await documentClient.send(
        new DeleteCommand({
          TableName:
            config.tableName,

          Key:
            dynamoKeys.caseActivity(
              definition.caseId,
              event.eventId,
            ),
        }),
      );
    }


    /**
     * Restore only the authoritative case aggregate state.
     *
     * Policy, candidates, accepted routine offer and P2/P3 assignment
     * remain untouched.
     */
    await store.putCase({
      ...scenarioBAbsence,

      id:
        definition.caseId,

      schoolId:
        definition.schoolId,

      absentStaffMemberId:
        BEFOREBELL_DEMO_SCENARIO_B_BASELINE
          .absentStaffMemberId,

      status:
        "partially_covered",

      updatedAt:
        BEFOREBELL_DEMO_SCENARIO_B_BASELINE
          .updatedAt,
    });


    const [
      finalCase,
      finalAssignments,
      finalDecisions,
      finalActivity,
    ] =
      await Promise.all([
        store.getCase(
          definition.caseId,
        ),

        store.listAssignmentsByCase(
          definition.caseId,
        ),

        store.listDecisionsByCase(
          definition.caseId,
        ),

        store.listActivityByCase(
          definition.caseId,
        ),
      ]);


    assert(
      finalCase?.status ===
        "partially_covered",
      "Scenario B reset did not restore partially_covered status.",
    );


    assert(
      finalAssignments.length ===
        1,
      `Scenario B reset expected exactly one baseline assignment but found ${finalAssignments.length}.`,
    );


    const finalRoutineAssignment =
      finalAssignments[0];


    assert(
      finalRoutineAssignment.id ===
        BEFOREBELL_DEMO_SCENARIO_B_BASELINE
          .routineAssignmentId,
      "Scenario B reset preserved the wrong assignment.",
    );


    assert(
      samePeriods(
        finalRoutineAssignment.periodIds,
        [
          "P2",
          "P3",
        ],
      ),
      "Scenario B reset did not preserve exactly P2/P3 routine coverage.",
    );


    assert(
      finalDecisions.length ===
        0,
      `Scenario B reset still has ${finalDecisions.length} human decision(s).`,
    );


    assert(
      finalActivity.length ===
        0,
      `Scenario B reset still has ${finalActivity.length} activity event(s).`,
    );


    return {
      caseId:
        definition.caseId,

      caseStatus:
        "partially_covered",

      coveredPeriods: [
        "P2",
        "P3",
      ],

      removedAssignments:
        extraAssignments.length,

      removedDecisions:
        decisions.length,

      removedActivityEvents:
        activity.length,

      idempotentReplay:
        alreadyBaseline,
    };
  } finally {
    serviceClient.destroy();
  }
}