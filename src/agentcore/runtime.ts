import {
  createServer,
} from "node:http";

import type {
  IncomingMessage,
  ServerResponse,
} from "node:http";

import {
  InterruptResponseContent,
} from "@strands-agents/sdk";

import {
  z,
} from "zod";

import {
  createBeforeBellAgent,
} from "@/agent/beforebell-agent";

import {
  createBeforeBellDynamoClients,
} from "@/infrastructure/dynamodb/client";

import {
  DynamoDbBeforeBellStore,
} from "@/infrastructure/dynamodb/dynamodb-beforebell-store";

import {
  getBeforeBellDynamoConfig,
} from "@/infrastructure/dynamodb/env";


const DEFAULT_PORT =
  8080;

const MAX_REQUEST_BYTES =
  64 * 1024;

const SESSION_HEADER =
  "x-amzn-bedrock-agentcore-runtime-session-id";


const invokeRequestSchema =
  z.object({
    type:
      z.literal(
        "invoke",
      ).optional(),

    prompt:
      z.string()
        .trim()
        .min(1)
        .max(8_000),
  })
    .strict();


const resumeRequestSchema =
  z.object({
    type:
      z.literal(
        "resume",
      ),

    interruptId:
      z.string()
        .trim()
        .min(1),

    optionId:
      z.string()
        .trim()
        .min(1),
  })
    .strict();


const invocationRequestSchema =
  z.union([
    resumeRequestSchema,
    invokeRequestSchema,
  ]);


type InvocationRequest =
  z.infer<
    typeof invocationRequestSchema
  >;


interface InterruptOption {
  optionId: string;
  kind: string;
  summary: string;
}


interface PendingInterrupt {
  id: string;
  name: string;
  reason: unknown;
  options:
    InterruptOption[];
}


type BeforeBellAgent =
  ReturnType<
    typeof createBeforeBellAgent
  >;


interface RuntimeSessionState {
  agent:
    BeforeBellAgent;

  pendingInterrupt?:
    PendingInterrupt;

  busy:
    boolean;

  lastTouchedAt:
    number;
}


class RuntimeHttpError
extends Error {
  readonly statusCode:
    number;

  readonly code:
    string;

  constructor(
    statusCode: number,
    code: string,
    message: string,
  ) {
    super(
      message,
    );

    this.name =
      "RuntimeHttpError";

    this.statusCode =
      statusCode;

    this.code =
      code;
  }
}


function isRecord(
  value: unknown,
): value is Record<
  string,
  unknown
> {
  return (
    typeof value ===
      "object" &&
    value !==
      null &&
    !Array.isArray(
      value,
    )
  );
}


function readInterruptOptions(
  reason: unknown,
): InterruptOption[] {
  if (
    !isRecord(
      reason,
    )
  ) {
    throw new Error(
      "Interrupt reason was not an object.",
    );
  }

  const rawOptions =
    reason.options;

  if (
    !Array.isArray(
      rawOptions,
    )
  ) {
    throw new Error(
      "Interrupt did not contain an options array.",
    );
  }

  return rawOptions.map(
    (
      value,
      index,
    ): InterruptOption => {
      if (
        !isRecord(
          value,
        )
      ) {
        throw new Error(
          `Interrupt option ${index + 1} was not an object.`,
        );
      }

      const {
        optionId,
        kind,
        summary,
      } =
        value;

      if (
        typeof optionId !==
          "string" ||
        typeof kind !==
          "string" ||
        typeof summary !==
          "string"
      ) {
        throw new Error(
          `Interrupt option ${index + 1} was malformed.`,
        );
      }

      return {
        optionId,
        kind,
        summary,
      };
    },
  );
}


function resolvePort(): number {
  const raw =
    process.env.PORT;

  if (!raw) {
    return DEFAULT_PORT;
  }

  const parsed =
    Number.parseInt(
      raw,
      10,
    );

  if (
    !Number.isInteger(
      parsed,
    ) ||
    parsed <=
      0 ||
    parsed >
      65_535
  ) {
    throw new Error(
      `Invalid PORT environment value "${raw}".`,
    );
  }

  return parsed;
}


