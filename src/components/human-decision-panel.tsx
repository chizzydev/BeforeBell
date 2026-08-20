"use client";

import {
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";


interface DecisionOption {
  optionId:
    string;

  kind:
    string;

  summary:
    string;
}


interface PendingDecision {
  runtimeSessionId:
    string;

  interruptId:
    string;

  options:
    DecisionOption[];
}


type DecisionState =
  | {
      phase:
        "idle";
    }
  | {
      phase:
        "loading";
    }
  | {
      phase:
        "choosing";

      pending:
        PendingDecision;

      selectedOptionId?:
        string;
    }
  | {
      phase:
        "submitting";

      pending:
        PendingDecision;

      selectedOptionId:
        string;
    }
  | {
      phase:
        "recorded";

      summary:
        string;
    }
  | {
      phase:
        "error";

      message:
        string;
    };


function isRecord(
  value:
    unknown,
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


function readErrorMessage(
  payload:
    unknown,
): string {
  if (
    isRecord(
      payload,
    ) &&
    isRecord(
      payload.error,
    ) &&
    typeof payload.error
      .message ===
      "string"
  ) {
    return payload.error
      .message;
  }

  return "BeforeBell could not complete the administrator decision request.";
}


function readDecisionOption(
  value:
    unknown,
): DecisionOption | undefined {
  if (
    !isRecord(
      value,
    ) ||
    typeof value.optionId !==
      "string" ||
    typeof value.kind !==
      "string" ||
    typeof value.summary !==
      "string"
  ) {
    return undefined;
  }

  return {
    optionId:
      value.optionId,

    kind:
      value.kind,

    summary:
      value.summary,
  };
}


function readPendingDecision(
  payload:
    unknown,
): PendingDecision {
  if (
    !isRecord(
      payload,
    ) ||
    payload.status !==
      "interrupt" ||
    payload.stopReason !==
      "interrupt" ||
    typeof payload.sessionId !==
      "string" ||
    !isRecord(
      payload.interrupt,
    ) ||
    typeof payload.interrupt.id !==
      "string" ||
    !isRecord(
      payload.interrupt.reason,
    ) ||
    !Array.isArray(
      payload.interrupt.reason
        .options,
    )
  ) {
    throw new Error(
      "AgentCore did not return a valid BeforeBell administrator decision.",
    );
  }


  const options =
    payload.interrupt.reason
      .options
      .map(
        readDecisionOption,
      )
      .filter(
        (
          option,
        ): option is DecisionOption =>
          option !==
          undefined,
      );


  if (
    options.length ===
    0
  ) {
    throw new Error(
      "BeforeBell returned no authoritative administrator options.",
    );
  }


  return {
    runtimeSessionId:
      payload.sessionId,

    interruptId:
      payload.interrupt.id,

    options,
  };
}


function readRecordedDecision(
  payload:
    unknown,
  expectedSessionId:
    string,
): string {
  if (
    !isRecord(
      payload,
    ) ||
    payload.status !==
      "completed" ||
    payload.stopReason !==
      "endTurn" ||
    payload.sessionId !==
      expectedSessionId
  ) {
    throw new Error(
      "AgentCore did not complete the same BeforeBell decision session.",
    );
  }


  if (
    !isRecord(
      payload.humanDecision,
    ) ||
    typeof payload.humanDecision
      .summary !==
      "string"
  ) {
    throw new Error(
      "BeforeBell completed but did not return authoritative human-decision evidence.",
    );
  }


  return payload.humanDecision
    .summary;
}


async function postDecisionRequest(
  payload:
    unknown,
): Promise<unknown> {
  const response =
    await fetch(
      "/api/agentcore/coverage",
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
          JSON.stringify(
            payload,
          ),
      },
    );


  const text =
    await response.text();


  let data:
    unknown;

  try {
    data =
      text
        ? JSON.parse(
            text,
          )
        : {};
  } catch {
    throw new Error(
      "BeforeBell returned an unreadable server response.",
    );
  }


  if (
    !response.ok
  ) {
    throw new Error(
      readErrorMessage(
        data,
      ),
    );
  }


  return data;
}


export function HumanDecisionPanel({
  caseId,
  unresolvedPeriods,
}: {
  caseId:
    string;

  unresolvedPeriods:
    readonly string[];
}) {
  const router =
    useRouter();

  const [
    state,
    setState,
  ] =
    useState<DecisionState>({
      phase:
        "idle",
    });


  async function requestDecision() {
    setState({
      phase:
        "loading",
    });


    try {
      const payload =
        await postDecisionRequest({
          type:
            "coordinate_case",

          caseId,
        });


      const pending =
        readPendingDecision(
          payload,
        );


            setState({
        phase:
          "choosing",

        pending,
      });

      router.refresh();
    } catch (
      error
    ) {
      setState({
        phase:
          "error",

        message:
          error instanceof
          Error
            ? error.message
            : "BeforeBell could not open the administrator decision.",
      });
    }
  }


  async function submitDecision() {
    if (
      state.phase !==
        "choosing" ||
      !state.selectedOptionId
    ) {
      return;
    }


    const {
      pending,
      selectedOptionId,
    } =
      state;


    setState({
      phase:
        "submitting",

      pending,

      selectedOptionId,
    });


    try {
      const payload =
        await postDecisionRequest({
          type:
            "resume_exception",

          runtimeSessionId:
            pending
              .runtimeSessionId,

          interruptId:
            pending
              .interruptId,

          optionId:
            selectedOptionId,
        });


      const summary =
        readRecordedDecision(
          payload,
          pending
            .runtimeSessionId,
        );


      setState({
        phase:
          "recorded",

        summary,
      });


      router.refresh();
    } catch (
      error
    ) {
      setState({
        phase:
          "error",

        message:
          error instanceof
          Error
            ? error.message
            : "BeforeBell could not record the administrator decision.",
      });
    }
  }


  if (
    state.phase ===
    "recorded"
  ) {
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

        <p className="mt-2 text-sm leading-6 text-white/60">
          {state.summary}
        </p>

        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-3">
          <p className="text-xs leading-5 text-white/50">
            Approval is authoritative, but it is not the same as execution.
            Coverage remains unassigned until the approved path is fulfilled.
          </p>
        </div>
      </div>
    );
  }


  return (
    <div className="rounded-2xl bg-[#101914] p-5 text-white">
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-[#d8f36b]" />

        <p className="text-xs font-medium uppercase tracking-[0.12em] text-white/45">
          Human judgment boundary
        </p>
      </div>


      <h2 className="mt-4 text-lg font-semibold">
        BeforeBell will not choose this exception.
      </h2>

      <p className="mt-2 text-sm leading-6 text-white/55">
        Routine planning cannot safely resolve{" "}
        {unresolvedPeriods.join(
          ", ",
        )}
        . An administrator must choose from options recomputed from
        authoritative policy and coverage state.
      </p>


      {state.phase ===
      "idle" ? (
        <button
          type="button"
          onClick={
            requestDecision
          }
          className="mt-5 w-full rounded-xl bg-[#d8f36b] px-4 py-3 text-sm font-semibold text-[#101914] transition hover:bg-[#e1f781]"
        >
          Open administrator decision
        </button>
      ) : null}


      {state.phase ===
      "loading" ? (
        <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.05] p-4">
          <div className="flex items-center gap-3">
            <span className="size-2 animate-pulse rounded-full bg-[#d8f36b]" />

            <div>
              <p className="text-sm font-medium">
                BeforeBell is coordinating…
              </p>

              <p className="mt-1 text-xs leading-5 text-white/45">
                AgentCore is checking the live case, policy and permitted
                exception paths.
              </p>
            </div>
          </div>
        </div>
      ) : null}


      {state.phase ===
      "choosing" ? (
        <div className="mt-5">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-white/40">
            Authoritative options
          </p>

          <div className="mt-3 space-y-2">
            {state.pending
              .options
              .map(
                (
                  option,
                  index,
                ) => {
                  const selected =
                    state
                      .selectedOptionId ===
                    option.optionId;


                  return (
                    <button
                      key={
                        option.optionId
                      }
                      type="button"
                      onClick={() =>
                        setState({
                          phase:
                            "choosing",

                          pending:
                            state.pending,

                          selectedOptionId:
                            option.optionId,
                        })
                      }
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        selected
                          ? "border-[#d8f36b]/60 bg-[#d8f36b]/10"
                          : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"
                      }`}
                    >
                      <div className="flex gap-3">
                        <div
                          className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                            selected
                              ? "bg-[#d8f36b] text-[#101914]"
                              : "bg-white/10 text-white/60"
                          }`}
                        >
                          {index +
                            1}
                        </div>

                        <div>
                          <p className="text-sm font-medium leading-5">
                            {option.summary}
                          </p>

                          <p className="mt-1 text-[11px] text-white/35">
                            {option.kind
                              .replaceAll(
                                "_",
                                " ",
                              )}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                },
              )}
          </div>


          <button
            type="button"
            disabled={
              !state
                .selectedOptionId
            }
            onClick={
              submitDecision
            }
            className="mt-4 w-full rounded-xl bg-[#d8f36b] px-4 py-3 text-sm font-semibold text-[#101914] transition enabled:hover:bg-[#e1f781] disabled:cursor-not-allowed disabled:opacity-35"
          >
            Approve selected option
          </button>

          <p className="mt-3 text-center text-[11px] leading-5 text-white/35">
            Only the returned option ID is submitted. The browser cannot
            rewrite candidate, periods or policy.
          </p>
        </div>
      ) : null}


      {state.phase ===
      "submitting" ? (
        <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.05] p-4">
          <div className="flex items-center gap-3">
            <span className="size-2 animate-pulse rounded-full bg-[#d8f36b]" />

            <div>
              <p className="text-sm font-medium">
                Recording administrator decision…
              </p>

              <p className="mt-1 text-xs leading-5 text-white/45">
                Resuming the same AgentCore and Strands HITL session.
              </p>
            </div>
          </div>
        </div>
      ) : null}


      {state.phase ===
      "error" ? (
        <div className="mt-5 rounded-xl border border-[#e1a76c]/25 bg-[#e1a76c]/10 p-4">
          <p className="text-sm font-medium text-[#ffd8ad]">
            Decision request could not complete.
          </p>

          <p className="mt-1 text-xs leading-5 text-white/50">
            {state.message}
          </p>

          <button
            type="button"
            onClick={
              requestDecision
            }
            className="mt-3 text-xs font-semibold text-[#d8f36b]"
          >
            Try again
          </button>
        </div>
      ) : null}
    </div>
  );
}