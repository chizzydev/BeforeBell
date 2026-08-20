import {
  tool,
} from "@strands-agents/sdk";

import type {
  JSONValue,
} from "@strands-agents/sdk";

import {
  z,
} from "zod";

import type {
  ActionResult,
} from "@/application/action-result";

import {
  planCoverageCase,
} from "@/application/actions/plan-coverage-case";

import {
  recordApprovedExceptionDecision,
} from "@/application/actions/record-approved-exception-decision";

import type {
  RecordApprovedExceptionDecisionData,
} from "@/application/actions/record-approved-exception-decision";

import {
  buildStableOperationId,
} from "@/application/idempotency";

import {
  runApplicationOperation,
} from "@/application/operation-runner";

import type {
  BeforeBellStore,
} from "@/application/store/beforebell-store";

import {
  buildCoverageExceptionOptions,
} from "@/domain/coverage/exceptions";

import type {
  HumanDecisionKind,
  PeriodId,
} from "@/domain/types";

export interface ExceptionDecisionOption {
  optionId: string;
  kind: HumanDecisionKind;
  periodIds: PeriodId[];
  candidateId?: string;
  candidateName?: string;
  requiresAdministratorApproval: true;
  summary: string;
}

export interface ExceptionDecisionRequestData {
  caseId: string;
  unresolvedPeriodIds: PeriodId[];
  options: ExceptionDecisionOption[];
}

interface HumanExceptionDecisionResponse {
  optionId: string;
}

export type RequestExceptionDecisionClockStage =
  | "waiting"
  | "approved";


export interface RequestExceptionDecisionToolOptions {
  now?: (
    stage:
      RequestExceptionDecisionClockStage,
    caseId:
      string,
  ) => Date;

  /**
   * Synthetic administrator identity for the local hackathon workflow.
   *
   * The hosted application will later inject the authenticated
   * administrator identity rather than trusting model or client input.
   */
  decidedBy?: string;
}

export interface RecordValidatedExceptionSelectionInput {
  caseId: string;
  optionId: string;
  now: Date;
  decidedBy: string;
}

const humanExceptionDecisionResponseSchema =
  z.object({
    optionId: z
      .string()
      .min(1),
  });

function buildExceptionOptionId(
  caseId: string,
  kind: HumanDecisionKind,
  periodIds: readonly PeriodId[],
  candidateId?: string,
): string {
  const canonicalPeriods = [
    ...periodIds,
  ].sort();

  const operationKey = [
    "coverage-exception-option",
    caseId,
    kind,
    candidateId ?? "no-candidate",
    canonicalPeriods.join(","),
  ].join(":");

  return buildStableOperationId(
    "exception-option",
    operationKey,
  );
}

/**
 * Builds the exact human-judgment choices from authoritative BeforeBell state.
 *
 * This helper does not interrupt, approve, persist, assign, notify, or mutate.
 */
export async function buildExceptionDecisionRequest(
  store: BeforeBellStore,
  input: {
    caseId: string;
  },
): Promise<
  ActionResult<ExceptionDecisionRequestData>
> {
  const absenceCase =
    await store.getCase(
      input.caseId,
    );

  if (!absenceCase) {
    return {
      success: false,
      code:
        "case_not_found",
      message:
        "Coverage case was not found.",
      retryable: false,
    };
  }

  if (
    absenceCase.status ===
      "resolved" ||
    absenceCase.status ===
      "closed"
  ) {
    return {
      success: false,
      code:
        "case_not_actionable",
      message:
        "The coverage case is no longer actionable and does not require an exception decision.",
      retryable: false,
    };
  }

  const [
    policy,
    candidates,
    existingAssignments,
    planningResult,
  ] = await Promise.all([
    store.getPolicy(
      absenceCase.schoolId,
    ),

    store.listCandidatesBySchool(
      absenceCase.schoolId,
    ),

    store.listAssignmentsByCase(
      absenceCase.id,
    ),

    planCoverageCase(
      store,
      {
        caseId:
          absenceCase.id,
      },
    ),
  ]);

  if (!policy) {
    return {
      success: false,
      code:
        "policy_not_found",
      message:
        "Coverage policy was not found for the case school.",
      retryable: false,
    };
  }

  if (
    !planningResult.success ||
    !planningResult.data
  ) {
    return {
      success: false,
      code:
        planningResult.code,
      message:
        planningResult.message,
      retryable:
        planningResult.retryable,
    };
  }

  const unresolvedPeriodIds = [
    ...planningResult.data.plan
      .unresolvedPeriodIds,
  ];

  if (
    unresolvedPeriodIds.length ===
    0
  ) {
    return {
      success: false,
      code:
        "no_exception_decision_required",
      message:
        "The deterministic planner has no unresolved coverage periods requiring administrator judgment.",
      retryable: false,
    };
  }

  const exceptionOptions =
    buildCoverageExceptionOptions({
      unresolvedPeriodIds,
      candidates,
      policy,
      existingAssignments,
    });

  if (
    exceptionOptions.length ===
    0
  ) {
    return {
      success: false,
      code:
        "no_exception_options_available",
      message:
        "Coverage remains unresolved, but the deterministic policy layer produced no administrator-approved exception options.",
      retryable: false,
    };
  }

  const options =
    exceptionOptions.map(
      (
        option,
      ): ExceptionDecisionOption => ({
        optionId:
          buildExceptionOptionId(
            absenceCase.id,
            option.kind,
            option.periodIds,
            option.candidateId,
          ),

        kind:
          option.kind,

        periodIds: [
          ...option.periodIds,
        ],

        ...(option.candidateId
          ? {
              candidateId:
                option.candidateId,
            }
          : {}),

        ...(option.candidateName
          ? {
              candidateName:
                option.candidateName,
            }
          : {}),

        requiresAdministratorApproval:
          true,

        summary:
          option.summary,
      }),
    );

  return {
    success: true,
    code:
      "exception_decision_required",
    message:
      "Routine coverage cannot resolve all required periods. Administrator judgment is required.",
    retryable: false,
    data: {
      caseId:
        absenceCase.id,

      unresolvedPeriodIds,

      options,
    },
  };
}

