import {
  NextResponse,
} from "next/server";

import {
  resetScenarioBDemo,
} from "@/server/demo/reset-scenario-b";


export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";


export async function POST() {
  if (
    process.env
      .BEFOREBELL_ENABLE_DEMO_MUTATIONS !==
    "true"
  ) {
    return NextResponse.json(
      {
        error: {
          code:
            "DEMO_MUTATIONS_DISABLED",

          message:
            "BeforeBell demo mutations are disabled.",
        },
      },
      {
        status:
          403,
      },
    );
  }


  try {
    const reset =
      await resetScenarioBDemo();


    return NextResponse.json(
      {
        success:
          true,

        reset,
      },
      {
        headers: {
          "cache-control":
            "no-store",
        },
      },
    );
  } catch (
    error
  ) {
    console.error(
      "BeforeBell Scenario B reset failed.",
      error,
    );


    return NextResponse.json(
      {
        error: {
          code:
            "DEMO_RESET_FAILED",

          message:
            error instanceof
            Error
              ? error.message
              : "BeforeBell could not safely reset Scenario B.",
        },
      },
      {
        status:
          409,
      },
    );
  }
}