function getSessionId(
  request:
    IncomingMessage,
): string {
  const raw =
    request.headers[
      SESSION_HEADER
    ];

  const sessionId =
    Array.isArray(
      raw,
    )
      ? raw[0]
      : raw;

  if (
    typeof sessionId !==
      "string" ||
    sessionId.trim()
      .length ===
      0
  ) {
    throw new RuntimeHttpError(
      400,
      "SESSION_ID_REQUIRED",
      "AgentCore runtime session ID header is required.",
    );
  }

  return sessionId.trim();
}


async function readJsonBody(
  request:
    IncomingMessage,
): Promise<unknown> {
  const chunks:
    Buffer[] = [];

  let totalBytes =
    0;

  for await (
    const chunk of request
  ) {
    const buffer =
      Buffer.isBuffer(
        chunk,
      )
        ? chunk
        : Buffer.from(
            chunk,
          );

    totalBytes +=
      buffer.length;

    if (
      totalBytes >
      MAX_REQUEST_BYTES
    ) {
      throw new RuntimeHttpError(
        413,
        "REQUEST_TOO_LARGE",
        "Invocation request exceeded the maximum allowed size.",
      );
    }

    chunks.push(
      buffer,
    );
  }

  if (
    chunks.length ===
    0
  ) {
    throw new RuntimeHttpError(
      400,
      "EMPTY_REQUEST",
      "Invocation request body is required.",
    );
  }

  const raw =
    Buffer.concat(
      chunks,
    )
      .toString(
        "utf8",
      );

  try {
    return JSON.parse(
      raw,
    ) as unknown;
  } catch {
    throw new RuntimeHttpError(
      400,
      "INVALID_JSON",
      "Invocation request body must contain valid JSON.",
    );
  }
}


function writeJson(
  response:
    ServerResponse,
  statusCode:
    number,
  body:
    unknown,
): void {
  const serialized =
    JSON.stringify(
      body,
    );

  response.writeHead(
    statusCode,
    {
      "Content-Type":
        "application/json; charset=utf-8",

      "Content-Length":
        Buffer.byteLength(
          serialized,
        ),

      "Cache-Control":
        "no-store",
    },
  );

  response.end(
    serialized,
  );
}


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


const sessions =
  new Map<
    string,
    RuntimeSessionState
  >();


function createSessionState():
RuntimeSessionState {
  return {
    agent:
      createBeforeBellAgent(
        store,
      ),

    busy:
      false,

    lastTouchedAt:
      Date.now(),
  };
}


function getOrCreateSession(
  sessionId: string,
): RuntimeSessionState {
  const existing =
    sessions.get(
      sessionId,
    );

  if (existing) {
    existing.lastTouchedAt =
      Date.now();

    return existing;
  }

  const created =
    createSessionState();

  sessions.set(
    sessionId,
    created,
  );

  return created;
}


function getExistingSession(
  sessionId: string,
): RuntimeSessionState {
  const existing =
    sessions.get(
      sessionId,
    );

  if (!existing) {
    throw new RuntimeHttpError(
      409,
      "SESSION_STATE_NOT_AVAILABLE",
      "The runtime no longer has the Strands state required to resume this interruption. Start a new coordination invocation from authoritative BeforeBell state.",
    );
  }

  existing.lastTouchedAt =
    Date.now();

  return existing;
}


function requireSessionAvailable(
  state:
    RuntimeSessionState,
): void {
  if (
    state.busy
  ) {
    throw new RuntimeHttpError(
      409,
      "SESSION_BUSY",
      "Another invocation is already active for this runtime session.",
    );
  }
}


function toPendingInterrupt(
  interrupt: {
    id: string;
    name: string;
    reason?: unknown;
  },
): PendingInterrupt {
  return {
    id:
      interrupt.id,

    name:
      interrupt.name,

    reason:
      interrupt.reason,

    options:
      readInterruptOptions(
        interrupt.reason,
      ),
  };
}


