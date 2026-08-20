import Link from "next/link";

import {
  loadCoverageBoard,
  type CoverageCaseView,
} from "@/server/coverage/beforebell-coverage-read-model";


export const dynamic =
  "force-dynamic";


type WorkloadState =
  | "resolved"
  | "judgment"
  | "execution"
  | "coordinating";


export default async function CoveragePage() {
  let cases:
    CoverageCaseView[] = [];

  let unavailable =
    false;


  try {
    cases =
      await loadCoverageBoard();
  } catch (
    error
  ) {
    unavailable =
      true;

    console.error(
      "BeforeBell coverage board read failed.",
      error,
    );
  }


  const totalPeriods =
    cases.reduce(
      (
        total,
        currentCase,
      ) =>
        total +
        currentCase
          .affectedPeriods
          .length,
      0,
    );


  const coveredPeriods =
    cases.reduce(
      (
        total,
        currentCase,
      ) =>
        total +
        currentCase
          .coveredPeriods
          .length,
      0,
    );


  const resolvedCases =
    cases.filter(
      (
        currentCase,
      ) =>
        currentCase.status ===
        "resolved",
    );


  const judgmentCases =
    cases.filter(
      (
        currentCase,
      ) =>
        currentCase
          .needsAdministratorDecision,
    );


  const awaitingExecutionCases =
    cases.filter(
      (
        currentCase,
      ) =>
        Boolean(
          currentCase
            .approvedDecision,
        ) &&
        currentCase.status !==
          "resolved",
    );


  const activityCount =
    cases.reduce(
      (
        total,
        currentCase,
      ) =>
        total +
        currentCase
          .activityCount,
      0,
    );


  const decisionCount =
    cases.reduce(
      (
        total,
        currentCase,
      ) =>
        total +
        currentCase
          .decisionCount,
      0,
    );


  const coveragePercent =
    totalPeriods ===
      0
      ? 0
      : Math.round(
          (
            coveredPeriods /
            totalPeriods
          ) *
            100,
        );


  return (
    <div className="mx-auto max-w-[1380px]">
      <section className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="bb-eyebrow text-[#748087]">
              Coverage operations
            </span>

            <span className="h-1 w-1 rounded-full bg-[#aeb7bc]" />

            <span className="text-[11px] font-medium text-[#7e898f]">
              Riverside Community School
            </span>
          </div>

          <h1 className="mt-3 text-[2rem] font-semibold leading-[1.08] tracking-[-0.045em] text-[#11181c] sm:text-[2.45rem]">
            Today&apos;s coverage workload.
          </h1>

          <p className="mt-4 max-w-[690px] text-sm leading-6 text-[#667178] sm:text-[15px]">
            Every absence, confirmed assignment,
            policy boundary and human decision
            remains visible from one authoritative
            operational surface.
          </p>
        </div>


        <AuthorityStatus
          unavailable={
            unavailable
          }
          caseCount={
            cases.length
          }
        />
      </section>


      <section className="mt-8 grid overflow-hidden rounded-[12px] border border-[#dce2e5] bg-white shadow-[0_1px_2px_rgba(10,13,15,0.025)] sm:grid-cols-2 lg:grid-cols-4">
        <SummaryStat
          label="Cases"
          value={String(
            cases.length,
          )}
          detail={`${resolvedCases.length} resolved`}
          signal="neutral"
        />

        <SummaryStat
          label="Coverage"
          value={`${coveragePercent}%`}
          detail={`${coveredPeriods}/${totalPeriods || 0} periods confirmed`}
          signal="success"
          divided
        />

        <SummaryStat
          label="Needs judgment"
          value={String(
            judgmentCases.length,
          )}
          detail="Human control boundary"
          signal={
            judgmentCases.length >
            0
              ? "human"
              : "neutral"
          }
          divided
        />

        <SummaryStat
          label="Activity events"
          value={String(
            activityCount,
          )}
          detail={`${decisionCount} human decision record${decisionCount === 1 ? "" : "s"}`}
          signal="machine"
          divided
        />
      </section>


      <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_310px]">
        <div className="bb-panel overflow-hidden">
          <div className="flex flex-col justify-between gap-4 border-b border-[#e5eaec] px-5 py-5 sm:flex-row sm:items-center sm:px-6">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`bb-live-dot size-1.5 rounded-full ${
                    unavailable
                      ? "bg-[#e1a04b] text-[#e1a04b]"
                      : "bg-[#4ed7f1] text-[#4ed7f1]"
                  }`}
                />

                <p className="bb-eyebrow text-[#78858c]">
                  Workload board
                </p>
              </div>

              <h2 className="mt-2 text-lg font-semibold tracking-[-0.025em] text-[#182126]">
                Coverage cases
              </h2>

              <p className="mt-1 text-xs leading-5 text-[#7c878d]">
                Current operational state across
                today&apos;s affected staff.
              </p>
            </div>


            <div className="flex items-center gap-2">
              <StateLegend
                tone="machine"
                label="Agent"
              />

              <StateLegend
                tone="human"
                label="Human"
              />

              <StateLegend
                tone="success"
                label="Resolved"
              />
            </div>
          </div>


          {unavailable ? (
            <UnavailableState />
          ) : cases.length ===
            0 ? (
            <EmptyState />
          ) : (
            <div className="divide-y divide-[#e7ecee]">
              {cases.map(
                (
                  currentCase,
                ) => (
                  <CoverageCaseCard
                    key={
                      currentCase.id
                    }
                    currentCase={
                      currentCase
                    }
                  />
                ),
              )}
            </div>
          )}
        </div>


        <aside className="space-y-5">
          <OperationalAuthority
            unavailable={
              unavailable
            }
            activityCount={
              activityCount
            }
            decisionCount={
              decisionCount
            }
          />

          <InterventionPanel
            unavailable={
              unavailable
            }
            judgmentCases={
              judgmentCases
            }
            awaitingExecutionCases={
              awaitingExecutionCases
            }
          />
        </aside>
      </section>
    </div>
  );
}


