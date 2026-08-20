import "server-only";

import {
  buildExceptionDecisionRequest,
} from "@/agent/tools/request-exception-decision";

import {
  BEFOREBELL_DEMO_CASES,
  BEFOREBELL_DEMO_EXTERNAL_SUBSTITUTE,
  getBeforeBellDemoCase,
} from "@/demo/beforebell-demo";

import type {
  AbsenceCaseStatus,
  ActivityEvent,
  CoverageOffer,
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


export interface CoverageAssignmentView {
  id:
    string;

  candidateId:
    string;

  candidateName:
    string;

  periodIds:
    PeriodId[];

  source:
    "accepted_offer" |
    "approved_exception";
}

export interface CoverageOfferView {
  id:
    string;

  candidateId:
    string;

  candidateName:
    string;

  periodIds:
    PeriodId[];

  status:
    CoverageOffer["status"];

  createdAt:
    string;

  expiresAt:
    string;

  respondedAt?:
    string;
}

export interface CoverageActivityEventView {
  eventId:
    ActivityEvent["eventId"];

  timestamp:
    ActivityEvent["timestamp"];

  actorType:
    ActivityEvent["actorType"];

  action:
    ActivityEvent["action"];

  toolName?:
    ActivityEvent["toolName"];

  status:
    ActivityEvent["status"];

  summary:
    ActivityEvent["summary"];

  durationMs?:
    ActivityEvent["durationMs"];

  correlationId:
    ActivityEvent["correlationId"];
}

export interface CoverageCaseView {
  id:
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

  subject:
    string;

  date:
    string;

  status:
    AbsenceCaseStatus;

  affectedPeriods:
    PeriodId[];

  coveredPeriods:
    PeriodId[];

  unresolvedPeriods:
    PeriodId[];

  assignments:
  CoverageAssignmentView[];

offers:
  CoverageOfferView[];

decisionCount:
  number;

  approvedDecision?: {
  id:
    string;

  kind:
    string;

  summary:
    string;

  periodIds:
    PeriodId[];
};  

    activityCount:
    number;

  activityEvents:
    CoverageActivityEventView[];

  needsAdministratorDecision:
    boolean;
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


export async function loadCoverageCase(
  caseId:
    string,
): Promise<
  CoverageCaseView |
  undefined
> {
  const definition =
    getBeforeBellDemoCase(
      caseId,
    );

  if (!definition) {
    return undefined;
  }

  const authoritativeStore =
    getStore();

  const absenceCase =
    await authoritativeStore
      .getCase(
        caseId,
      );

  if (!absenceCase) {
    return undefined;
  }


  const [
  assignments,
  offers,
  decisions,
  activity,
] =
  await Promise.all([
    authoritativeStore
      .listAssignmentsByCase(
        caseId,
      ),

    authoritativeStore
      .listOffersByCase(
        caseId,
      ),

    authoritativeStore
      .listDecisionsByCase(
        caseId,
      ),

    authoritativeStore
      .listActivityByCase(
        caseId,
      ),
  ]);


  const assignmentViews:
    CoverageAssignmentView[] =
      await Promise.all(
        assignments.map(
          async (
            assignment,
          ) => {
            const candidate =
              await authoritativeStore
                .getCandidate(
                  assignment.candidateId,
                );

            return {
              id:
                assignment.id,

              candidateId:
                assignment.candidateId,

              candidateName:
  candidate?.name ??
  (
    assignment.candidateId ===
    BEFOREBELL_DEMO_EXTERNAL_SUBSTITUTE.id
      ? BEFOREBELL_DEMO_EXTERNAL_SUBSTITUTE.name
      : assignment.candidateId
  ),

              periodIds: [
                ...assignment.periodIds,
              ],

              source:
                assignment.source,
            };
          },
        ),
      );

const offerViews:
  CoverageOfferView[] =
    await Promise.all(
      offers.map(
        async (
          offer,
        ) => {
          const candidate =
            await authoritativeStore
              .getCandidate(
                offer.candidateId,
              );

          return {
            id:
              offer.id,

            candidateId:
              offer.candidateId,

            candidateName:
              candidate?.name ??
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
        },
      ),
    );

const activityViews:
  CoverageActivityEventView[] =
    activity.map(
      (
        event,
      ) => ({
        eventId:
          event.eventId,

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
      }),
    );

  const coveredPeriods =
    [
      ...new Set(
        assignments.flatMap(
          (
            assignment,
          ) =>
            assignment.periodIds,
        ),
      ),
    ]
      .sort();


  const coveredSet =
    new Set(
      coveredPeriods,
    );


  const unresolvedPeriods =
    absenceCase
      .affectedPeriods
      .filter(
        (
          periodId,
        ) =>
          !coveredSet.has(
            periodId,
          ),
      );

  const unresolvedSet =
  new Set(
    unresolvedPeriods,
  );


const approvedDecisions =
  decisions
    .filter(
      (
        decision,
      ) =>
        decision.status ===
        "approved",
    )
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


const approvedDecision =
  approvedDecisions[0];


const approvedDecisionForUnresolvedPeriods =
  approvedDecisions.find(
    (
      decision,
    ) =>
      decision.periodIds.some(
        (
          periodId,
        ) =>
          unresolvedSet.has(
            periodId,
          ),
      ),
  );

  let needsAdministratorDecision =
    false;

  if (
  unresolvedPeriods.length >
    0 &&
  !approvedDecisionForUnresolvedPeriods &&
  absenceCase.status !==
    "resolved" &&
  absenceCase.status !==
    "closed"
) {
    const exceptionRequest =
      await buildExceptionDecisionRequest(
        authoritativeStore,
        {
          caseId,
        },
      );

    needsAdministratorDecision =
      exceptionRequest.success &&
      Boolean(
        exceptionRequest.data &&
        exceptionRequest.data
          .unresolvedPeriodIds
          .length >
          0,
      );
  }


  return {
    id:
      absenceCase.id,

    scenario:
      definition.scenario,

    schoolName:
      definition.schoolName,

    staffName:
      definition.staffName,

    roleLabel:
      definition.roleLabel,

    subject:
      absenceCase.subject,

    date:
      absenceCase.date,

    status:
      absenceCase.status,

    affectedPeriods: [
      ...absenceCase.affectedPeriods,
    ],

    coveredPeriods:
      coveredPeriods as PeriodId[],

    unresolvedPeriods: [
      ...unresolvedPeriods,
    ],

    assignments:
  assignmentViews,

offers:
  offerViews,

decisionCount:
  decisions.length,

...(approvedDecision
  ? {
      approvedDecision: {
        id:
          approvedDecision.id,

        kind:
          approvedDecision.kind,

        summary:
          approvedDecision.summary,

        periodIds: [
          ...approvedDecision.periodIds,
        ],
      },
    }
  : {}),

activityCount:
  activityViews.length,

activityEvents:
  activityViews,

    needsAdministratorDecision,
  };
}


export async function loadCoverageBoard():
  Promise<
    CoverageCaseView[]
  > {
  const cases =
    await Promise.all(
      BEFOREBELL_DEMO_CASES.map(
        (
          definition,
        ) =>
          loadCoverageCase(
            definition.caseId,
          ),
      ),
    );

  return cases.filter(
    (
      currentCase,
    ): currentCase is CoverageCaseView =>
      currentCase !==
      undefined,
  );
}