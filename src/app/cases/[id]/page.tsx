import Link from "next/link";

import {
  notFound,
} from "next/navigation";

import {
  getBeforeBellDemoCase,
} from "@/demo/beforebell-demo";

import {
  loadCoverageCase,
} from "@/server/coverage/beforebell-coverage-read-model";

import {
  HumanDecisionPanel,
} from "@/components/human-decision-panel";

import {
  ExternalSubstituteFulfillmentPanel,
} from "@/components/external-substitute-fulfillment-panel";

import {
  BEFOREBELL_DEMO_EXTERNAL_SUBSTITUTE,
} from "@/demo/beforebell-demo";

import {
  ScenarioCFallbackPanel,
} from "@/components/scenario-c-fallback-panel";

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

  return (
    <div className="mx-auto max-w-[1180px]">
      <Link
        href="/coverage"
        className="text-sm font-medium text-[#657068] transition hover:text-[#1b2720]"
      >
        ← Coverage
      </Link>


      <section className="mt-6 flex flex-col justify-between gap-5 md:flex-row md:items-start">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#eff2ef] px-2.5 py-1 text-[11px] font-medium text-[#657068]">
              Scenario {coverageCase.scenario}
            </span>

            <span className="text-xs text-[#909993]">
              {coverageCase.date}
            </span>
          </div>

          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
            {coverageCase.staffName}
          </h1>

          <p className="mt-2 text-sm text-[#6e7971]">
            {coverageCase.roleLabel}
            {" · "}
            {coverageCase.schoolName}
          </p>
        </div>


        <span
          className={`w-fit rounded-full px-3 py-1.5 text-xs font-medium ${
            resolved
              ? "bg-[#edf6e9] text-[#4f7b42]"
              : coverageCase
                    .needsAdministratorDecision
                ? "bg-[#fff4df] text-[#9a6a21]"
                : "bg-[#eff2ef] text-[#667069]"
          }`}
        >
          {resolved
  ? "Coverage secured"
  : coverageCase
        .needsAdministratorDecision
    ? "Administrator judgment required"
    : awaitingExecution
      ? "Decision approved · fulfillment pending"
      : "Coordination active"}
        </span>
      </section>


      <section className="mt-8 grid gap-4 sm:grid-cols-3">
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
      </section>


      <section className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-[#e1e5df] bg-white">
          <div className="border-b border-[#edf0eb] px-5 py-4 sm:px-6">
            <h2 className="font-semibold tracking-tight">
              Period coverage
            </h2>

            <p className="mt-1 text-xs text-[#818a84]">
              Confirmed assignment state
            </p>
          </div>


          <div className="divide-y divide-[#edf0eb]">
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
                      className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6"
                    >
                      <div>
                        <p className="text-sm font-semibold">
                          {periodId}
                        </p>

                        <p className="mt-1 text-xs text-[#818a84]">
                          {assignment
                            ? assignment.candidateName
                            : "No confirmed assignment"}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                          assignment
                            ? "bg-[#edf6e9] text-[#4f7b42]"
                            : coverageCase
                                  .needsAdministratorDecision
                              ? "bg-[#fff4df] text-[#9a6a21]"
                              : "bg-[#eff2ef] text-[#667069]"
                        }`}
                      >
                        {assignment
                          ? "Covered"
                          : coverageCase
                                .needsAdministratorDecision
                            ? "Judgment required"
                            : "Unresolved"}
                      </span>
                    </div>
                  );
                },
              )}
          </div>
        </div>


        <div className="space-y-6">
          <div className="rounded-2xl border border-[#e1e5df] bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#89928c]">
              Authoritative evidence
            </p>

            <div className="mt-5 space-y-4">
              <EvidenceRow
                label="Assignments"
                value={String(
                  coverageCase
                    .assignments
                    .length,
                )}
              />

              <EvidenceRow
                label="Human decisions"
                value={String(
                  coverageCase
                    .decisionCount,
                )}
              />

              <EvidenceRow
                label="Activity events"
                value={String(
                  coverageCase
                    .activityCount,
                )}
              />

              <EvidenceRow
                label="Data source"
                value="DynamoDB"
              />
            </div>
          </div>

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
  <div className="rounded-2xl bg-[#101914] p-5 text-white">
    <div className="flex items-center gap-2">
      <span className="size-2 rounded-full bg-[#d8f36b]" />

      <p className="text-xs font-medium uppercase tracking-[0.12em] text-white/45">
        Coverage resolved
      </p>
    </div>

    <h2 className="mt-4 text-lg font-semibold">
      All affected periods are covered.
    </h2>

    <p className="mt-2 text-sm leading-6 text-white/55">
      The administrator-approved external substitute path has been
      fulfilled and authoritative coverage is now complete.
    </p>
  </div>
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
  <div className="rounded-2xl bg-[#101914] p-5 text-white">
    <p className="text-xs font-medium uppercase tracking-[0.12em] text-white/45">
      Decision recorded
    </p>

    <h2 className="mt-4 text-lg font-semibold">
      Administrator judgment is complete.
    </h2>

    <p className="mt-2 text-sm leading-6 text-white/55">
      {coverageCase
        .approvedDecision
        .summary}
    </p>
  </div>
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
      </section>
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
    <div className="rounded-2xl border border-[#e2e5df] bg-white p-5">
      <p className="text-xs text-[#7d8780]">
        {label}
      </p>

      <p className="mt-3 text-lg font-semibold capitalize tracking-[-0.02em]">
        {value}
      </p>
    </div>
  );
}


function EvidenceRow({
  label,
  value,
}: {
  label:
    string;
  value:
    string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-[#727d75]">
        {label}
      </span>

      <span className="text-sm font-semibold text-[#27322b]">
        {value}
      </span>
    </div>
  );
}


function CaseUnavailable({
  staffName,
}: {
  staffName:
    string;
}) {
  return (
    <div className="mx-auto max-w-[900px] rounded-2xl border border-[#e1e5df] bg-white p-8">
      <h1 className="text-2xl font-semibold">
        {staffName}
      </h1>

      <p className="mt-3 text-sm text-[#737d76]">
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
    <div className="mx-auto max-w-[900px] rounded-2xl border border-[#e1e5df] bg-white p-8">
      <h1 className="text-2xl font-semibold">
        {staffName}
      </h1>

      <p className="mt-3 text-sm text-[#737d76]">
        This persistent demo case has not been seeded yet.
      </p>
    </div>
  );
}