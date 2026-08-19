"use client";

import {
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";


type FulfillmentState =
  | "idle"
  | "submitting"
  | "error";


function readError(
  payload:
    unknown,
): string {
  if (
    typeof payload ===
      "object" &&
    payload !==
      null &&
    "error" in
      payload
  ) {
    const error =
      (
        payload as {
          error?:
            unknown;
        }
      ).error;

    if (
      typeof error ===
        "object" &&
      error !==
        null &&
      "message" in
        error &&
      typeof (
        error as {
          message?:
            unknown;
        }
      ).message ===
        "string"
    ) {
      return (
        error as {
          message:
            string;
        }
      ).message;
    }
  }

  return "The trusted substitute fulfillment could not be recorded.";
}


export function ExternalSubstituteFulfillmentPanel({
  caseId,
  substituteName,
}: {
  caseId:
    string;

  substituteName:
    string;
}) {
  const router =
    useRouter();

  const [
    state,
    setState,
  ] =
    useState<FulfillmentState>(
      "idle",
    );

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState(
      "",
    );


  async function fulfill() {
    setState(
      "submitting",
    );

    setErrorMessage(
      "",
    );


    try {
      const response =
        await fetch(
          "/api/demo/external-substitute",
          {
            method:
              "POST",

            headers: {
              "content-type":
                "application/json",
            },

            cache:
              "no-store",

            body:
              JSON.stringify({
                caseId,
              }),
          },
        );


      const payload:
        unknown =
          await response.json();


      if (
        !response.ok
      ) {
        throw new Error(
          readError(
            payload,
          ),
        );
      }


      router.refresh();
    } catch (
      error
    ) {
      setState(
        "error",
      );

      setErrorMessage(
        error instanceof
        Error
          ? error.message
          : "The trusted substitute fulfillment could not be recorded.",
      );
    }
  }


  return (
    <div className="rounded-2xl bg-[#101914] p-5 text-white">
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-[#d8f36b]" />

        <p className="text-xs font-medium uppercase tracking-[0.12em] text-white/45">
          Decision recorded
        </p>
      </div>


      <h2 className="mt-4 text-lg font-semibold">
        Administrator judgment is complete.
      </h2>

      <p className="mt-2 text-sm leading-6 text-white/55">
        An external substitute was approved for the unresolved period.
        Coverage is still waiting for a trusted fulfillment event.
      </p>


      <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.05] p-4">
        <p className="text-xs text-white/40">
          Demo substitute provider
        </p>

        <p className="mt-1 text-sm font-semibold">
          {substituteName}
        </p>

        <p className="mt-1 text-xs leading-5 text-white/40">
          This button simulates the external provider confirming the
          authoritative substitute assignment. The browser cannot choose
          the approved periods or decision.
        </p>
      </div>


      <button
        type="button"
        disabled={
          state ===
          "submitting"
        }
        onClick={
          fulfill
        }
        className="mt-4 w-full rounded-xl bg-[#d8f36b] px-4 py-3 text-sm font-semibold text-[#101914] transition enabled:hover:bg-[#e1f781] disabled:cursor-wait disabled:opacity-50"
      >
        {state ===
        "submitting"
          ? "Confirming trusted fulfillment…"
          : "Simulate substitute confirmation"}
      </button>


      {state ===
      "error" ? (
        <div className="mt-3 rounded-xl border border-[#e1a76c]/25 bg-[#e1a76c]/10 p-3">
          <p className="text-xs leading-5 text-[#ffd8ad]">
            {errorMessage}
          </p>
        </div>
      ) : null}
    </div>
  );
}