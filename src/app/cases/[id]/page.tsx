import Link from "next/link";

import {
  notFound,
} from "next/navigation";

import {
  HumanDecisionPanel,
} from "@/components/human-decision-panel";

import {
  ExternalSubstituteFulfillmentPanel,
} from "@/components/external-substitute-fulfillment-panel";

import {
  LiveOrchestrationConsole,
} from "@/components/live-orchestration-console";

import {
  ScenarioCFallbackPanel,
} from "@/components/scenario-c-fallback-panel";

import {
  BEFOREBELL_DEMO_EXTERNAL_SUBSTITUTE,
  getBeforeBellDemoCase,
} from "@/demo/beforebell-demo";

import {
  loadCoverageCase,
} from "@/server/coverage/beforebell-coverage-read-model";


export const dynamic =
  "force-dynamic";


export default async function CoverageCasePage({
  params,
}: {
  params:
    Promise<{
      id:
        string;
    }>;
}) {
  const {
    id,
  } =
    await params;

  const definition =
    getBeforeBellDemoCase(
      id,
    );

  if (!definition) {
    notFound();
  }

  let coverageCase:
    Awaited<
      ReturnType<
        typeof loadCoverageCase
      >
    >;

  try {
    coverageCase =
      await loadCoverageCase(
        id,
      );
  } catch (
    error
  ) {
    console.error(
      "BeforeBell case read failed.",
      error,
    );

    return (
      <CaseUnavailable
        staffName={
          definition.staffName
        }
      />
    );
  }

  if (!coverageCase) {
    return (
      <CaseNotSeeded
        staffName={
          definition.staffName
        }
      />
    );
  }

  const resolved =
    coverageCase.status ===
    "resolved";

  const awaitingExecution =
    Boolean(
      coverageCase
        .approvedDecision,
    );

  const statusLabel =
    resolved
      ? "Coverage secured"
      : coverageCase
            .needsAdministratorDecision
        ? "Administrator judgment required"
        : awaitingExecution
          ? "Decision approved · fulfillment pending"
          : "Coordination active";

  return (
    <div className="mx-auto max-w-[1320px]">
      <Link
        href="/coverage"
        className="inline-flex items-center gap-2 text-sm font-medium text-[var(--ink-muted)] transition hover:text-[var(--ink)]"
      >
        <span aria-hidden="true">
          ←
        </span>

        Coverage board
      </Link>

      <section className="mt-6 overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-[var(--shadow-panel)]">
        <div className="border-b border-[var(--border-soft)] px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-[var(--border)] bg-[var(--surface-soft)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-muted)]">
                  Scenario {coverageCase.scenario}
                </span>

                <span className="bb-mono text-[11px] text-[var(--ink-muted)]">
                  {coverageCase.date}
                </span>
              </div>

              <h1 className="mt-4 text-3xl font-semibold tracking-[-0.045em] text-[var(--ink)] sm:text-[2.65rem]">
                {coverageCase.staffName}
              </h1>

              <p className="mt-2 text-sm text-[var(--ink-soft)]">
                {coverageCase.roleLabel}
                {" · "}
                {coverageCase.schoolName}
              </p>
            </div>

            <CaseStatus
              resolved={
                resolved
              }
              needsAdministratorDecision={
                coverageCase
                  .needsAdministratorDecision
              }
              awaitingExecution={
                awaitingExecution
              }
              label={
                statusLabel
              }
            />
          </div>
        </div>

        <div className="grid divide-y divide-[var(--border-soft)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <CaseMetric
            label="Affected periods"
            value={
              coverageCase
                .affectedPeriods
                .join(
                  " · ",
                )
            }
          />

          <CaseMetric
            label="Confirmed coverage"
            value={`${coverageCase.coveredPeriods.length}/${coverageCase.affectedPeriods.length}`}
          />

          <CaseMetric
            label="Authoritative status"
            value={
              coverageCase.status
                .replaceAll(
                  "_",
                  " ",
                )
            }
          />
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(520px,1.08fr)]">
        <div className="space-y-6">
          <section className="bb-panel overflow-hidden">
            <div className="border-b border-[var(--border-soft)] px-5 py-4 sm:px-6">
              <p className="bb-eyebrow text-[var(--ink-muted)]">
                Human operations
              </p>

              <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold tracking-[-0.02em] text-[var(--ink)]">
                    Authoritative assignment snapshot
                  </h2>

                  <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
                    Current coverage state from DynamoDB. Baseline assignments
                    are state, not fabricated orchestration history.
                  </p>
                </div>

                <span className="bb-mono text-[10px] uppercase tracking-[0.1em] text-[var(--ink-muted)]">
                  {coverageCase.coveredPeriods.length} covered
                </span>
              </div>
            </div>

            <div className="divide-y divide-[var(--border-soft)]">
              {coverageCase
                .affectedPeriods
                .map(
                  (
                    periodId,
                  ) => {
                    const assignment =
                      coverageCase
                        .assignments
                        .find(
                          (
                            currentAssignment,
                          ) =>
                            currentAssignment
                              .periodIds
                              .includes(
                                periodId,
                              ),
                        );

                    return (
                      <div
                        key={
                          periodId
                        }
                        className="grid gap-3 px-5 py-4 sm:grid-cols-[72px_minmax(0,1fr)_auto] sm:items-center sm:px-6"
                      >
                        <div>
                          <p className="bb-mono text-[11px] font-semibold text-[var(--ink)]">
                            {periodId}
                          </p>
                        </div>

                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--ink)]">
                            {assignment
                              ? assignment.candidateName
                              : "No confirmed assignment"}
                          </p>

                          <p className="mt-1 text-xs text-[var(--ink-muted)]">
                            {assignment
                              ? formatAssignmentSource(
                                  assignment.source,
                                )
                              : coverageCase
                                    .needsAdministratorDecision
                                ? "Outside deterministic routine policy"
                                : "Awaiting authoritative resolution"}
                          </p>
                        </div>

                        <PeriodStatus
                          assignmentExists={
                            Boolean(
                              assignment,
                            )
                          }
                          needsAdministratorDecision={
                            coverageCase
                              .needsAdministratorDecision
                          }
                        />
                      </div>
                    );
                  },
                )}
            </div>
          </section>

          <section className="bb-panel p-5 sm:p-6">
            <p className="bb-eyebrow text-[var(--ink-muted)]">
              Operational authority
            </p>

            <h2 className="mt-2 text-base font-semibold tracking-[-0.02em] text-[var(--ink)]">
              Evidence, not inference
            </h2>

            <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
              The case surface is reconstructed from authoritative persisted
              state rather than assistant narration.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <EvidenceCell
                label="Assignment records"
                value={String(
                  coverageCase
                    .assignments
                    .length,
                )}
              />

              <EvidenceCell
                label="Human decisions"
                value={String(
                  coverageCase
                    .decisionCount,
                )}
              />

              <EvidenceCell
                label="Activity events"
                value={String(
                  coverageCase
                    .activityCount,
                )}
              />

              <EvidenceCell
                label="Authoritative store"
                value="DynamoDB"
              />
            </div>
          </section>

          {coverageCase.scenario ===
          "C" ? (
            <ScenarioCFallbackPanel
              caseStatus={
                coverageCase.status
              }
              offers={
                coverageCase.offers
              }
            />
          ) : resolved &&
          coverageCase
            .approvedDecision ? (
            <ResolvedBoundaryCard />
          ) : coverageCase
              .approvedDecision?.kind ===
            "request_external_substitute" ? (
            <ExternalSubstituteFulfillmentPanel
              caseId={
                coverageCase.id
              }
              substituteName={
                BEFOREBELL_DEMO_EXTERNAL_SUBSTITUTE.name
              }
            />
          ) : coverageCase
              .approvedDecision ? (
            <ApprovedDecisionCard
              summary={
                coverageCase
                  .approvedDecision
                  .summary
              }
            />
          ) : coverageCase
              .needsAdministratorDecision ? (
            <HumanDecisionPanel
              caseId={
                coverageCase.id
              }
              unresolvedPeriods={
                coverageCase
                  .unresolvedPeriods
              }
            />
          ) : null}
        </div>

                <div
          className={`xl:sticky xl:top-6 xl:self-start ${
            resolved
              ? "order-first xl:order-none"
              : ""
          }`}
        >
          <LiveOrchestrationConsole
            events={
              coverageCase
                .activityEvents
            }
            resolved={
              resolved
            }
          />
        </div>
      </section>
    </div>
  );
}


