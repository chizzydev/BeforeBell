import "server-only";

import {
  BEFOREBELL_DEMO_CASES,
  BEFOREBELL_DEMO_EXTERNAL_SUBSTITUTE,
} from "@/demo/beforebell-demo";

import type {
  HumanDecisionKind,
  HumanDecisionStatus,
  PeriodId,
} from "@/domain/types";

import {
  createBeforeBellDynamoClients,
} from "@/infrastructure/dynamodb/client";

import {
  DynamoDbBeforeBellStore,
} from "@/infrastructure/dynamodb/dynamodb-beforebell-store";

import {
  getBeforeBellDynamoConfig,
} from "@/infrastructure/dynamodb/env";


export type DecisionExecutionState =
  | "pending"
  | "approved_pending_execution"
  | "fulfilled"
  | "rejected";


export interface HumanDecisionView {
  id:
    string;

  caseId:
    string;

  scenario:
    "A" |
    "B" |
    "C";

  schoolName:
    string;

  staffName:
    string;

  roleLabel:
    string;

  kind:
    HumanDecisionKind;

  kindLabel:
    string;

  status:
    HumanDecisionStatus;

  periodIds:
    PeriodId[];

  summary:
    string;

  requestedAt:
    string;

  decidedAt?:
    string;

  decidedBy?:
    string;

  executionState:
    DecisionExecutionState;

  assignmentId?:
    string;

  fulfilledBy?:
    string;
}


let store:
  DynamoDbBeforeBellStore |
  undefined;


function getStore():
  DynamoDbBeforeBellStore {
  if (
    store
  ) {
    return store;
  }


  const config =
    getBeforeBellDynamoConfig();


  const {
    documentClient,
  } =
    createBeforeBellDynamoClients(
      config,
    );


  store =
    new DynamoDbBeforeBellStore({
      documentClient,

      tableName:
        config.tableName,
    });


  return store;
}


function getDecisionKindLabel(
  kind:
    HumanDecisionKind,
): string {
  switch (
    kind
  ) {
    case "use_protected_planning_period":
      return "Protected planning period";

    case "request_external_substitute":
      return "External substitute";

    case "combine_coverage_groups":
      return "Combine coverage groups";
  }
}


function getExecutionState(
  status:
    HumanDecisionStatus,
  hasAssignment:
    boolean,
): DecisionExecutionState {
  if (
    status ===
    "pending"
  ) {
    return "pending";
  }


  if (
    status ===
    "rejected"
  ) {
    return "rejected";
  }


  return hasAssignment
    ? "fulfilled"
    : "approved_pending_execution";
}


export async function loadHumanDecisionBoard():
  Promise<
    HumanDecisionView[]
  > {
  const authoritativeStore =
    getStore();


  const caseDecisions =
    await Promise.all(
      BEFOREBELL_DEMO_CASES.map(
        async (
          definition,
        ) => {
          const [
            decisions,
            assignments,
          ] =
            await Promise.all([
              authoritativeStore
                .listDecisionsByCase(
                  definition.caseId,
                ),

              authoritativeStore
                .listAssignmentsByCase(
                  definition.caseId,
                ),
            ]);


          return Promise.all(
            decisions.map(
              async (
                decision,
              ): Promise<HumanDecisionView> => {
                const assignment =
                  assignments.find(
                    (
                      currentAssignment,
                    ) =>
                      currentAssignment
                        .decisionId ===
                      decision.id,
                  );


                let fulfilledBy:
                  string |
                  undefined;


                if (
                  assignment
                ) {
                  const candidate =
                    await authoritativeStore
                      .getCandidate(
                        assignment.candidateId,
                      );


                  fulfilledBy =
                    candidate?.name ??
                    (
                      assignment.candidateId ===
                      BEFOREBELL_DEMO_EXTERNAL_SUBSTITUTE.id
                        ? BEFOREBELL_DEMO_EXTERNAL_SUBSTITUTE.name
                        : assignment.candidateId
                    );
                }


                return {
                  id:
                    decision.id,

                  caseId:
                    decision.caseId,

                  scenario:
                    definition.scenario,

                  schoolName:
                    definition.schoolName,

                  staffName:
                    definition.staffName,

                  roleLabel:
                    definition.roleLabel,

                  kind:
                    decision.kind,

                  kindLabel:
                    getDecisionKindLabel(
                      decision.kind,
                    ),

                  status:
                    decision.status,

                  periodIds: [
                    ...decision.periodIds,
                  ],

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

                  executionState:
                    getExecutionState(
                      decision.status,
                      Boolean(
                        assignment,
                      ),
                    ),

                  ...(assignment
                    ? {
                        assignmentId:
                          assignment.id,
                      }
                    : {}),

                  ...(fulfilledBy
                    ? {
                        fulfilledBy,
                      }
                    : {}),
                };
              },
            ),
          );
        },
      ),
    );


  return caseDecisions
    .flat()
    .sort(
      (
        left,
        right,
      ) =>
        (
          right.decidedAt ??
          right.requestedAt
        ).localeCompare(
          left.decidedAt ??
          left.requestedAt,
        ),
    );
}