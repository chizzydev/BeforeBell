import {
  BeforeBellAgentCoreGatewayError,
  beforeBellWebAgentRequestSchema,
  coordinateCoverageCase,
  resumeCoverageException,
} from "@/server/agentcore/beforebell-agentcore-gateway";


export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";


function jsonResponse(
  body:
    unknown,
  status:
    number,
): Response {
  return Response.json(
    body,
    {
      status,

      headers: {
        "Cache-Control":
          "no-store",
      },
    },
  );
}


export async function POST(
  request:
    Request,
): Promise<Response> {
  let rawBody:
    unknown;

  try {
    rawBody =
      await request.json();
  } catch {
    return jsonResponse(
      {
        error: {
          code:
            "INVALID_JSON",

          message:
            "Request body must contain valid JSON.",
        },
      },
      400,
    );
  }

  const parsed =
    beforeBellWebAgentRequestSchema
      .safeParse(
        rawBody,
      );

  if (
    !parsed.success
  ) {
    return jsonResponse(
      {
        error: {
          code:
            "INVALID_AGENT_REQUEST",

          message:
            "The BeforeBell coordination request is invalid.",

          issues:
            parsed.error.issues.map(
              (issue) => ({
                path:
                  issue.path.join(
                    ".",
                  ),

                message:
                  issue.message,
              }),
            ),
        },
      },
      400,
    );
  }

  try {
    if (
      parsed.data.type ===
      "coordinate_case"
    ) {
      const result =
        await coordinateCoverageCase(
          parsed.data
            .caseId,
        );

      return jsonResponse(
        result,
        200,
      );
    }

    const result =
      await resumeCoverageException({
        runtimeSessionId:
          parsed.data
            .runtimeSessionId,

        interruptId:
          parsed.data
            .interruptId,

        optionId:
          parsed.data
            .optionId,
      });

    return jsonResponse(
      result,
      200,
    );
  } catch (
    error
  ) {
    console.error(
      "BeforeBell AgentCore API route failed.",
      error,
    );

    if (
      error instanceof
      BeforeBellAgentCoreGatewayError
    ) {
      return jsonResponse(
        {
          error: {
            code:
              error.code,

            message:
              error.message,
          },
        },
        error.statusCode,
      );
    }

    return jsonResponse(
      {
        error: {
          code:
            "BEFOREBELL_AGENTCORE_ERROR",

          message:
            "BeforeBell could not complete the AgentCore request.",
        },
      },
      500,
    );
  }
}