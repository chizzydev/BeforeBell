import Link from "next/link";

import {
  loadCoverageBoard,
  type CoverageCaseView,
} from "@/server/coverage/beforebell-coverage-read-model";


export const dynamic =
  "force-dynamic";


type MetricIconName =
  | "cases"
  | "periods"
  | "coverage"
  | "judgment";


export default async function Home() {
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
      "BeforeBell overview read failed.",
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


  const approvedDecisionCases =
    cases.filter(
      (
        currentCase,
      ) =>
        Boolean(
          currentCase
            .approvedDecision,
        ),
    );


  const attentionCount =
    judgmentCases.length +
    awaitingExecutionCases.length;


  return (
    <div className="mx-auto max-w-[1380px]">
      <section className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="bb-eyebrow text-[#748087]">
              Morning operations
            </span>

            <span className="h-1 w-1 rounded-full bg-[#aeb7bc]" />

            <span className="text-[11px] font-medium text-[#7e898f]">
              Riverside Community School
            </span>
          </div>

          <h1 className="mt-3 max-w-[780px] text-[2rem] font-semibold leading-[1.08] tracking-[-0.045em] text-[#11181c] sm:text-[2.55rem]">
            Coverage is moving before
            the first bell.
          </h1>

          <p className="mt-4 max-w-[700px] text-sm leading-6 text-[#667178] sm:text-[15px]">
            BeforeBell handles routine coverage
            automatically, enforces school policy
            deterministically, and surfaces only
            the moments that require administrator
            judgment.
          </p>
        </div>


        <SystemStatus
          unavailable={
            unavailable
          }
          attentionCount={
            attentionCount
          }
        />
      </section>


      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Coverage cases"
          value={String(
            cases.length,
          )}
          detail={
            unavailable
              ? "Authoritative state unavailable"
              : `${resolvedCases.length} resolved`
          }
          icon="cases"
          tone="neutral"
        />

        <MetricCard
          label="Affected periods"
          value={String(
            totalPeriods,
          )}
          detail={
            unavailable
              ? "Authoritative state unavailable"
              : "Across today's absences"
          }
          icon="periods"
          tone="neutral"
        />

        <MetricCard
          label="Confirmed coverage"
          value={`${coveragePercent}%`}
          detail={
            unavailable
              ? "Authoritative state unavailable"
              : `${coveredPeriods}/${totalPeriods || 0} periods assigned`
          }
          icon="coverage"
          tone={
            unavailable
              ? "neutral"
              : "green"
          }
          progress={
            unavailable
              ? undefined
              : coveragePercent
          }
        />

        <MetricCard
          label="Human attention"
          value={String(
            attentionCount,
          )}
          detail={
            unavailable
              ? "Authoritative state unavailable"
              : attentionCount ===
                  0
                ? "No administrator action pending"
                : `${judgmentCases.length} judgment · ${awaitingExecutionCases.length} fulfillment`
          }
          icon="judgment"
          tone={
            unavailable
              ? "neutral"
              : attentionCount >
                  0
                ? "amber"
                : "green"
          }
        />
      </section>


      <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_320px]">
        <div className="bb-panel overflow-hidden">
          <div className="flex flex-col justify-between gap-4 border-b border-[#e5eaec] px-5 py-5 sm:flex-row sm:items-center sm:px-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="bb-live-dot size-1.5 rounded-full bg-[#4ed7f1] text-[#4ed7f1]" />

                <p className="bb-eyebrow text-[#78858c]">
                  Live workload
                </p>
              </div>

              <h2 className="mt-2 text-lg font-semibold tracking-[-0.025em] text-[#182126]">
                Coverage command
              </h2>

              <p className="mt-1 text-xs leading-5 text-[#7c878d]">
                Authoritative case state,
                assignments and policy
                boundaries.
              </p>
            </div>

            <Link
              href="/coverage"
              className="inline-flex w-fit items-center gap-2 rounded-[9px] border border-[#d9e0e3] bg-[#f7f8f9] px-3 py-2 text-[11px] font-semibold text-[#536168] transition hover:border-[#c9d2d6] hover:bg-[#eef2f3] hover:text-[#202b30]"
            >
              Open coverage

              <ArrowIcon />
            </Link>
          </div>


          {unavailable ? (
            <UnavailableState />
          ) : cases.length ===
            0 ? (
            <EmptyCoverageState />
          ) : (
            <div className="divide-y divide-[#e8ecee]">
              {cases.map(
                (
                  currentCase,
                ) => (
                  <CoverageCommandRow
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


          {!unavailable &&
          cases.length >
            0 ? (
            <div className="grid border-t border-[#e5eaec] bg-[#f8f9fa] sm:grid-cols-3">
              <CommandFooterStat
                label="Resolved"
                value={`${resolvedCases.length}/${cases.length}`}
              />

              <CommandFooterStat
                label="Decisions recorded"
                value={String(
                  approvedDecisionCases.length,
                )}
                divided
              />

              <CommandFooterStat
                label="Authority"
                value="DynamoDB"
                divided
              />
            </div>
          ) : null}
        </div>


        <div className="space-y-5">
          <AgentPosture
            unavailable={
              unavailable
            }
            judgmentCount={
              judgmentCases.length
            }
          />

          <AttentionQueue
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
        </div>
      </section>


      <JudgmentBoundary
        judgmentCases={
          judgmentCases
        }
        awaitingExecutionCases={
          awaitingExecutionCases
        }
        approvedDecisionCases={
          approvedDecisionCases
        }
      />
    </div>
  );
}


function SystemStatus({
  unavailable,
  attentionCount,
}: {
  unavailable:
    boolean;

  attentionCount:
    number;
}) {
  return (
    <div className="flex w-fit items-center gap-3 rounded-[11px] border border-[#d9e0e3] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(10,13,15,0.025),0_10px_25px_rgba(10,13,15,0.025)]">
      <div
        className={`flex size-9 items-center justify-center rounded-[8px] ${
          unavailable
            ? "bg-[#fff5e5] text-[#a96f28]"
            : attentionCount >
                0
              ? "bg-[#fff5e5] text-[#a96f28]"
              : "bg-[#e7f9fc] text-[#187d91]"
        }`}
      >
        <PulseIcon />
      </div>

      <div>
        <div className="flex items-center gap-2">
          <span
            className={`bb-live-dot size-1.5 rounded-full ${
              unavailable
                ? "bg-[#e1a04b] text-[#e1a04b]"
                : "bg-[#4ed7f1] text-[#4ed7f1]"
            }`}
          />

          <p className="text-[11px] font-semibold text-[#2e3a40]">
            {unavailable
              ? "Operational state unavailable"
              : "Morning coordination active"}
          </p>
        </div>

        <p className="mt-1 text-[10px] text-[#818c92]">
          {unavailable
            ? "Authoritative store could not be read"
            : attentionCount >
                0
              ? `${attentionCount} item${attentionCount === 1 ? "" : "s"} need attention`
              : "No intervention currently required"}
        </p>
      </div>
    </div>
  );
}


function MetricCard({
  label,
  value,
  detail,
  icon,
  tone,
  progress,
}: {
  label:
    string;

  value:
    string;

  detail:
    string;

  icon:
    MetricIconName;

  tone:
    | "neutral"
    | "green"
    | "amber";

  progress?:
    number;
}) {
  const iconClass =
    tone ===
    "green"
      ? "bg-[#edf7eb] text-[#599451]"
      : tone ===
          "amber"
        ? "bg-[#fff5e5] text-[#a9712c]"
        : "bg-[#eef1f3] text-[#5e6b72]";


  return (
    <div className="bb-panel relative overflow-hidden p-5">
      <div className="flex items-start justify-between gap-4">
        <div
          className={`flex size-9 items-center justify-center rounded-[8px] ${iconClass}`}
        >
          <MetricIcon
            name={
              icon
            }
          />
        </div>

        {tone ===
        "green" ? (
          <span className="rounded-full bg-[#edf7eb] px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.11em] text-[#568b50]">
            Healthy
          </span>
        ) : tone ===
          "amber" ? (
          <span className="rounded-full bg-[#fff5e5] px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.11em] text-[#a56e29]">
            Attention
          </span>
        ) : null}
      </div>

      <p className="mt-5 text-[11px] font-medium text-[#727e85]">
        {label}
      </p>

      <p className="mt-1 text-[2rem] font-semibold leading-none tracking-[-0.045em] text-[#141d21]">
        {value}
      </p>

      <p className="mt-2 text-[10px] leading-4 text-[#899399]">
        {detail}
      </p>


      {typeof progress ===
      "number" ? (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#e9edef]">
          <div
            className="h-full rounded-full bg-[#72b968] transition-[width]"
            style={{
              width:
                `${Math.min(
                  Math.max(
                    progress,
                    0,
                  ),
                  100,
                )}%`,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}


function CoverageCommandRow({
  currentCase,
}: {
  currentCase:
    CoverageCaseView;
}) {
  const resolved =
    currentCase.status ===
    "resolved";

  const needsJudgment =
    currentCase
      .needsAdministratorDecision;

  const awaitingExecution =
    Boolean(
      currentCase
        .approvedDecision,
    ) &&
    !resolved;


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


  const status =
    getCaseStatus(
      currentCase,
    );


  return (
    <Link
      href={`/cases/${currentCase.id}`}
      className={`group block px-5 py-5 transition sm:px-6 ${
        needsJudgment
          ? "bg-[#fffcf7] hover:bg-[#fff8ec]"
          : awaitingExecution
            ? "bg-[#fafbfb] hover:bg-[#f4f6f7]"
            : "hover:bg-[#f8fafb]"
      }`}
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(190px,0.66fr)_auto] md:items-center">
        <div className="flex min-w-0 items-start gap-3.5">
          <div
            className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-[9px] border text-[11px] font-bold ${
              resolved
                ? "border-[#d9ead6] bg-[#edf7eb] text-[#568d50]"
                : needsJudgment
                  ? "border-[#f0dfc3] bg-[#fff5e5] text-[#a56f2c]"
                  : "border-[#e0e5e7] bg-[#eef1f3] text-[#647178]"
            }`}
          >
            {currentCase.scenario}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold tracking-[-0.01em] text-[#202a2f]">
                {
                  currentCase.staffName
                }
              </p>

              <span className="rounded-[4px] bg-[#edf0f2] px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-[0.1em] text-[#7d888e]">
                Scenario{" "}
                {
                  currentCase.scenario
                }
              </span>
            </div>

            <p className="mt-1 text-[11px] text-[#7c878d]">
              {
                currentCase.roleLabel
              }
            </p>

            <div className="mt-3 flex flex-wrap gap-1.5">
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
                            ? "border-[#d6ead3] bg-[#eff8ed] text-[#578650]"
                            : needsJudgment
                              ? "border-[#efdcbc] bg-[#fff7e9] text-[#a16d2c]"
                              : "border-[#dfe5e7] bg-[#f6f8f9] text-[#748087]"
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
          </div>
        </div>


        <div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="font-medium text-[#738087]">
              Coverage
            </span>

            <span className="font-semibold text-[#445158]">
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
            </span>
          </div>

          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e8edef]">
            <div
              className={`h-full rounded-full ${
                resolved
                  ? "bg-[#72b968]"
                  : needsJudgment
                    ? "bg-[#e1a04b]"
                    : "bg-[#87949a]"
              }`}
              style={{
                width:
                  `${coveragePercent}%`,
              }}
            />
          </div>

          <p className="mt-2 text-[9px] text-[#8c969c]">
            {coveragePercent}% of
            affected periods confirmed
          </p>
        </div>


        <div className="flex items-center justify-between gap-3 md:justify-end">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[9px] font-semibold ${status.className}`}
          >
            <span
              className={`size-1.5 rounded-full ${status.dotClassName}`}
            />

            {status.label}
          </span>

          <span className="flex size-8 items-center justify-center rounded-[8px] border border-[#dce2e5] bg-white text-[#89949a] transition group-hover:border-[#c6d0d4] group-hover:text-[#354248]">
            <ArrowIcon />
          </span>
        </div>
      </div>
    </Link>
  );
}


function AgentPosture({
  unavailable,
  judgmentCount,
}: {
  unavailable:
    boolean;

  judgmentCount:
    number;
}) {
  return (
    <section className="bb-panel-dark overflow-hidden p-5 sm:p-6">
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`bb-live-dot size-1.5 rounded-full ${
                unavailable
                  ? "bg-[#e1a04b] text-[#e1a04b]"
                  : "bg-[#4ed7f1] text-[#4ed7f1]"
              }`}
            />

            <p className="bb-eyebrow text-white/40">
              Agent posture
            </p>
          </div>

          <h2 className="mt-3 text-lg font-semibold tracking-[-0.025em]">
            Coordination with
            boundaries.
          </h2>
        </div>

        <AgentIcon />
      </div>


      <div className="relative mt-6 space-y-2">
        <PostureRow
          label="Routine planning"
          value="Autonomous"
          tone="machine"
        />

        <PostureRow
          label="Policy enforcement"
          value="Deterministic"
          tone="green"
        />

        <PostureRow
          label="Judgment"
          value={
            judgmentCount >
            0
              ? "Human required"
              : "Human controlled"
          }
          tone={
            judgmentCount >
            0
              ? "amber"
              : "neutral"
          }
        />

        <PostureRow
          label="Operational authority"
          value="DynamoDB"
          tone="neutral"
        />
      </div>


      <div className="relative mt-5 border-t border-white/[0.07] pt-4">
        <p className="text-[10px] leading-[1.7] text-white/37">
          BeforeBell may coordinate
          routine work, but deterministic
          policy and administrator
          judgment remain authoritative.
        </p>
      </div>
    </section>
  );
}


function PostureRow({
  label,
  value,
  tone,
}: {
  label:
    string;

  value:
    string;

  tone:
    | "machine"
    | "green"
    | "amber"
    | "neutral";
}) {
  const dotClass =
    tone ===
    "machine"
      ? "bg-[#4ed7f1]"
      : tone ===
          "green"
        ? "bg-[#77c66e]"
        : tone ===
            "amber"
          ? "bg-[#e1a04b]"
          : "bg-white/30";


  return (
    <div className="flex items-center justify-between gap-4 rounded-[8px] border border-white/[0.055] bg-white/[0.03] px-3.5 py-3">
      <div className="flex items-center gap-2">
        <span
          className={`size-1.5 shrink-0 rounded-full ${dotClass}`}
        />

        <span className="text-[10px] text-white/42">
          {label}
        </span>
      </div>

      <span className="text-[10px] font-semibold text-white/76">
        {value}
      </span>
    </div>
  );
}


function AttentionQueue({
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
  const items = [
    ...judgmentCases.map(
      (
        currentCase,
      ) => ({
        currentCase,

        label:
          "Administrator judgment",

        detail:
          `${currentCase.unresolvedPeriods.join(" · ")} unresolved`,

        tone:
          "amber" as const,
      }),
    ),

    ...awaitingExecutionCases.map(
      (
        currentCase,
      ) => ({
        currentCase,

        label:
          "Fulfillment pending",

        detail:
          `${currentCase.unresolvedPeriods.join(" · ") || "Approved path"} pending execution`,

        tone:
          "neutral" as const,
      }),
    ),
  ];


  return (
    <section className="bb-panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#e5eaec] px-5 py-4">
        <div>
          <p className="bb-eyebrow text-[#7d898f]">
            Attention queue
          </p>

          <p className="mt-1 text-[11px] text-[#8a949a]">
            Only work that needs a
            person.
          </p>
        </div>

        <span
          className={`flex size-8 items-center justify-center rounded-[8px] text-[10px] font-bold ${
            unavailable
              ? "bg-[#eef1f3] text-[#68757c]"
              : items.length >
                  0
                ? "bg-[#fff5e5] text-[#a46d29]"
                : "bg-[#edf7eb] text-[#578b50]"
          }`}
        >
          {items.length}
        </span>
      </div>


      {unavailable ? (
        <div className="px-5 py-7">
          <p className="text-xs font-medium text-[#68757c]">
            Queue unavailable
          </p>

          <p className="mt-1 text-[10px] leading-5 text-[#899399]">
            Authoritative case state
            could not be read.
          </p>
        </div>
      ) : items.length ===
        0 ? (
        <div className="px-5 py-7">
          <div className="flex size-9 items-center justify-center rounded-[8px] bg-[#edf7eb] text-[#5b9453]">
            <CheckIcon />
          </div>

          <p className="mt-3 text-xs font-semibold text-[#2f3c42]">
            Nothing needs intervention.
          </p>

          <p className="mt-1 text-[10px] leading-5 text-[#858f95]">
            BeforeBell is handling
            current routine coordination
            inside policy.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#e8ecee]">
          {items.map(
            (
              item,
            ) => (
              <Link
                key={`${item.label}-${item.currentCase.id}`}
                href={`/cases/${item.currentCase.id}`}
                className="group flex items-center gap-3 px-5 py-4 transition hover:bg-[#f8fafb]"
              >
                <span
                  className={`size-2 shrink-0 rounded-full ${
                    item.tone ===
                    "amber"
                      ? "bg-[#e1a04b]"
                      : "bg-[#8d999f]"
                  }`}
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold text-[#2f3c42]">
                    {
                      item
                        .currentCase
                        .staffName
                    }
                  </p>

                  <p
                    className={`mt-0.5 truncate text-[9px] font-medium ${
                      item.tone ===
                      "amber"
                        ? "text-[#a56d28]"
                        : "text-[#69767d]"
                    }`}
                  >
                    {item.label}
                  </p>

                  <p className="mt-1 truncate text-[9px] text-[#8c969c]">
                    {item.detail}
                  </p>
                </div>

                <span className="text-[#929ca2] transition group-hover:translate-x-0.5 group-hover:text-[#39464c]">
                  <ArrowIcon />
                </span>
              </Link>
            ),
          )}
        </div>
      )}
    </section>
  );
}


function JudgmentBoundary({
  judgmentCases,
  awaitingExecutionCases,
  approvedDecisionCases,
}: {
  judgmentCases:
    CoverageCaseView[];

  awaitingExecutionCases:
    CoverageCaseView[];

  approvedDecisionCases:
    CoverageCaseView[];
}) {
  const pending =
    judgmentCases[0];

  const awaitingExecution =
    awaitingExecutionCases[0];

  const completed =
    approvedDecisionCases[0];


  return (
    <section className="relative mt-5 overflow-hidden rounded-[1rem] border border-[#d9e0e3] bg-[#f8f9fa] shadow-[0_1px_2px_rgba(10,13,15,0.025)]">
      <div className="pointer-events-none absolute right-[-5rem] top-[-7rem] size-72 rounded-full bg-[#e1a04b]/[0.08] blur-3xl" />

      <div className="relative grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:p-7">
        <div className="flex max-w-[760px] items-start gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[9px] border border-[#e1a04b]/20 bg-[#151a1d] text-[#e1a04b]">
            <BoundaryIcon />
          </div>

          <div>
            <p className="bb-eyebrow text-[#748087]">
              Human control boundary
            </p>

            <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[#182126]">
              Safe routine decisions
              happen automatically.
              Judgment stays human.
            </h2>

            <p className="mt-2 max-w-2xl text-xs leading-6 text-[#69767d]">
              When deterministic policy
              cannot safely finish the
              work, BeforeBell stops at
              the boundary instead of
              improvising an exception.
            </p>
          </div>
        </div>


        {pending ? (
          <Link
            href={`/cases/${pending.id}`}
            className="group min-w-[260px] rounded-[10px] border border-[#ead4ad] bg-[#fff8ec] p-4 shadow-[0_1px_2px_rgba(10,13,15,0.025)] transition hover:border-[#dbbb82] hover:bg-[#fff4e3]"
          >
            <div className="flex items-center gap-2">
              <span className="bb-live-dot size-1.5 rounded-full bg-[#e1a04b] text-[#e1a04b]" />

              <p className="font-mono text-[8px] font-semibold uppercase tracking-[0.13em] text-[#976522]">
                Judgment required
              </p>
            </div>

            <p className="mt-3 text-sm font-semibold text-[#342f27]">
              {pending.staffName}
            </p>

            <p className="mt-1 text-[10px] text-[#897451]">
              {pending.unresolvedPeriods.join(
                " · ",
              )}{" "}
              unresolved
            </p>

            <p className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-[#956722]">
              Review authoritative
              options

              <ArrowIcon />
            </p>
          </Link>
        ) : awaitingExecution ? (
          <Link
            href={`/cases/${awaitingExecution.id}`}
            className="group min-w-[260px] rounded-[10px] border border-[#d8dfe2] bg-white p-4 transition hover:border-[#c8d1d5]"
          >
            <div className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-[#4ed7f1]" />

              <p className="font-mono text-[8px] font-semibold uppercase tracking-[0.13em] text-[#52737e]">
                Approval recorded
              </p>
            </div>

            <p className="mt-3 text-sm font-semibold text-[#2f3c42]">
              {
                awaitingExecution.staffName
              }
            </p>

            <p className="mt-1 text-[10px] text-[#7f8a90]">
              Trusted fulfillment is
              pending.
            </p>

            <p className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-[#526168]">
              Open case

              <ArrowIcon />
            </p>
          </Link>
        ) : completed ? (
          <Link
            href={`/cases/${completed.id}`}
            className="group min-w-[260px] rounded-[10px] border border-[#d5e3d2] bg-white p-4 transition hover:border-[#c3d8bf]"
          >
            <div className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-[#72b968]" />

              <p className="font-mono text-[8px] font-semibold uppercase tracking-[0.13em] text-[#598052]">
                Boundary clear
              </p>
            </div>

            <p className="mt-3 text-sm font-semibold text-[#2f3c42]">
              No judgment pending
            </p>

            <p className="mt-1 text-[10px] text-[#7f8a90]">
              Human decisions remain
              preserved in evidence.
            </p>
          </Link>
        ) : (
          <div className="min-w-[260px] rounded-[10px] border border-[#d5e3d2] bg-white p-4">
            <div className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-[#72b968]" />

              <p className="font-mono text-[8px] font-semibold uppercase tracking-[0.13em] text-[#598052]">
                Boundary clear
              </p>
            </div>

            <p className="mt-3 text-sm font-semibold text-[#2f3c42]">
              No judgment pending
            </p>

            <p className="mt-1 text-[10px] text-[#7f8a90]">
              Routine coordination
              remains inside policy.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}


function CommandFooterStat({
  label,
  value,
  divided =
    false,
}: {
  label:
    string;

  value:
    string;

  divided?:
    boolean;
}) {
  return (
    <div
      className={`px-5 py-3.5 sm:px-6 ${
        divided
          ? "border-t border-[#e5eaec] sm:border-l sm:border-t-0"
          : ""
      }`}
    >
      <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-[#879299]">
        {label}
      </p>

      <p className="mt-1 text-[11px] font-semibold text-[#46545b]">
        {value}
      </p>
    </div>
  );
}


function UnavailableState() {
  return (
    <div className="px-6 py-12">
      <div className="flex size-10 items-center justify-center rounded-[9px] bg-[#fff5e5] text-[#a66d28]">
        <AlertIcon />
      </div>

      <p className="mt-4 text-sm font-semibold text-[#303d43]">
        Coverage state is unavailable.
      </p>

      <p className="mt-2 max-w-md text-xs leading-5 text-[#7c878d]">
        BeforeBell could not read the
        authoritative operational store.
        Check the AWS session and refresh.
      </p>
    </div>
  );
}


function EmptyCoverageState() {
  return (
    <div className="px-6 py-12">
      <p className="text-sm font-semibold text-[#303d43]">
        No coverage cases are active.
      </p>

      <p className="mt-2 text-xs text-[#7c878d]">
        There is no operational workload
        to coordinate.
      </p>
    </div>
  );
}


function getCaseStatus(
  currentCase:
    CoverageCaseView,
): {
  label:
    string;

  className:
    string;

  dotClassName:
    string;
} {
  const resolved =
    currentCase.status ===
    "resolved";

  const needsJudgment =
    currentCase
      .needsAdministratorDecision;

  const awaitingExecution =
    Boolean(
      currentCase
        .approvedDecision,
    ) &&
    !resolved;


  if (
    resolved
  ) {
    return {
      label:
        "Coverage secured",

      className:
        "bg-[#edf7eb] text-[#568b50]",

      dotClassName:
        "bg-[#72b968]",
    };
  }


  if (
    needsJudgment
  ) {
    return {
      label:
        "Decision required",

      className:
        "bg-[#fff5e5] text-[#9e6927]",

      dotClassName:
        "bg-[#e1a04b]",
    };
  }


  if (
    awaitingExecution
  ) {
    return {
      label:
        "Fulfillment pending",

      className:
        "bg-[#e7f9fc] text-[#287586]",

      dotClassName:
        "bg-[#4ed7f1]",
    };
  }


  return {
    label:
      "Coordinating",

    className:
      "bg-[#eef1f3] text-[#606d74]",

    dotClassName:
      "bg-[#87949a]",
  };
}


function MetricIcon({
  name,
}: {
  name:
    MetricIconName;
}) {
  const commonProps = {
    viewBox:
      "0 0 24 24",
    fill:
      "none",
    stroke:
      "currentColor",
    strokeWidth:
      1.7,
    strokeLinecap:
      "round" as const,
    strokeLinejoin:
      "round" as const,
    className:
      "size-[18px]",
    "aria-hidden":
      true,
  };


  switch (
    name
  ) {
    case "cases":
      return (
        <svg {...commonProps}>
          <path d="M6.5 4.5h11a2 2 0 0 1 2 2v13h-15v-13a2 2 0 0 1 2-2Z" />
          <path d="M8 9h8" />
          <path d="M8 13h5" />
          <path d="M8 17h3" />
        </svg>
      );

    case "periods":
      return (
        <svg {...commonProps}>
          <circle
            cx="12"
            cy="12"
            r="8.5"
          />

          <path d="M12 7.5V12l3 2" />
        </svg>
      );

    case "coverage":
      return (
        <svg {...commonProps}>
          <path d="M4 12.5 9 17l11-11" />
        </svg>
      );

    case "judgment":
      return (
        <svg {...commonProps}>
          <path d="M12 3.5 19 7v5c0 4.1-2.65 7.25-7 8.5-4.35-1.25-7-4.4-7-8.5V7l7-3.5Z" />
          <path d="M12 8.5v4" />
          <path d="M12 16h.01" />
        </svg>
      );
  }
}


function PulseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[18px]"
      aria-hidden="true"
    >
      <path d="M3 12h4l2-5 4 10 2-5h6" />
    </svg>
  );
}


function AgentIcon() {
  return (
    <div className="relative flex size-9 items-center justify-center rounded-[8px] border border-[#4ed7f1]/15 bg-[#4ed7f1]/[0.055] text-[#4ed7f1]">
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
        <path d="M9.5 15h5" />
      </svg>
    </div>
  );
}


function BoundaryIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
      aria-hidden="true"
    >
      <path d="M12 3.5 19 7v5c0 4.1-2.65 7.25-7 8.5-4.35-1.25-7-4.4-7-8.5V7l7-3.5Z" />
      <path d="M8.5 12h7" />
      <path d="M12 8.5v7" />
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


function AlertIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[18px]"
      aria-hidden="true"
    >
      <path d="M12 4 21 20H3L12 4Z" />
      <path d="M12 9v4" />
      <path d="M12 16.5h.01" />
    </svg>
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