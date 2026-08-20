import {
  NextResponse,
} from "next/server";

import {
  z,
} from "zod";

import {
  fulfillApprovedExternalSubstitute,
} from "@/application/actions/fulfill-approved-external-substitute";

import {
  BEFOREBELL_DEMO_CLOCK,
  BEFOREBELL_DEMO_EXTERNAL_SUBSTITUTE,
  getBeforeBellDemoCase,
} from "@/demo/beforebell-demo";

import {
  createBeforeBellDynamoClients,
} from "@/infrastructure/dynamodb/client";

import {
  DynamoDbBeforeBellStore,
} from "@/infrastructure/dynamodb/dynamodb-beforebell-store";

import {
  getBeforeBellDynamoConfig,
} from "@/infrastructure/dynamodb/env";


export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";


const requestSchema =
  z.object({
    caseId:
      z.string()
        .trim()
        .min(1)
        .max(128),
  })
    .strict();


export async function POST(
  request:
    Request,
) {
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


  let json:
    unknown;

  try {
    json =
      await request.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          code:
            "INVALID_JSON",

          message:
            "The fulfillment request must contain valid JSON.",
        },
      },
      {
        status:
          400,
      },
    );
  }


  const parsed =
    requestSchema.safeParse(
      json,
    );


  if (
    !parsed.success
  ) {
    return NextResponse.json(
      {
        error: {
          code:
            "INVALID_FULFILLMENT_REQUEST",

          message:
            "The trusted demo fulfillment request is invalid.",
        },
      },
      {
        status:
          400,
      },
    );
  }


  const definition =
    getBeforeBellDemoCase(
      parsed.data.caseId,
    );


  if (
    !definition ||
    definition.scenario !==
      "B"
  ) {
    return NextResponse.json(
      {
        error: {
          code:
            "DEMO_CASE_NOT_ALLOWED",

          message:
            "Trusted external-substitute fulfillment is available only for the BeforeBell Scenario B demo case.",
        },
      },
      {
        status:
          403,
      },
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


  try {
    const decisions =
      await store
        .listDecisionsByCase(
          parsed.data.caseId,
        );


    const approvedDecision =
      decisions.find(
        (
          decision,
        ) =>
          decision.status ===
            "approved" &&
          decision.kind ===
            "request_external_substitute",
      );


    if (
      !approvedDecision
    ) {
      return NextResponse.json(
        {
          error: {
            code:
              "APPROVED_EXTERNAL_SUBSTITUTE_DECISION_REQUIRED",

            message:
              "No approved external-substitute decision is available for fulfillment.",
          },
        },
        {
          status:
            409,
        },
      );
    }


    const result =
      await fulfillApprovedExternalSubstitute(
        store,
        {
          decisionId:
            approvedDecision.id,

          externalSubstituteId:
            BEFOREBELL_DEMO_EXTERNAL_SUBSTITUTE.id,

          now:
            new Date(
              BEFOREBELL_DEMO_CLOCK
                .externalSubstituteFulfilledAt,
            ),

         reconciliationNow:
  new Date(
    BEFOREBELL_DEMO_CLOCK
      .externalSubstituteReconciledAt,
  ),
        },
      );


    if (
      !result.success ||
      !result.data
    ) {
      return NextResponse.json(
        {
          error: {
            code:
              result.code,

            message:
              result.message,

            retryable:
              result.retryable,
          },
        },
        {
          status:
            409,
        },
      );
    }


    return NextResponse.json(
      {
        success:
          true,

        code:
          result.code,

        message:
          result.message,

        fulfillment: {
          substituteName:
            BEFOREBELL_DEMO_EXTERNAL_SUBSTITUTE.name,

          periodIds: [
            ...result.data.assignment
              .periodIds,
          ],

          caseStatus:
            result.data.caseStatus,

          idempotentReplay:
            result.data.idempotentReplay,
        },
      },
      {
        headers: {
          "cache-control":
            "no-store",
        },
      },
    );
  } finally {
    serviceClient.destroy();
  }
}