"use client";

import Link from "next/link";

import {
  useRouter,
} from "next/navigation";

import {
  useState,
} from "react";


type ResetState =
  | "idle"
  | "resetting"
  | "reset"
  | "error";


function readErrorMessage(
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


  return "BeforeBell could not safely reset Scenario B.";
}


export function ScenarioBReplayControls({
  caseId,
  readyToReplay,
}: {
  caseId:
    string;

  readyToReplay:
    boolean;
}) {
  const router =
    useRouter();


  const [
    state,
    setState,
  ] =
    useState<ResetState>(
      "idle",
    );


  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState(
      "",
    );


  const replayReady =
    readyToReplay ||
    state ===
      "reset";


  async function resetScenario() {
    setState(
      "resetting",
    );

    setErrorMessage(
      "",
    );


    try {
      const response =
        await fetch(
          "/api/demo/reset-scenario-b",
          {
            method:
              "POST",

            cache:
              "no-store",
          },
        );


      const payload:
        unknown =
          await response.json();


      if (
        !response.ok
      ) {
        throw new Error(
          readErrorMessage(
            payload,
          ),
        );
      }


      setState(
        "reset",
      );


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
          : "BeforeBell could not safely reset Scenario B.",
      );
    }
  }


  if (
    replayReady
  ) {
    return (
      <div className="lg:min-w-[210px]">
        <Link
          href={`/cases/${caseId}`}
          className="inline-flex w-full whitespace-nowrap items-center justify-center rounded-xl bg-[#d8f36b] px-5 py-3 text-sm font-semibold text-[#101914] transition hover:bg-[#e1f781]"
        >
          Open Scenario B
        </Link>

        <div className="mt-2 flex items-center justify-center gap-2 text-[11px] text-white/40">
          <span className="size-1.5 rounded-full bg-[#d8f36b]" />
          Replay baseline ready
        </div>
      </div>
    );
  }


  return (
    <div className="lg:min-w-[230px]">
      <button
        type="button"
        disabled={
          state ===
          "resetting"
        }
        onClick={
          resetScenario
        }
        className="inline-flex w-full whitespace-nowrap items-center justify-center rounded-xl bg-[#d8f36b] px-5 py-3 text-sm font-semibold text-[#101914] transition enabled:hover:bg-[#e1f781] disabled:cursor-wait disabled:opacity-50"
      >
        {state ===
        "resetting"
          ? "Restoring demo baseline…"
          : "Reset & replay Scenario B"}
      </button>


      <Link
        href={`/cases/${caseId}`}
        className="mt-2 inline-flex w-full whitespace-nowrap items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-xs font-medium text-white/65 transition hover:bg-white/[0.08] hover:text-white"
      >
        View current state
      </Link>


      <p className="mt-2 text-center text-[10px] leading-4 text-white/30">
        Resets only the fixed synthetic Scenario B demo state.
      </p>


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