function CoverageCaseCard({
  currentCase,
}: {
  currentCase:
    CoverageCaseView;
}) {
  const state =
    getWorkloadState(
      currentCase,
    );

  const status =
    getStatusPresentation(
      state,
    );

  const coveragePercent =
    currentCase
      .affectedPeriods
      .length ===
      0
      ? 0
      : Math.round(
          (
            currentCase
              .coveredPeriods
              .length /
            currentCase
              .affectedPeriods
              .length
          ) *
            100,
        );


  const candidateNames =
    Array.from(
      new Set(
        currentCase
          .assignments
          .map(
            (
              assignment,
            ) =>
              assignment
                .candidateName,
          ),
      ),
    );


  return (
    <Link
      href={`/cases/${currentCase.id}`}
      className={`group block px-5 py-5 transition sm:px-6 ${
        state ===
        "judgment"
          ? "bg-[#fffcf7] hover:bg-[#fff8ed]"
          : state ===
              "execution"
            ? "bg-[#f7fcfd] hover:bg-[#f1fafc]"
            : "hover:bg-[#f8fafb]"
      }`}
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(230px,0.8fr)_minmax(260px,1fr)_minmax(210px,0.7fr)_auto] xl:items-center">
        <div className="flex min-w-0 items-start gap-3.5">
          <ScenarioMarker
            scenario={
              currentCase.scenario
            }
            state={
              state
            }
          />

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-[14px] font-semibold tracking-[-0.015em] text-[#1d272c]">
                {
                  currentCase.staffName
                }
              </h3>

              <span className="rounded-[4px] bg-[#edf0f2] px-1.5 py-0.5 font-mono text-[7px] font-semibold uppercase tracking-[0.13em] text-[#7c878e]">
                Scenario{" "}
                {
                  currentCase.scenario
                }
              </span>
            </div>

            <p className="mt-1 text-[10px] text-[#7b868c]">
              {
                currentCase.roleLabel
              }
            </p>

            <p className="mt-2 font-mono text-[8px] uppercase tracking-[0.1em] text-[#9aa3a8]">
              {
                currentCase.schoolName
              }
            </p>
          </div>
        </div>


        <div>
          <div className="flex items-center justify-between gap-4">
            <p className="font-mono text-[8px] font-semibold uppercase tracking-[0.13em] text-[#7b878d]">
              Period coverage
            </p>

            <p className="text-[10px] font-semibold text-[#435158]">
              {
                currentCase
                  .coveredPeriods
                  .length
              }
              /
              {
                currentCase
                  .affectedPeriods
                  .length
              }
            </p>
          </div>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {currentCase
              .affectedPeriods
              .map(
                (
                  periodId,
                ) => {
                  const covered =
                    currentCase
                      .coveredPeriods
                      .includes(
                        periodId,
                      );

                  return (
                    <span
                      key={
                        periodId
                      }
                      className={`rounded-[5px] border px-2 py-1 font-mono text-[9px] font-semibold ${
                        covered
                          ? "border-[#d5e8d1] bg-[#eff8ed] text-[#568650]"
                          : state ===
                              "judgment"
                            ? "border-[#efdabb] bg-[#fff6e7] text-[#9e6a28]"
                            : "border-[#d9e3e7] bg-[#f1fafc] text-[#25788a]"
                      }`}
                    >
                      {
                        periodId
                      }
                    </span>
                  );
                },
              )}
          </div>

          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e8edef]">
            <div
              className={`h-full rounded-full transition-[width] ${
                state ===
                "resolved"
                  ? "bg-[#72b968]"
                  : state ===
                      "judgment"
                    ? "bg-[#e1a04b]"
                    : "bg-[#4ed7f1]"
              }`}
              style={{
                width:
                  `${coveragePercent}%`,
              }}
            />
          </div>
        </div>


        <div>
          <p className="font-mono text-[8px] font-semibold uppercase tracking-[0.13em] text-[#7b878d]">
            Confirmed coverage
          </p>

          {candidateNames.length >
          0 ? (
            <div className="mt-2 space-y-1">
              {candidateNames
                .slice(
                  0,
                  2,
                )
                .map(
                  (
                    candidateName,
                  ) => (
                    <p
                      key={
                        candidateName
                      }
                      className="truncate text-[11px] font-semibold text-[#344148]"
                    >
                      {
                        candidateName
                      }
                    </p>
                  ),
                )}

              {candidateNames.length >
              2 ? (
                <p className="text-[9px] text-[#899399]">
                  +
                  {
                    candidateNames.length -
                    2
                  }{" "}
                  more
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-[10px] text-[#8b959a]">
              No confirmed assignment
            </p>
          )}

          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[8px] text-[#929ca1]">
            <span>
              {
                currentCase
                  .activityCount
              }{" "}
              events
            </span>

            <span>
              {
                currentCase
                  .decisionCount
              }{" "}
              decisions
            </span>
          </div>
        </div>


        <div className="flex items-center justify-between gap-3 xl:justify-end">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[9px] font-semibold ${status.className}`}
          >
            <span
              className={`size-1.5 rounded-full ${status.dotClassName}`}
            />

            {
              status.label
            }
          </span>

          <span className="flex size-8 shrink-0 items-center justify-center rounded-[8px] border border-[#dae1e4] bg-white text-[#8b969b] transition group-hover:border-[#bdc9ce] group-hover:text-[#354248]">
            <ArrowIcon />
          </span>
        </div>
      </div>


      {state ===
      "judgment" ? (
        <div className="mt-4 flex flex-col justify-between gap-3 border-t border-[#f1dfc1] pt-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-2.5">
            <span className="bb-live-dot mt-1 size-1.5 shrink-0 rounded-full bg-[#e1a04b] text-[#e1a04b]" />

            <div>
              <p className="text-[10px] font-semibold text-[#8f6126]">
                Human judgment required
              </p>

              <p className="mt-1 text-[9px] text-[#957d59]">
                {
                  currentCase
                    .unresolvedPeriods
                    .join(
                      " · ",
                    )
                }{" "}
                cannot be safely completed
                autonomously.
              </p>
            </div>
          </div>

          <span className="font-mono text-[8px] uppercase tracking-[0.11em] text-[#a47230]">
            Automation interrupted
          </span>
        </div>
      ) : state ===
        "execution" ? (
        <div className="mt-4 flex flex-col justify-between gap-3 border-t border-[#d6edf2] pt-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-2.5">
            <span className="bb-live-dot mt-1 size-1.5 shrink-0 rounded-full bg-[#4ed7f1] text-[#4ed7f1]" />

            <div>
              <p className="text-[10px] font-semibold text-[#277487]">
                Human approval recorded
              </p>

              <p className="mt-1 text-[9px] text-[#6b8790]">
                Trusted operational
                fulfillment remains pending.
              </p>
            </div>
          </div>

          <span className="font-mono text-[8px] uppercase tracking-[0.11em] text-[#45808d]">
            Execution pending
          </span>
        </div>
      ) : null}
    </Link>
  );
}


function OperationalAuthority({
  unavailable,
  activityCount,
  decisionCount,
}: {
  unavailable:
    boolean;

  activityCount:
    number;

  decisionCount:
    number;
}) {
  return (
    <section className="bb-panel-dark p-5">
      <div className="relative">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`bb-live-dot size-1.5 rounded-full ${
                  unavailable
                    ? "bg-[#e1a04b] text-[#e1a04b]"
                    : "bg-[#4ed7f1] text-[#4ed7f1]"
                }`}
              />

              <p className="bb-eyebrow text-white/38">
                Operational authority
              </p>
            </div>

            <h2 className="mt-3 text-[17px] font-semibold tracking-[-0.025em]">
              Evidence, not inference.
            </h2>
          </div>

          <DatabaseIcon />
        </div>


        <div className="mt-5 divide-y divide-white/[0.055] border-y border-white/[0.055]">
          <AuthorityRow
            label="State store"
            value="DynamoDB"
          />

          <AuthorityRow
            label="Runtime"
            value="AWS AgentCore"
            machine
          />

          <AuthorityRow
            label="Activity events"
            value={String(
              activityCount,
            )}
          />

          <AuthorityRow
            label="Human decisions"
            value={String(
              decisionCount,
            )}
          />
        </div>


        <p className="mt-4 text-[9px] leading-[1.7] text-white/32">
          Coverage shown here comes from
          persisted operational state.
          The interface does not infer
          success from an agent response.
        </p>
      </div>
    </section>
  );
}


function AuthorityRow({
  label,
  value,
  machine =
    false,
}: {
  label:
    string;

  value:
    string;

  machine?:
    boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <p className="font-mono text-[8px] uppercase tracking-[0.1em] text-white/29">
        {label}
      </p>

      <p
        className={`text-[9px] font-semibold ${
          machine
            ? "text-[#4ed7f1]"
            : "text-white/72"
        }`}
      >
        {value}
      </p>
    </div>
  );
}


function InterventionPanel({
  unavailable,
  judgmentCases,
  awaitingExecutionCases,
}: {
  unavailable:
    boolean;

  judgmentCases:
    CoverageCaseView[];

  awaitingExecutionCases:
    CoverageCaseView[];
}) {
  const pendingJudgment =
    judgmentCases[0];

  const pendingExecution =
    awaitingExecutionCases[0];


  return (
    <section className="bb-panel overflow-hidden">
      <div className="border-b border-[#e5eaec] px-5 py-4">
        <p className="bb-eyebrow text-[#7e8990]">
          Control boundary
        </p>

        <p className="mt-1 text-[10px] text-[#8b959b]">
          Work BeforeBell will not
          silently decide.
        </p>
      </div>


      {unavailable ? (
        <div className="p-5">
          <p className="text-xs font-semibold text-[#344148]">
            Boundary state unavailable
          </p>

          <p className="mt-2 text-[10px] leading-5 text-[#879197]">
            Authoritative coverage state
            could not be read.
          </p>
        </div>
      ) : pendingJudgment ? (
        <Link
          href={`/cases/${pendingJudgment.id}`}
          className="group block bg-[#fffcf7] p-5 transition hover:bg-[#fff8ed]"
        >
          <div className="flex size-9 items-center justify-center rounded-[8px] border border-[#f0ddbc] bg-[#fff5e5] text-[#a56e29]">
            <BoundaryIcon />
          </div>

          <p className="mt-4 text-xs font-semibold text-[#3b352c]">
            Administrator judgment required.
          </p>

          <p className="mt-2 text-[10px] leading-5 text-[#8b7654]">
            {
              pendingJudgment.staffName
            }{" "}
            has unresolved coverage for{" "}
            {
              pendingJudgment
                .unresolvedPeriods
                .join(
                  " · ",
                )
            }.
          </p>

          <p className="mt-4 flex items-center gap-1.5 text-[9px] font-semibold text-[#966523]">
            Review case

            <ArrowIcon />
          </p>
        </Link>
      ) : pendingExecution ? (
        <Link
          href={`/cases/${pendingExecution.id}`}
          className="group block bg-[#f7fcfd] p-5 transition hover:bg-[#f1fafc]"
        >
          <div className="flex size-9 items-center justify-center rounded-[8px] border border-[#cdebf1] bg-[#e7f9fc] text-[#24778a]">
            <RuntimeIcon />
          </div>

          <p className="mt-4 text-xs font-semibold text-[#2d3d43]">
            Approved path awaiting execution.
          </p>

          <p className="mt-2 text-[10px] leading-5 text-[#71878f]">
            {
              pendingExecution.staffName
            }{" "}
            has an administrator-approved
            action that is not yet fulfilled.
          </p>

          <p className="mt-4 flex items-center gap-1.5 text-[9px] font-semibold text-[#2b7585]">
            Open case

            <ArrowIcon />
          </p>
        </Link>
      ) : (
        <div className="p-5">
          <div className="flex size-9 items-center justify-center rounded-[8px] border border-[#d7e8d3] bg-[#edf7eb] text-[#5b9253]">
            <CheckIcon />
          </div>

          <p className="mt-4 text-xs font-semibold text-[#344148]">
            No intervention pending.
          </p>

          <p className="mt-2 text-[10px] leading-5 text-[#879197]">
            All current coverage is inside
            policy or already resolved.
          </p>
        </div>
      )}
    </section>
  );
}


function AuthorityStatus({
  unavailable,
  caseCount,
}: {
  unavailable:
    boolean;

  caseCount:
    number;
}) {
  return (
    <div className="flex w-fit items-center gap-3 rounded-[11px] border border-[#d9e0e3] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(10,13,15,0.025)]">
      <div
        className={`flex size-9 items-center justify-center rounded-[8px] ${
          unavailable
            ? "bg-[#fff5e5] text-[#a56e29]"
            : "bg-[#eef1f3] text-[#5c6970]"
        }`}
      >
        <DatabaseSmallIcon />
      </div>

      <div>
        <div className="flex items-center gap-2">
          <span
            className={`size-1.5 rounded-full ${
              unavailable
                ? "bg-[#e1a04b]"
                : "bg-[#72b968]"
            }`}
          />

          <p className="text-[11px] font-semibold text-[#2f3c42]">
            {unavailable
              ? "Authority unavailable"
              : "DynamoDB authoritative"}
          </p>
        </div>

        <p className="mt-1 text-[9px] text-[#879197]">
          {unavailable
            ? "Operational state could not be read"
            : `${caseCount} case${caseCount === 1 ? "" : "s"} loaded from persistence`}
        </p>
      </div>
    </div>
  );
}


function SummaryStat({
  label,
  value,
  detail,
  signal,
  divided =
    false,
}: {
  label:
    string;

  value:
    string;

  detail:
    string;

  signal:
    | "neutral"
    | "machine"
    | "success"
    | "human";

  divided?:
    boolean;
}) {
  const signalClass =
    signal ===
    "machine"
      ? "bg-[#4ed7f1]"
      : signal ===
          "success"
        ? "bg-[#72b968]"
        : signal ===
            "human"
          ? "bg-[#e1a04b]"
          : "bg-[#a4aeb3]";


  return (
    <div
      className={`relative px-5 py-5 ${
        divided
          ? "border-t border-[#e5eaec] sm:border-l sm:border-t-0"
          : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`size-1.5 rounded-full ${signalClass}`}
        />

        <p className="font-mono text-[8px] font-semibold uppercase tracking-[0.12em] text-[#7d898f]">
          {label}
        </p>
      </div>

      <p className="mt-3 text-[1.75rem] font-semibold leading-none tracking-[-0.045em] text-[#162025]">
        {value}
      </p>

      <p className="mt-2 text-[9px] text-[#8b959a]">
        {detail}
      </p>
    </div>
  );
}


function ScenarioMarker({
  scenario,
  state,
}: {
  scenario:
    CoverageCaseView["scenario"];

  state:
    WorkloadState;
}) {
  const className =
    state ===
    "resolved"
      ? "border-[#d7e8d3] bg-[#edf7eb] text-[#568b50]"
      : state ===
          "judgment"
        ? "border-[#f0ddbc] bg-[#fff5e5] text-[#a46d29]"
        : "border-[#ccebf1] bg-[#e7f9fc] text-[#24798b]";


  return (
    <div
      className={`flex size-10 shrink-0 items-center justify-center rounded-[8px] border font-mono text-[11px] font-bold ${className}`}
    >
      {scenario}
    </div>
  );
}


function StateLegend({
  tone,
  label,
}: {
  tone:
    | "machine"
    | "human"
    | "success";

  label:
    string;
}) {
  const dotClass =
    tone ===
    "machine"
      ? "bg-[#4ed7f1]"
      : tone ===
          "human"
        ? "bg-[#e1a04b]"
        : "bg-[#72b968]";


  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[7px] uppercase tracking-[0.1em] text-[#899399]">
      <span
        className={`size-1.5 rounded-full ${dotClass}`}
      />

      {label}
    </span>
  );
}


function getWorkloadState(
  currentCase:
    CoverageCaseView,
): WorkloadState {
  if (
    currentCase.status ===
    "resolved"
  ) {
    return "resolved";
  }

  if (
    currentCase
      .needsAdministratorDecision
  ) {
    return "judgment";
  }

  if (
    currentCase
      .approvedDecision
  ) {
    return "execution";
  }

  return "coordinating";
}


function getStatusPresentation(
  state:
    WorkloadState,
): {
  label:
    string;

  className:
    string;

  dotClassName:
    string;
} {
  switch (
    state
  ) {
    case "resolved":
      return {
        label:
          "Coverage secured",

        className:
          "bg-[#edf7eb] text-[#568b50]",

        dotClassName:
          "bg-[#72b968]",
      };

    case "judgment":
      return {
        label:
          "Decision required",

        className:
          "bg-[#fff5e5] text-[#9d6927]",

        dotClassName:
          "bg-[#e1a04b]",
      };

    case "execution":
      return {
        label:
          "Execution pending",

        className:
          "bg-[#e7f9fc] text-[#277688]",

        dotClassName:
          "bg-[#4ed7f1]",
      };

    case "coordinating":
      return {
        label:
          "Coordinating",

        className:
          "bg-[#e7f9fc] text-[#277688]",

        dotClassName:
          "bg-[#4ed7f1]",
      };
  }
}


function UnavailableState() {
  return (
    <div className="px-6 py-12">
      <div className="flex size-10 items-center justify-center rounded-[9px] bg-[#fff5e5] text-[#a56e29]">
        <BoundaryIcon />
      </div>

      <p className="mt-4 text-sm font-semibold text-[#303d43]">
        Coverage authority is unavailable.
      </p>

      <p className="mt-2 max-w-lg text-xs leading-5 text-[#7c878d]">
        BeforeBell could not read the
        authoritative operational store.
        Check the AWS session and refresh.
      </p>
    </div>
  );
}


function EmptyState() {
  return (
    <div className="px-6 py-12">
      <p className="text-sm font-semibold text-[#303d43]">
        No coverage workload is active.
      </p>

      <p className="mt-2 text-xs text-[#7c878d]">
        No absence cases are currently
        present in authoritative state.
      </p>
    </div>
  );
}


function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m14 7 5 5-5 5" />
    </svg>
  );
}


function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[18px]"
      aria-hidden="true"
    >
      <path d="m5 12.5 4.5 4L19 7" />
    </svg>
  );
}


function BoundaryIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[18px]"
      aria-hidden="true"
    >
      <path d="M12 3.5 19 7v5c0 4.1-2.65 7.25-7 8.5-4.35-1.25-7-4.4-7-8.5V7l7-3.5Z" />
      <path d="M12 8.5v4" />
      <path d="M12 16h.01" />
    </svg>
  );
}


function RuntimeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[18px]"
      aria-hidden="true"
    >
      <path d="M8 7.5h8a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3Z" />
      <path d="M12 7.5V4" />
      <path d="M10 4h4" />
      <path d="M9 12h.01" />
      <path d="M15 12h.01" />
    </svg>
  );
}


function DatabaseIcon() {
  return (
    <div className="flex size-9 items-center justify-center rounded-[8px] border border-[#4ed7f1]/15 bg-[#4ed7f1]/[0.055] text-[#4ed7f1]">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-[18px]"
        aria-hidden="true"
      >
        <ellipse
          cx="12"
          cy="6"
          rx="7"
          ry="3"
        />

        <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />

        <path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
      </svg>
    </div>
  );
}


function DatabaseSmallIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[18px]"
      aria-hidden="true"
    >
      <ellipse
        cx="12"
        cy="6"
        rx="7"
        ry="3"
      />

      <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />

      <path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
    </svg>
  );
}