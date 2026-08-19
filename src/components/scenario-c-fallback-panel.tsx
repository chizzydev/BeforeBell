"use client";

import {
  useRouter,
} from "next/navigation";

import {
  useState,
} from "react";


type ScenarioCAction =
  | "coordinate"
  | "emma_declines"
  | "noah_accepts";


interface ScenarioCOfferView {
  id:
    string;

  candidateName:
    string;

  status:
    string;

  periodIds:
    readonly string[];
}


type ActionState =
  | "idle"
  | "running"
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

  return "BeforeBell could not complete the Scenario C demo step.";
}


export function ScenarioCFallbackPanel({
  caseStatus,
  offers,
}: {
  caseStatus:
    string;

  offers:
    readonly ScenarioCOfferView[];
}) {
  const router =
    useRouter();

  const [
    actionState,
    setActionState,
  ] =
    useState<ActionState>(
      "idle",
    );

  const [
    activeAction,
    setActiveAction,
  ] =
    useState<
      ScenarioCAction |
      undefined
    >();

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState(
      "",
    );


  const emmaOffer =
    offers.find(
      (
        offer,
      ) =>
        offer.candidateName ===
        "Emma Brooks",
    );


  const noahOffer =
    offers.find(
      (
        offer,
      ) =>
        offer.candidateName ===
        "Noah Carter",
    );


  const resolved =
    caseStatus ===
    "resolved";


  async function runAction(
    action:
      ScenarioCAction,
  ) {
    setActionState(
      "running",
    );

    setActiveAction(
      action,
    );

    setErrorMessage(
      "",
    );

    try {
      const response =
        await fetch(
          "/api/demo/scenario-c",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                action,
              }),

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

      setActionState(
        "idle",
      );

      setActiveAction(
        undefined,
      );

      router.refresh();
    } catch (
      error
    ) {
      setActionState(
        "error",
      );

      setActiveAction(
        undefined,
      );

      setErrorMessage(
        error instanceof
        Error
          ? error.message
          : "BeforeBell could not complete the Scenario C demo step.",
      );
    }
  }


  if (
    resolved
  ) {
    return (
      <div className="rounded-2xl bg-[#101914] p-5 text-white">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-[#d8f36b]" />

          <p className="text-xs font-medium uppercase tracking-[0.12em] text-white/45">
            Safe fallback complete
          </p>
        </div>

        <h2 className="mt-4 text-lg font-semibold">
          Olivia&apos;s coverage is resolved.
        </h2>

        <p className="mt-2 text-sm leading-6 text-white/55">
          Emma Brooks&apos;s decline remained authoritative. BeforeBell
          moved to Noah Carter, revalidated the accepted fallback offer,
          and completed coverage without administrator judgment.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <StateChip
            label="Emma Brooks"
            value={
              emmaOffer?.status ===
              "declined"
                ? "Declined"
                : "Response preserved"
            }
          />

          <StateChip
            label="Noah Carter"
            value="Assigned 3/3"
          />
        </div>
      </div>
    );
  }


  let action:
    ScenarioCAction;

  let buttonLabel:
    string;

  let eyebrow:
    string;

  let heading:
    string;

  let description:
    string;


  if (
    noahOffer?.status ===
    "pending"
  ) {
    action =
      "noah_accepts";

    buttonLabel =
      "Simulate Noah acceptance";

    eyebrow =
      "Fallback offer active";

    heading =
      "Noah Carter is the safe fallback.";

    description =
      "Emma's decline is preserved. The deterministic planner excluded her and the deployed agent created the next safe offer for Noah.";
  } else if (
    emmaOffer?.status ===
    "declined"
  ) {
    action =
      "emma_declines";

    buttonLabel =
      "Continue fallback coordination";

    eyebrow =
      "Decline recorded";

    heading =
      "Emma's response is authoritative.";

    description =
      "BeforeBell will re-plan from current state without offering the work to Emma again.";
  } else if (
    emmaOffer?.status ===
    "pending"
  ) {
    action =
      "emma_declines";

    buttonLabel =
      "Simulate Emma decline";

    eyebrow =
      "Candidate response";

    heading =
      "Emma Brooks received the first offer.";

    description =
      "Emma is the deterministic first choice for P1, P3 and P6. Her response arrives as an external trusted event; the agent cannot invent it.";
  } else {
    action =
      "coordinate";

    buttonLabel =
      "Start Scenario C coordination";

    eyebrow =
      "Safe fallback";

    heading =
      "Start with the deterministic first choice.";

    description =
      "BeforeBell will coordinate Olivia's uncovered periods using authoritative policy, candidate state and the deployed AgentCore runtime.";
  }


  const running =
    actionState ===
    "running";


  return (
    <div className="rounded-2xl bg-[#101914] p-5 text-white">
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-[#d8f36b]" />

        <p className="text-xs font-medium uppercase tracking-[0.12em] text-white/45">
          {eyebrow}
        </p>
      </div>


      <h2 className="mt-4 text-lg font-semibold">
        {heading}
      </h2>

      <p className="mt-2 text-sm leading-6 text-white/55">
        {description}
      </p>


      <div className="mt-5 space-y-2">
        <CandidateState
          number="1"
          name="Emma Brooks"
          value={
            emmaOffer
              ? formatOfferStatus(
                  emmaOffer.status,
                )
              : "Not offered yet"
          }
          active={
            emmaOffer?.status ===
            "pending"
          }
        />

        <CandidateState
          number="2"
          name="Noah Carter"
          value={
            noahOffer
              ? formatOfferStatus(
                  noahOffer.status,
                )
              : emmaOffer?.status ===
                  "declined"
                ? "Fallback candidate"
                : "Waiting"
          }
          active={
            noahOffer?.status ===
            "pending"
          }
        />
      </div>


      <button
        type="button"
        disabled={
          running
        }
        onClick={
          () =>
            runAction(
              action,
            )
        }
        className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-[#d8f36b] px-4 py-3 text-sm font-semibold text-[#101914] transition enabled:hover:bg-[#e1f781] disabled:cursor-wait disabled:opacity-50"
      >
        {running
          ? getRunningLabel(
              activeAction,
            )
          : buttonLabel}
      </button>


      <p className="mt-3 text-center text-[10px] leading-4 text-white/30">
        Candidate responses are simulated trusted external events.
        The browser cannot choose candidate IDs, periods or assignments.
      </p>


      {actionState ===
      "error" ? (
        <div className="mt-4 rounded-xl border border-[#e1a76c]/25 bg-[#e1a76c]/10 p-3">
          <p className="text-xs leading-5 text-[#ffd8ad]">
            {errorMessage}
          </p>
        </div>
      ) : null}
    </div>
  );
}


function CandidateState({
  number,
  name,
  value,
  active,
}: {
  number:
    string;

  name:
    string;

  value:
    string;

  active:
    boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.05] p-3">
      <div className="flex items-center gap-3">
        <span
          className={`flex size-7 items-center justify-center rounded-full text-xs font-semibold ${
            active
              ? "bg-[#d8f36b] text-[#101914]"
              : "bg-white/10 text-white/55"
          }`}
        >
          {number}
        </span>

        <span className="text-sm font-medium">
          {name}
        </span>
      </div>

      <span
        className={`text-xs ${
          active
            ? "text-[#d8f36b]"
            : "text-white/40"
        }`}
      >
        {value}
      </span>
    </div>
  );
}


function StateChip({
  label,
  value,
}: {
  label:
    string;

  value:
    string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.05] p-3">
      <p className="text-xs text-white/35">
        {label}
      </p>

      <p className="mt-1 text-sm font-medium">
        {value}
      </p>
    </div>
  );
}


function formatOfferStatus(
  status:
    string,
): string {
  switch (
    status
  ) {
    case "pending":
      return "Awaiting response";

    case "declined":
      return "Declined";

    case "accepted":
      return "Accepted";

    case "expired":
      return "Expired";

    case "cancelled":
      return "Cancelled";

    default:
      return status;
  }
}


function getRunningLabel(
  action:
    ScenarioCAction |
    undefined,
): string {
  switch (
    action
  ) {
    case "coordinate":
      return "Coordinating with AgentCore…";

    case "emma_declines":
      return "Recording decline & replanning…";

    case "noah_accepts":
      return "Accepting & assigning coverage…";

    default:
      return "Working…";
  }
}