function CaseStatus({
  resolved,
  needsAdministratorDecision,
  awaitingExecution,
  label,
}: {
  resolved:
    boolean;

  needsAdministratorDecision:
    boolean;

  awaitingExecution:
    boolean;

  label:
    string;
}) {
  const classes =
    resolved
      ? "border-[rgba(114,185,104,0.3)] bg-[var(--success-soft)] text-[#4d7f46]"
      : needsAdministratorDecision
        ? "border-[rgba(225,160,75,0.3)] bg-[var(--warning-soft)] text-[#99651f]"
        : awaitingExecution
          ? "border-[rgba(225,160,75,0.3)] bg-[var(--warning-soft)] text-[#99651f]"
          : "border-[rgba(78,215,241,0.26)] bg-[var(--cyan-soft)] text-[var(--cyan-deep)]";

  return (
    <div
      className={`w-fit rounded-lg border px-3 py-2 ${classes}`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`size-1.5 rounded-full ${
            resolved
              ? "bg-[var(--success)]"
              : needsAdministratorDecision ||
                  awaitingExecution
                ? "bg-[var(--warning)]"
                : "bg-[var(--cyan)]"
          }`}
        />

        <span className="text-xs font-semibold">
          {label}
        </span>
      </div>
    </div>
  );
}