function serializeInterrupt(
  sessionId:
    string,
  interrupt:
    PendingInterrupt,
) {
  return {
    status:
      "interrupt",

    sessionId,

    stopReason:
      "interrupt",

    interrupt: {
      id:
        interrupt.id,

      name:
        interrupt.name,

      reason:
        interrupt.reason,

      options:
        interrupt.options,
    },
  };
}


async function invokePrompt(
  sessionId:
    string,
  prompt:
    string,
) {
  const state =
    getOrCreateSession(
      sessionId,
    );

  requireSessionAvailable(
    state,
  );

  if (
    state.pendingInterrupt
  ) {
    throw new RuntimeHttpError(
      409,
      "HUMAN_DECISION_PENDING",
      "This runtime session is waiting for an administrator decision. Resume the pending interruption before sending another prompt.",
    );
  }

  state.busy =
    true;

  state.lastTouchedAt =
    Date.now();

  try {
    const result =
      await state.agent.invoke(
        prompt,
      );

    if (
      result.stopReason ===
      "interrupt"
    ) {
      const interrupts =
        result.interrupts ??
        [];

      if (
        interrupts.length !==
        1
      ) {
        throw new Error(
          `BeforeBell expected exactly one active HITL interrupt but received ${interrupts.length}.`,
        );
      }

      const interrupt =
        interrupts[0];

      if (!interrupt) {
        throw new Error(
          "Strands reported an interrupt without an interrupt payload.",
        );
      }

      const pending =
        toPendingInterrupt(
          interrupt,
        );

      state.pendingInterrupt =
        pending;

      return serializeInterrupt(
        sessionId,
        pending,
      );
    }

    state.pendingInterrupt =
      undefined;

    return {
      status:
        result.stopReason ===
          "endTurn"
          ? "completed"
          : "stopped",

      sessionId,

      stopReason:
        result.stopReason,

      message:
        result.lastMessage
          .toJSON(),
    };
  } finally {
    state.busy =
      false;

    state.lastTouchedAt =
      Date.now();
  }
}


async function resumeInterrupt(
  sessionId:
    string,
  interruptId:
    string,
  optionId:
    string,
) {
  const state =
    getExistingSession(
      sessionId,
    );

  requireSessionAvailable(
    state,
  );

  const pending =
    state.pendingInterrupt;

  if (!pending) {
    throw new RuntimeHttpError(
      409,
      "NO_HUMAN_DECISION_PENDING",
      "There is no pending administrator decision for this runtime session.",
    );
  }

  if (
    pending.id !==
    interruptId
  ) {
    throw new RuntimeHttpError(
      409,
      "INTERRUPT_ID_MISMATCH",
      "The supplied interrupt ID does not match the pending administrator decision.",
    );
  }

  const selectedOption =
    pending.options.find(
      (option) =>
        option.optionId ===
        optionId,
    );

  if (!selectedOption) {
    throw new RuntimeHttpError(
      400,
      "INVALID_DECISION_OPTION",
      "The supplied option ID is not one of the authoritative choices for this interruption.",
    );
  }

  state.busy =
    true;

  state.lastTouchedAt =
    Date.now();

  try {
    const result =
      await state.agent.invoke([
        new InterruptResponseContent({
          interruptId:
            pending.id,

          response: {
            optionId:
              selectedOption.optionId,
          },
        }),
      ]);

    if (
      result.stopReason ===
      "interrupt"
    ) {
      const interrupts =
        result.interrupts ??
        [];

      if (
        interrupts.length !==
        1
      ) {
        throw new Error(
          `BeforeBell expected exactly one resumed HITL interrupt but received ${interrupts.length}.`,
        );
      }

      const nextInterrupt =
        interrupts[0];

      if (!nextInterrupt) {
        throw new Error(
          "Strands reported a resumed interrupt without an interrupt payload.",
        );
      }

      const nextPending =
        toPendingInterrupt(
          nextInterrupt,
        );

      state.pendingInterrupt =
        nextPending;

      return serializeInterrupt(
        sessionId,
        nextPending,
      );
    }

    state.pendingInterrupt =
      undefined;

    return {
      status:
        result.stopReason ===
          "endTurn"
          ? "completed"
          : "stopped",

      sessionId,

      stopReason:
        result.stopReason,

      message:
        result.lastMessage
          .toJSON(),

      humanDecision: {
        interruptId:
          pending.id,

        optionId:
          selectedOption.optionId,

        kind:
          selectedOption.kind,

        summary:
          selectedOption.summary,
      },
    };
  } finally {
    state.busy =
      false;

    state.lastTouchedAt =
      Date.now();
  }
}


