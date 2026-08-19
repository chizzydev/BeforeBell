import {
  NextResponse,
} from "next/server";

import {
  z,
} from "zod";

import {
  runScenarioCDemoAction,
  ScenarioCDemoFlowError,
} from "@/server/demo/scenario-c-demo-flow";


export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";


const requestSchema =
  z
    .object({
      action:
        z.enum([
          "coordinate",
          "emma_declines",
          "noah_accepts",
        ]),
    })
    .strict();


function demoMutationsEnabled():
  boolean {
  return (
    process.env
      .BEFOREBELL_ENABLE_DEMO_MUTATIONS ===
    "true"
  );
}


function json(
  body:
    unknown,

  status:
    number,
) {
  return NextResponse.json(
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
) {
  if (
    !demoMutationsEnabled()
  ) {
    return json(
      {
        error: {
          code:
            "DEMO_MUTATIONS_DISABLED",

          message:
            "BeforeBell demo mutations are disabled.",
        },
      },
      403,
    );
  }

  let body:
    unknown;

  try {
    body =
      await request.json();
  } catch {
    return json(
      {
        error: {
          code:
            "INVALID_JSON",

          message:
            "The Scenario C request body must be valid JSON.",
        },
      },
      400,
    );
  }

  const parsed =
    requestSchema.safeParse(
      body,
    );

  if (
    !parsed.success
  ) {
    return json(
      {
        error: {
          code:
            "INVALID_SCENARIO_C_REQUEST",

          message:
            "The Scenario C demo request is invalid.",

          issues:
            parsed.error.issues.map(
              (
                issue,
              ) => ({
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
    const result =
      await runScenarioCDemoAction(
        parsed.data.action,
      );

    return json(
      {
        success:
          true,

        data:
          result,
      },
      200,
    );
  } catch (
    error
  ) {
    if (
      error instanceof
      ScenarioCDemoFlowError
    ) {
      return json(
        {
          error: {
            code:
              error.code,

            message:
              error.message,
          },
        },
        error.status,
      );
    }

    console.error(
      "Unexpected Scenario C demo failure.",
      error,
    );

    return json(
      {
        error: {
          code:
            "SCENARIO_C_INTERNAL_ERROR",

          message:
            "Scenario C could not be completed.",
        },
      },
      500,
    );
  }
}