import "server-only";

import {
  randomUUID,
} from "node:crypto";

import {
  reconcileCoverageCase,
} from "@/application/actions/reconcile-coverage-case";

import {
  respondToCoverageOffer,
} from "@/application/actions/respond-to-coverage-offer";

import {
  BEFOREBELL_DEMO_CASES,
} from "@/demo/beforebell-demo";

import type {
  CoverageCandidate,
  CoverageOffer,
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

import {
  coordinateCoverageCase,
} from "@/server/agentcore/beforebell-agentcore-gateway";


export type ScenarioCDemoAction =
  | "coordinate"
  | "emma_declines"
  | "noah_accepts";


export interface ScenarioCDemoActionResult {
  action:
    ScenarioCDemoAction;

  caseId:
    string;

  caseStatus:
    string;

  message:
    string;

  agentRuntimeSessionId?:
    string;
}


export class ScenarioCDemoFlowError
  extends Error {
  constructor(
    public readonly code:
      string,

    message:
      string,

    public readonly status:
      number,
  ) {
    super(
      message,
    );

    this.name =
      "ScenarioCDemoFlowError";
  }
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


function getScenarioCDefinition() {
  const definition =
    BEFOREBELL_DEMO_CASES.find(
      (
        currentCase,
      ) =>
        currentCase.scenario ===
        "C",
    );

  if (
    !definition
  ) {
    throw new ScenarioCDemoFlowError(
      "SCENARIO_C_DEFINITION_MISSING",
      "The fixed BeforeBell Scenario C definition is unavailable.",
      500,
    );
  }

  return definition;
}


function findCandidateByName(
  candidates:
    readonly CoverageCandidate[],

  name:
    string,
): CoverageCandidate {
  const candidate =
    candidates.find(
      (
        currentCandidate,
      ) =>
        currentCandidate.name ===
        name,
    );

  if (
    !candidate
  ) {
    throw new ScenarioCDemoFlowError(
      "SCENARIO_C_CANDIDATE_MISSING",
      `The authoritative Scenario C candidate "${name}" is unavailable.`,
      409,
    );
  }

  return candidate;
}


function findPendingOffer(
  offers:
    readonly CoverageOffer[],

  candidateId:
    string,
): CoverageOffer | undefined {
  return offers.find(
    (
      offer,
    ) =>
      offer.candidateId ===
        candidateId &&
      offer.status ===
        "pending",
  );
}


async function invokeScenarioCCoordinator(
  caseId:
    string,
): Promise<string> {
  let result:
    Awaited<
      ReturnType<
        typeof coordinateCoverageCase
      >
    >;

  try {
    result =
      await coordinateCoverageCase(
        caseId,
      );
  } catch (
    error
  ) {
    console.error(
      "Scenario C AgentCore coordination failed.",
      error,
    );

    throw new ScenarioCDemoFlowError(
      "SCENARIO_C_AGENTCORE_FAILED",
      "BeforeBell could not complete the Scenario C AgentCore coordination step.",
      502,
    );
  }

  if (
    result.status !==
    "completed"
  ) {
    throw new ScenarioCDemoFlowError(
      "SCENARIO_C_AGENT_DID_NOT_COMPLETE",
      "Scenario C unexpectedly stopped before routine coordination completed.",
      502,
    );
  }

  return result.sessionId;
}


async function coordinateScenarioC():
  Promise<ScenarioCDemoActionResult> {
  const authoritativeStore =
    getStore();

  const definition =
    getScenarioCDefinition();

  const absenceCase =
    await authoritativeStore.getCase(
      definition.caseId,
    );

  if (
    !absenceCase
  ) {
    throw new ScenarioCDemoFlowError(
      "SCENARIO_C_NOT_SEEDED",
      "The persistent Scenario C demo state has not been seeded.",
      409,
    );
  }

  const runtimeSessionId =
    await invokeScenarioCCoordinator(
      definition.caseId,
    );

  const currentCase =
    await authoritativeStore.getCase(
      definition.caseId,
    );

  if (
    !currentCase
  ) {
    throw new ScenarioCDemoFlowError(
      "SCENARIO_C_STATE_MISSING",
      "Scenario C disappeared after coordination.",
      500,
    );
  }

  return {
    action:
      "coordinate",

    caseId:
      definition.caseId,

    caseStatus:
      currentCase.status,

    message:
      "Scenario C coordination completed against authoritative state.",

    agentRuntimeSessionId:
      runtimeSessionId,
  };
}

async function recordEmmaDeclineAndFallback():
  Promise<ScenarioCDemoActionResult> {
  const authoritativeStore =
    getStore();

  const definition =
    getScenarioCDefinition();

  const [
    absenceCase,
    candidates,
    offers,
  ] =
    await Promise.all([
      authoritativeStore.getCase(
        definition.caseId,
      ),

      authoritativeStore
        .listCandidatesBySchool(
          definition.schoolId,
        ),

      authoritativeStore
        .listOffersByCase(
          definition.caseId,
        ),
    ]);


  if (
    !absenceCase
  ) {
    throw new ScenarioCDemoFlowError(
      "SCENARIO_C_NOT_SEEDED",
      "The persistent Scenario C demo state has not been seeded.",
      409,
    );
  }


  const emma =
    findCandidateByName(
      candidates,
      "Emma Brooks",
    );

  const noah =
    findCandidateByName(
      candidates,
      "Noah Carter",
    );


  const emmaOffer =
    offers.find(
      (
        offer,
      ) =>
        offer.candidateId ===
        emma.id,
    );


  const existingNoahPendingOffer =
    findPendingOffer(
      offers,
      noah.id,
    );


  /**
   * Browser/network replay after the successful fallback.
   *
   * Emma's decline and Noah's pending offer are already authoritative,
   * so repeating the same demo action is a successful no-op.
   */
  if (
    emmaOffer?.status ===
      "declined" &&
    existingNoahPendingOffer
  ) {
    return {
      action:
        "emma_declines",

      caseId:
        definition.caseId,

      caseStatus:
        absenceCase.status,

      message:
        "Emma Brooks's decline was already recorded and Noah Carter's fallback offer is already active.",
    };
  }


  if (
    absenceCase.status ===
      "resolved" ||
    absenceCase.status ===
      "closed"
  ) {
    throw new ScenarioCDemoFlowError(
      "SCENARIO_C_ALREADY_RESOLVED",
      "Scenario C is already resolved.",
      409,
    );
  }


  if (
    !emmaOffer
  ) {
    throw new ScenarioCDemoFlowError(
      "SCENARIO_C_EMMA_OFFER_MISSING",
      "Emma Brooks does not have an authoritative Scenario C offer.",
      409,
    );
  }


  const now =
    new Date();

  const correlationId =
    `demo-scenario-c-emma-decline-${randomUUID()}`;


  /**
   * respondToCoverageOffer is itself idempotent.
   *
   * If Emma was already declined but the original request stopped
   * before fallback coordination finished, this safely resumes from
   * the persisted response instead of rejecting the replay.
   */
  const response =
    await respondToCoverageOffer(
      authoritativeStore,
      {
        offerId:
          emmaOffer.id,

        response:
          "declined",

        now,

        activityEventId:
          `event-${randomUUID()}`,

        correlationId,
      },
    );


  if (
    !response.success
  ) {
    throw new ScenarioCDemoFlowError(
      "SCENARIO_C_EMMA_DECLINE_REJECTED",
      response.message,
      409,
    );
  }


  const reconciliation =
    await reconcileCoverageCase(
      authoritativeStore,
      {
        caseId:
          definition.caseId,

        now:
          new Date(
            now.getTime() +
            1,
          ),

        activityEventId:
          `event-${randomUUID()}`,

        correlationId,
      },
    );


  if (
    !reconciliation.success
  ) {
    throw new ScenarioCDemoFlowError(
      "SCENARIO_C_RECONCILE_FAILED",
      reconciliation.message,
      reconciliation.retryable
        ? 503
        : 409,
    );
  }


  const runtimeSessionId =
    await invokeScenarioCCoordinator(
      definition.caseId,
    );


  const [
    currentCase,
    currentOffers,
  ] =
    await Promise.all([
      authoritativeStore.getCase(
        definition.caseId,
      ),

      authoritativeStore
        .listOffersByCase(
          definition.caseId,
        ),
    ]);


  if (
    !currentCase
  ) {
    throw new ScenarioCDemoFlowError(
      "SCENARIO_C_STATE_MISSING",
      "Scenario C disappeared after fallback coordination.",
      500,
    );
  }


  const persistedEmmaDecline =
    currentOffers.find(
      (
        offer,
      ) =>
        offer.candidateId ===
          emma.id &&
        offer.status ===
          "declined",
    );


  if (
    !persistedEmmaDecline
  ) {
    throw new ScenarioCDemoFlowError(
      "SCENARIO_C_DECLINE_NOT_PERSISTED",
      "Emma Brooks's authoritative decline was not preserved.",
      500,
    );
  }


  const noahFallbackOffer =
    findPendingOffer(
      currentOffers,
      noah.id,
    );


  if (
    !noahFallbackOffer
  ) {
    throw new ScenarioCDemoFlowError(
      "SCENARIO_C_FALLBACK_NOT_CREATED",
      "The deployed BeforeBell agent did not create the expected authoritative Noah Carter fallback offer.",
      502,
    );
  }


  return {
    action:
      "emma_declines",

    caseId:
      definition.caseId,

    caseStatus:
      currentCase.status,

    message:
      "Emma Brooks declined. Her response was preserved and BeforeBell created the safe Noah Carter fallback offer.",

    agentRuntimeSessionId:
      runtimeSessionId,
  };
}

async function recordNoahAcceptanceAndResolve():
  Promise<ScenarioCDemoActionResult> {
  const authoritativeStore =
    getStore();

  const definition =
    getScenarioCDefinition();

  const [
    absenceCase,
    candidates,
    offers,
    existingAssignments,
    existingDecisions,
  ] =
    await Promise.all([
      authoritativeStore.getCase(
        definition.caseId,
      ),

      authoritativeStore
        .listCandidatesBySchool(
          definition.schoolId,
        ),

      authoritativeStore
        .listOffersByCase(
          definition.caseId,
        ),

      authoritativeStore
        .listAssignmentsByCase(
          definition.caseId,
        ),

      authoritativeStore
        .listDecisionsByCase(
          definition.caseId,
        ),
    ]);


  if (
    !absenceCase
  ) {
    throw new ScenarioCDemoFlowError(
      "SCENARIO_C_NOT_SEEDED",
      "The persistent Scenario C demo state has not been seeded.",
      409,
    );
  }


  const noah =
    findCandidateByName(
      candidates,
      "Noah Carter",
    );


  const noahOffer =
    offers.find(
      (
        offer,
      ) =>
        offer.candidateId ===
        noah.id,
    );


  const existingNoahAssignment =
    existingAssignments.find(
      (
        assignment,
      ) =>
        assignment.candidateId ===
          noah.id &&
        assignment.source ===
          "accepted_offer" &&
        definition.expectedPeriods.every(
          (
            periodId,
          ) =>
            assignment.periodIds.includes(
              periodId as typeof assignment.periodIds[number],
            ),
        ),
    );


  /**
   * Exact browser/network replay after Scenario C has already resolved.
   */
  if (
    absenceCase.status ===
      "resolved" &&
    existingNoahAssignment &&
    existingDecisions.length ===
      0
  ) {
    return {
      action:
        "noah_accepts",

      caseId:
        definition.caseId,

      caseStatus:
        "resolved",

      message:
        "Noah Carter's accepted fallback assignment was already recorded and Scenario C is already resolved.",
    };
  }


  if (
    absenceCase.status ===
      "closed"
  ) {
    throw new ScenarioCDemoFlowError(
      "SCENARIO_C_ALREADY_CLOSED",
      "Scenario C is already closed.",
      409,
    );
  }


  if (
    !noahOffer
  ) {
    throw new ScenarioCDemoFlowError(
      "SCENARIO_C_NOAH_OFFER_MISSING",
      "Noah Carter does not have the authoritative Scenario C fallback offer.",
      409,
    );
  }


  const now =
    new Date();

  const correlationId =
    `demo-scenario-c-noah-accept-${randomUUID()}`;


  /**
   * This call is safe for both:
   *
   * pending  -> accepted
   * accepted -> idempotent replay
   *
   * Candidate acceptance remains external authoritative input.
   */
  const response =
    await respondToCoverageOffer(
      authoritativeStore,
      {
        offerId:
          noahOffer.id,

        response:
          "accepted",

        now,

        activityEventId:
          `event-${randomUUID()}`,

        correlationId,
      },
    );


  if (
    !response.success
  ) {
    throw new ScenarioCDemoFlowError(
      "SCENARIO_C_NOAH_ACCEPTANCE_REJECTED",
      response.message,
      409,
    );
  }


  /*
   * Acceptance is not assignment.
   *
   * The deployed BeforeBell agent receives the persisted accepted
   * offer, revalidates current authoritative state and performs the
   * normal accepted-offer assignment path.
   */
  const runtimeSessionId =
    await invokeScenarioCCoordinator(
      definition.caseId,
    );


  const [
    currentCase,
    assignments,
    decisions,
  ] =
    await Promise.all([
      authoritativeStore.getCase(
        definition.caseId,
      ),

      authoritativeStore
        .listAssignmentsByCase(
          definition.caseId,
        ),

      authoritativeStore
        .listDecisionsByCase(
          definition.caseId,
        ),
    ]);


  if (
    !currentCase
  ) {
    throw new ScenarioCDemoFlowError(
      "SCENARIO_C_STATE_MISSING",
      "Scenario C disappeared after accepted-offer coordination.",
      500,
    );
  }


  const noahAssignment =
    assignments.find(
      (
        assignment,
      ) =>
        assignment.candidateId ===
          noah.id &&
        assignment.source ===
          "accepted_offer" &&
        assignment.offerId ===
          noahOffer.id &&
        definition.expectedPeriods.every(
          (
            periodId,
          ) =>
            assignment.periodIds.includes(
              periodId as typeof assignment.periodIds[number],
            ),
        ),
    );


  if (
    !noahAssignment
  ) {
    throw new ScenarioCDemoFlowError(
      "SCENARIO_C_ASSIGNMENT_NOT_CREATED",
      "No authoritative Noah Carter assignment was created after acceptance.",
      502,
    );
  }


  if (
    currentCase.status !==
    "resolved"
  ) {
    throw new ScenarioCDemoFlowError(
      "SCENARIO_C_NOT_RESOLVED",
      "Scenario C did not reach resolved state after the accepted fallback assignment.",
      502,
    );
  }


  if (
    decisions.length !==
    0
  ) {
    throw new ScenarioCDemoFlowError(
      "SCENARIO_C_UNEXPECTED_HUMAN_DECISION",
      "Scenario C unexpectedly created a human-decision record.",
      500,
    );
  }


  return {
    action:
      "noah_accepts",

    caseId:
      definition.caseId,

    caseStatus:
      currentCase.status,

    message:
      "Noah Carter accepted. BeforeBell revalidated the accepted offer, assigned all affected periods, and resolved Scenario C.",

    agentRuntimeSessionId:
      runtimeSessionId,
  };
}


export async function runScenarioCDemoAction(
  action:
    ScenarioCDemoAction,
): Promise<ScenarioCDemoActionResult> {
  switch (
    action
  ) {
    case "coordinate":
      return coordinateScenarioC();

    case "emma_declines":
      return recordEmmaDeclineAndFallback();

    case "noah_accepts":
      return recordNoahAcceptanceAndResolve();
  }
}