function buildExceptionDecisionWaitingActivityEventId(
  request:
    ExceptionDecisionRequestData,
): string {
  const optionIds =
    request.options
      .map(
        (option) =>
          option.optionId,
      )
      .sort();

  return buildStableOperationId(
    "activity",
    [
      "human-exception-decision-requested",
      request.caseId,
      ...optionIds,
    ].join(":"),
  );
}


export async function recordExceptionDecisionWaitingActivity(
  store:
    BeforeBellStore,
  request:
    ExceptionDecisionRequestData,
  now:
    Date,
): Promise<void> {
  const eventId =
    buildExceptionDecisionWaitingActivityEventId(
      request,
    );

  const existingEvents =
    await store.listActivityByCase(
      request.caseId,
    );

  const existing =
    existingEvents.find(
      (event) =>
        event.eventId ===
        eventId,
    );

  if (
    !existing &&
    Number.isNaN(
      now.getTime(),
    )
  ) {
    throw new Error(
      "Human-decision waiting evidence received an invalid timestamp.",
    );
  }

  /**
   * On Strands resume the tool is entered again before context.interrupt()
   * returns the human response.
   *
   * Preserve the first authoritative timestamp so appendActivity can verify
   * an exact idempotent replay instead of conflicting with a later wall clock.
   */
  const timestamp =
    existing?.timestamp ??
    now.toISOString();

  await store.appendActivity({
    eventId,

    caseId:
      request.caseId,

    timestamp,

    actorType:
      "agent",

    action:
      "human_exception_decision_requested",

    toolName:
      "request_exception_decision",

    status:
      "waiting",

    summary:
      `BeforeBell reached a policy boundary for ${request.unresolvedPeriodIds.join(
        ", ",
      )} and is waiting for administrator judgment.`,

    correlationId:
      buildStableOperationId(
        "correlation",
        request.caseId,
      ),
  });
}

/**
 * Revalidates a human-selected option against current authoritative state
 * immediately before persistence.
 *
 * The caller supplies only the stable option ID. Kind, periods, candidate,
 * and summary are all reloaded from BeforeBell's deterministic exception
 * layer.
 */
export async function recordValidatedExceptionSelection(
  store: BeforeBellStore,
  input: RecordValidatedExceptionSelectionInput,
): Promise<
  ActionResult<RecordApprovedExceptionDecisionData>
> {
  const requestResult =
    await buildExceptionDecisionRequest(
      store,
      {
        caseId:
          input.caseId,
      },
    );

  if (
    !requestResult.success ||
    !requestResult.data
  ) {
    return {
      success: false,
      code:
        requestResult.code,
      message:
        requestResult.message,
      retryable:
        requestResult.retryable,
    };
  }

  const selectedOption =
    requestResult.data.options.find(
      (option) =>
        option.optionId ===
        input.optionId,
    );

  if (!selectedOption) {
    return {
      success: false,
      code:
        "human_exception_selection_not_authoritative",
      message:
        "The selected option is not one of the exception choices currently permitted by authoritative BeforeBell state.",
      retryable: false,
    };
  }

  const operationKey = [
    "human-exception-decision",
    input.caseId,
    selectedOption.optionId,
  ].join(":");

  const decisionId =
    buildStableOperationId(
      "decision",
      operationKey,
    );

  const activityEventId =
    buildStableOperationId(
      "activity",
      `${operationKey}:approved`,
    );

  const correlationId =
    buildStableOperationId(
      "correlation",
      input.caseId,
    );

  return runApplicationOperation({
    operationName:
      "record_human_exception_decision",

    retryPolicy:
      "safe_same_identity",

    execute: () =>
      recordApprovedExceptionDecision(
        store,
        {
          decisionId,

          caseId:
            input.caseId,

          kind:
            selectedOption.kind,

          periodIds:
            selectedOption.periodIds,

          ...(selectedOption.candidateId
            ? {
                candidateId:
                  selectedOption.candidateId,
              }
            : {}),

          summary:
            selectedOption.summary,

          now:
            input.now,

          decidedBy:
            input.decidedBy,

          activityEventId,

          correlationId,
        },
      ),
  });
}