async function handleInvocation(
  request:
    IncomingMessage,
  response:
    ServerResponse,
): Promise<void> {
  const sessionId =
    getSessionId(
      request,
    );

  const body =
    await readJsonBody(
      request,
    );

  const parsed =
    invocationRequestSchema
      .safeParse(
        body,
      );

  if (
    !parsed.success
  ) {
    throw new RuntimeHttpError(
      400,
      "INVALID_INVOCATION",
      parsed.error.issues
        .map(
          (issue) =>
            `${issue.path.join(".") || "request"}: ${issue.message}`,
        )
        .join(
          "; ",
        ),
    );
  }

  const invocation:
    InvocationRequest =
      parsed.data;

  if (
    invocation.type ===
    "resume"
  ) {
    const result =
      await resumeInterrupt(
        sessionId,
        invocation.interruptId,
        invocation.optionId,
      );

    writeJson(
      response,
      200,
      result,
    );

    return;
  }

  const result =
    await invokePrompt(
      sessionId,
      invocation.prompt,
    );

  writeJson(
    response,
    200,
    result,
  );
}


const server =
  createServer(
    (
      request,
      response,
    ) => {
      void (
        async () => {
          if (
            request.method ===
              "GET" &&
            request.url ===
              "/ping"
          ) {
            writeJson(
              response,
              200,
              {
                status:
                  "Healthy",

                service:
                  "BeforeBell",

                runtime:
                  "AgentCore",
              },
            );

            return;
          }

          if (
            request.method ===
              "POST" &&
            request.url ===
              "/invocations"
          ) {
            await handleInvocation(
              request,
              response,
            );

            return;
          }

          writeJson(
            response,
            404,
            {
              error: {
                code:
                  "NOT_FOUND",

                message:
                  "Route not found.",
              },
            },
          );
        }
      )().catch(
        (error: unknown) => {
          if (
            error instanceof
            RuntimeHttpError
          ) {
            writeJson(
              response,
              error.statusCode,
              {
                error: {
                  code:
                    error.code,

                  message:
                    error.message,
                },
              },
            );

            return;
          }

          const message =
            error instanceof
              Error
              ? error.message
              : String(
                  error,
                );

          console.error(
            "BeforeBell AgentCore invocation failed.",
          );

          console.error(
            error,
          );

          writeJson(
            response,
            500,
            {
              error: {
                code:
                  "INTERNAL_ERROR",

                message:
                  "BeforeBell could not complete the AgentCore invocation.",

                detail:
                  process.env.NODE_ENV ===
                    "development"
                    ? message
                    : undefined,
              },
            },
          );
        },
      );
    },
  );


server.on(
  "clientError",
  (
    error,
    socket,
  ) => {
    console.error(
      "BeforeBell AgentCore HTTP client error.",
      error,
    );

    socket.end(
      "HTTP/1.1 400 Bad Request\r\n\r\n",
    );
  },
);


const port =
  resolvePort();


server.listen(
  port,
  "0.0.0.0",
  () => {
    console.log(
      `BeforeBell AgentCore runtime listening on 0.0.0.0:${port}`,
    );

    console.log(
      `DynamoDB table: ${config.tableName}`,
    );

    console.log(
      `AWS region: ${config.region}`,
    );
  },
);


function shutdown(
  signal:
    string,
): void {
  console.log(
    `Received ${signal}; shutting down BeforeBell AgentCore runtime.`,
  );

  server.close(
    () => {
      serviceClient.destroy();

      process.exit(
        0,
      );
    },
  );
}


process.once(
  "SIGINT",
  () =>
    shutdown(
      "SIGINT",
    ),
);


process.once(
  "SIGTERM",
  () =>
    shutdown(
      "SIGTERM",
    ),
);