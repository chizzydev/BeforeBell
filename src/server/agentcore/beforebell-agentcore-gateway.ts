import "server-only";

import {
  BedrockAgentCoreClient,
  InvokeAgentRuntimeCommand,
  type InvokeAgentRuntimeCommandOutput,
} from "@aws-sdk/client-bedrock-agentcore";

import {
  randomUUID,
} from "node:crypto";

import {
  z,
} from "zod";


const DEFAULT_REGION =
  "us-east-1";

const DEFAULT_QUALIFIER =
  "DEFAULT";


const caseIdSchema =
  z.string()
    .trim()
    .min(1)
    .max(160)
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9._:-]*$/,
      "Case ID contains unsupported characters.",
    );


const runtimeSessionIdSchema =
  z.string()
    .trim()
    .min(33)
    .max(256)
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9_-]*$/,
      "Runtime session ID contains unsupported characters.",
    );


const opaqueRuntimeIdSchema =
  z.string()
    .trim()
    .min(1)
    .max(512);


export const beforeBellWebAgentRequestSchema =
  z.discriminatedUnion(
    "type",
    [
      z.object({
        type:
          z.literal(
            "coordinate_case",
          ),

        caseId:
          caseIdSchema,
      })
        .strict(),

      z.object({
        type:
          z.literal(
            "resume_exception",
          ),

        runtimeSessionId:
          runtimeSessionIdSchema,

        interruptId:
          opaqueRuntimeIdSchema,

        optionId:
          opaqueRuntimeIdSchema,
      })
        .strict(),
    ],
  );


const runtimeResponseSchema =
  z.object({
    status:
      z.enum([
        "interrupt",
        "completed",
        "stopped",
      ]),

    sessionId:
      runtimeSessionIdSchema,

    stopReason:
      z.string()
        .trim()
        .min(1),
  })
    .passthrough();


export type BeforeBellWebAgentRequest =
  z.infer<
    typeof beforeBellWebAgentRequestSchema
  >;


export type BeforeBellRuntimeResponse =
  z.infer<
    typeof runtimeResponseSchema
  >;


export class BeforeBellAgentCoreGatewayError extends Error {
  readonly code:
    string;

  readonly statusCode:
    number;


  constructor({
    code,
    message,
    statusCode,
    cause,
  }: {
    code: string;
    message: string;
    statusCode: number;
    cause?: unknown;
  }) {
    super(
      message,
      cause === undefined
        ? undefined
        : {
            cause,
          },
    );

    this.name =
      "BeforeBellAgentCoreGatewayError";

    this.code =
      code;

    this.statusCode =
      statusCode;
  }
}


let agentCoreClient:
  BedrockAgentCoreClient |
  undefined;


function getRegion():
  string {
  const configured =
    process.env.AWS_REGION
      ?.trim();

  return (
    configured ||
    DEFAULT_REGION
  );
}


function getRuntimeArn():
  string {
  const runtimeArn =
    process.env
      .BEFOREBELL_AGENTCORE_RUNTIME_ARN
      ?.trim();

  if (!runtimeArn) {
    throw new BeforeBellAgentCoreGatewayError({
      code:
        "AGENTCORE_RUNTIME_NOT_CONFIGURED",

      message:
        "BeforeBell AgentCore Runtime is not configured.",

      statusCode:
        500,
    });
  }

  if (
    !runtimeArn.startsWith(
      "arn:aws:bedrock-agentcore:",
    )
  ) {
    throw new BeforeBellAgentCoreGatewayError({
      code:
        "AGENTCORE_RUNTIME_ARN_INVALID",

      message:
        "BeforeBell AgentCore Runtime configuration is invalid.",

      statusCode:
        500,
    });
  }

  return runtimeArn;
}


function getAgentCoreClient():
  BedrockAgentCoreClient {
  if (
    agentCoreClient
  ) {
    return agentCoreClient;
  }

  agentCoreClient =
    new BedrockAgentCoreClient({
      region:
        getRegion(),
    });

  return agentCoreClient;
}


function createRuntimeSessionId():
  string {
  return (
    "beforebell-web-" +
    randomUUID()
      .replaceAll(
        "-",
        "",
      )
  );
}


function buildCoordinateCasePrompt(
  caseId:
    string,
): string {
  return `
Continue coordination for coverage case "${caseId}".

Inspect authoritative BeforeBell state.

Routine coverage may already exist for part of this absence.

Do not duplicate existing coverage.
Do not simulate candidate acceptance.
Do not invent schedules, availability, qualifications, offers, assignments, or decisions.
Do not select a coverage exception yourself.

Handle safe routine coordination only through authoritative BeforeBell tools.

If deterministic routine planning cannot safely resolve every remaining period,
request administrator judgment through the dedicated BeforeBell human-decision tool.

If administrator judgment is required, stop at that boundary and return the
authoritative decision options.

Do not invent an administrator response.
`.trim();
}