export function createRequestExceptionDecisionTool(
  store: BeforeBellStore,
  options: RequestExceptionDecisionToolOptions = {},
) {
 const getNow:
  NonNullable<
    RequestExceptionDecisionToolOptions["now"]
  > =
    options.now ??
    (() => new Date());

  const decidedBy =
    options.decidedBy ??
    "administrator-demo";

  if (
    decidedBy.trim().length ===
    0
  ) {
    throw new Error(
      "Administrator identity must not be empty.",
    );
  }

  return tool({
    name:
      "request_exception_decision",

    description:
      "Pause BeforeBell for a real administrator decision when deterministic planning leaves coverage periods unresolved. The tool independently computes the currently permitted choices. On resume, it revalidates the selected option and records the administrator decision authoritatively and idempotently. It does not execute the approved exception, assign coverage, notify anyone, combine groups, use protected planning, or obtain an external substitute.",

    inputSchema: z.object({
      caseId: z
        .string()
        .min(1)
        .describe(
          "The authoritative BeforeBell coverage case ID.",
        ),
    }),

    callback: async (
      {
        caseId,
      },
      context,
    ) => {
      /**
       * Recompute authoritative state every time the tool executes.
       *
       * On resume Strands re-enters the tool. This prevents a stale human
       * response from silently bypassing current BeforeBell state.
       */
      const requestResult =
        await buildExceptionDecisionRequest(
          store,
          {
            caseId,
          },
        );

      if (
        !requestResult.success ||
        !requestResult.data
      ) {
        return {
          success: false,
          code:
            requestResult.code,
          message:
            requestResult.message,
          retryable:
            requestResult.retryable,
        };
      }

      const decisionRequest =
        requestResult.data;

      if (!context) {
        return {
          success: false,
          code:
            "interrupt_context_unavailable",
          message:
            "Strands did not provide the tool execution context required for human-in-the-loop interruption.",
          retryable: false,
        };
      }

      const interruptOptions:
        JSONValue[] =
          decisionRequest.options.map(
            (
              option,
            ): JSONValue => {
              const jsonOption: {
                [key: string]:
                  JSONValue;
              } = {
                optionId:
                  option.optionId,

                kind:
                  option.kind,

                periodIds: [
                  ...option.periodIds,
                ],

                requiresAdministratorApproval:
                  true,

                summary:
                  option.summary,
              };

              if (
                option.candidateId
              ) {
                jsonOption.candidateId =
                  option.candidateId;
              }

              if (
                option.candidateName
              ) {
                jsonOption.candidateName =
                  option.candidateName;
              }

              return jsonOption;
            },
          );

      const interruptReason:
        JSONValue = {
          type:
            "coverage_exception_decision_required",

          caseId:
            decisionRequest.caseId,

          unresolvedPeriodIds: [
            ...decisionRequest
              .unresolvedPeriodIds,
          ],

          instruction:
            "Administrator judgment is required. Select exactly one authoritative option by optionId.",

          options:
            interruptOptions,
        };

      /**
       * First execution stops here.
       *
       * On resume, Strands returns the administrator's response from this
       * exact interrupt call.
       */
      await recordExceptionDecisionWaitingActivity(
  store,
  decisionRequest,
  getNow(
    "waiting",
    decisionRequest.caseId,
  ),
);
      const humanResponse =
        context.interrupt<
          HumanExceptionDecisionResponse
        >({
          name:
            "beforebell_exception_decision",

          reason:
            interruptReason,
        });

      const parsedResponse =
        humanExceptionDecisionResponseSchema
          .safeParse(
            humanResponse,
          );

      if (
        !parsedResponse.success
      ) {
        return {
          success: false,
          code:
            "invalid_human_decision_response",
          message:
            "The administrator response was not a valid BeforeBell exception selection.",
          retryable: false,
        };
      }

      /**
       * Revalidate the option AGAIN after the interrupt returns.
       *
       * The selected option ID is the only decision datum trusted from the
       * human-facing response. Kind, candidate, periods, and summary are
       * reconstructed from current authoritative state.
       */
      return recordValidatedExceptionSelection(
        store,
        {
          caseId:
            decisionRequest.caseId,

          optionId:
            parsedResponse.data
              .optionId,
          now:
       getNow(
       "approved",
      decisionRequest.caseId,
  ),
          decidedBy,
        },
      );
    },
  });
}