function CaseMetric({
  label,
  value,
}: {
  label:
    string;

  value:
    string;
}) {
  return (
    <div className="px-5 py-4 sm:px-6">
      <p className="text-[11px] font-medium text-[var(--ink-muted)]">
        {label}
      </p>

      <p className="mt-2 text-lg font-semibold capitalize tracking-[-0.025em] text-[var(--ink)]">
        {value}
      </p>
    </div>
  );
}


function PeriodStatus({
  assignmentExists,
  needsAdministratorDecision,
}: {
  assignmentExists:
    boolean;

  needsAdministratorDecision:
    boolean;
}) {
  if (
    assignmentExists
  ) {
    return (
      <span className="w-fit rounded-md border border-[rgba(114,185,104,0.25)] bg-[var(--success-soft)] px-2 py-1 text-[10px] font-semibold text-[#4d7f46]">
        Covered
      </span>
    );
  }

  if (
    needsAdministratorDecision
  ) {
    return (
      <span className="w-fit rounded-md border border-[rgba(225,160,75,0.28)] bg-[var(--warning-soft)] px-2 py-1 text-[10px] font-semibold text-[#99651f]">
        Judgment required
      </span>
    );
  }

  return (
    <span className="w-fit rounded-md border border-[var(--border)] bg-[var(--surface-soft)] px-2 py-1 text-[10px] font-semibold text-[var(--ink-muted)]">
      Unresolved
    </span>
  );
}


function EvidenceCell({
  label,
  value,
}: {
  label:
    string;

  value:
    string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-4">
      <p className="text-[11px] text-[var(--ink-muted)]">
        {label}
      </p>

      <p className="mt-2 text-sm font-semibold text-[var(--ink)]">
        {value}
      </p>
    </div>
  );
}


function ResolvedBoundaryCard() {
  return (
    <div className="bb-panel-dark p-5 sm:p-6">
      <div className="relative z-10">
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-[var(--success)]" />

          <p className="bb-eyebrow text-white/35">
            Trusted fulfillment complete
          </p>
        </div>

        <h2 className="mt-4 text-lg font-semibold tracking-[-0.02em] text-white">
          Coverage is authoritatively resolved.
        </h2>

        <p className="mt-2 text-sm leading-6 text-white/55">
          Administrator approval and trusted fulfillment remain separate
          evidence. The approved external-substitute path has now executed and
          all affected periods are covered.
        </p>
      </div>
    </div>
  );
}


function ApprovedDecisionCard({
  summary,
}: {
  summary:
    string;
}) {
  return (
    <div className="bb-panel-dark p-5 sm:p-6">
      <div className="relative z-10">
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-[var(--warning)]" />

          <p className="bb-eyebrow text-white/35">
            Administrator decision recorded
          </p>
        </div>

        <h2 className="mt-4 text-lg font-semibold tracking-[-0.02em] text-white">
          Judgment is complete.
        </h2>

        <p className="mt-2 text-sm leading-6 text-white/55">
          {summary}
        </p>

        <div className="mt-4 rounded-xl border border-[rgba(225,160,75,0.18)] bg-[rgba(225,160,75,0.06)] p-3">
          <p className="text-xs leading-5 text-white/45">
            Approval is authoritative, but approval alone does not create a
            coverage assignment.
          </p>
        </div>
      </div>
    </div>
  );
}


function formatAssignmentSource(
  source:
    "accepted_offer" |
    "approved_exception",
): string {
  switch (
    source
  ) {
    case "accepted_offer":
      return "Accepted routine coverage";

    case "approved_exception":
      return "Administrator-approved exception";
  }
}


function CaseUnavailable({
  staffName,
}: {
  staffName:
    string;
}) {
  return (
    <div className="mx-auto max-w-[900px] bb-panel p-8">
      <h1 className="text-2xl font-semibold">
        {staffName}
      </h1>

      <p className="mt-3 text-sm text-[var(--ink-muted)]">
        The authoritative coverage store could not be reached.
      </p>
    </div>
  );
}


function CaseNotSeeded({
  staffName,
}: {
  staffName:
    string;
}) {
  return (
    <div className="mx-auto max-w-[900px] bb-panel p-8">
      <h1 className="text-2xl font-semibold">
        {staffName}
      </h1>

      <p className="mt-3 text-sm text-[var(--ink-muted)]">
        This persistent demo case has not been seeded yet.
      </p>
    </div>
  );
}