async function invokeAgentCoreRuntime({
  runtimeSessionId,
  payload,
}: {
  runtimeSessionId: string;
  payload:
    Record<
      string,
      unknown
    >;
}): Promise<
  BeforeBellRuntimeResponse
> {
  const client =
    getAgentCoreClient();

    let response:
    InvokeAgentRuntimeCommandOutput;

  try {
    response =
      await client.send(
        new InvokeAgentRuntimeCommand({
          agentRuntimeArn:
            getRuntimeArn(),

          qualifier:
            DEFAULT_QUALIFIER,

          runtimeSessionId,

          contentType:
            "application/json",

          accept:
            "application/json",

          payload:
            new TextEncoder()
              .encode(
                JSON.stringify(
                  payload,
                ),
              ),
        }),
      );
  } catch (
    cause
  ) {
    throw new BeforeBellAgentCoreGatewayError({
      code:
        "AGENTCORE_INVOCATION_FAILED",

      message:
        "BeforeBell could not reach the AgentCore Runtime.",

      statusCode:
        502,

      cause,
    });
  }

  const httpStatus =
    response.$metadata
      .httpStatusCode;

  if (
    httpStatus !==
      undefined &&
    httpStatus !==
      200
  ) {
    throw new BeforeBellAgentCoreGatewayError({
      code:
        "AGENTCORE_UPSTREAM_HTTP_ERROR",

      message:
        `AgentCore returned HTTP ${httpStatus}.`,

      statusCode:
        502,
    });
  }

  if (
    response.runtimeSessionId &&
    response.runtimeSessionId !==
      runtimeSessionId
  ) {
    throw new BeforeBellAgentCoreGatewayError({
      code:
        "AGENTCORE_SESSION_MISMATCH",

      message:
        "AgentCore returned a different runtime session than the one requested.",

      statusCode:
        502,
    });
  }

  if (
    !response.response
  ) {
    throw new BeforeBellAgentCoreGatewayError({
      code:
        "AGENTCORE_EMPTY_RESPONSE",

      message:
        "AgentCore returned no response body.",

      statusCode:
        502,
    });
  }

  let responseText:
    string;

  try {
    responseText =
      await response.response
        .transformToString();
  } catch (
    cause
  ) {
    throw new BeforeBellAgentCoreGatewayError({
      code:
        "AGENTCORE_RESPONSE_READ_FAILED",

      message:
        "BeforeBell could not read the AgentCore response.",

      statusCode:
        502,

      cause,
    });
  }

  let responseJson:
    unknown;

  try {
    responseJson =
      JSON.parse(
        responseText,
      ) as unknown;
  } catch (
    cause
  ) {
    throw new BeforeBellAgentCoreGatewayError({
      code:
        "AGENTCORE_RESPONSE_NOT_JSON",

      message:
        "AgentCore returned an invalid JSON response.",

      statusCode:
        502,

      cause,
    });
  }

  const parsed =
    runtimeResponseSchema
      .safeParse(
        responseJson,
      );

  if (
    !parsed.success
  ) {
    throw new BeforeBellAgentCoreGatewayError({
      code:
        "AGENTCORE_RESPONSE_INVALID",

      message:
        "AgentCore returned a response that does not match the BeforeBell runtime contract.",

      statusCode:
        502,

      cause:
        parsed.error,
    });
  }

  if (
    parsed.data
      .sessionId !==
    runtimeSessionId
  ) {
    throw new BeforeBellAgentCoreGatewayError({
      code:
        "BEFOREBELL_RUNTIME_SESSION_MISMATCH",

      message:
        "BeforeBell Runtime returned an unexpected session identifier.",

      statusCode:
        502,
    });
  }

  return parsed.data;
}


export async function coordinateCoverageCase(
  caseId:
    string,
): Promise<
  BeforeBellRuntimeResponse
> {
  const validatedCaseId =
    caseIdSchema.parse(
      caseId,
    );

  const runtimeSessionId =
    createRuntimeSessionId();

  return invokeAgentCoreRuntime({
    runtimeSessionId,

    payload: {
      type:
        "invoke",

      prompt:
        buildCoordinateCasePrompt(
          validatedCaseId,
        ),
    },
  });
}


export async function resumeCoverageException({
  runtimeSessionId,
  interruptId,
  optionId,
}: {
  runtimeSessionId: string;
  interruptId: string;
  optionId: string;
}): Promise<
  BeforeBellRuntimeResponse
> {
  const validatedSessionId =
    runtimeSessionIdSchema
      .parse(
        runtimeSessionId,
      );

  const validatedInterruptId =
    opaqueRuntimeIdSchema
      .parse(
        interruptId,
      );

  const validatedOptionId =
    opaqueRuntimeIdSchema
      .parse(
        optionId,
      );

  return invokeAgentCoreRuntime({
    runtimeSessionId:
      validatedSessionId,

    payload: {
      type:
        "resume",

      interruptId:
        validatedInterruptId,

      optionId:
        validatedOptionId,
    },
  });
}