import Link from "next/link";

import {
  loadCoverageBoard,
  type CoverageCaseView,
} from "@/server/coverage/beforebell-coverage-read-model";


export const dynamic =
  "force-dynamic";


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


  const judgmentCases =
    cases.filter(
      (
        currentCase,
      ) =>
        currentCase
          .needsAdministratorDecision,
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


  return (
    <div className="mx-auto max-w-[1280px]">
      <section className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium text-[#69746c]">
            Tuesday · Before first bell
          </p>

          <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-[#17201b] sm:text-4xl">
            School coverage, handled before the day begins.
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#68736b] sm:text-base">
            BeforeBell coordinates routine teacher coverage automatically and
            pauses only when a real administrator decision is required.
          </p>
        </div>


        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#dce1da] bg-white px-3 py-2 text-xs font-medium text-[#536057] shadow-sm">
          <span
            className={`size-2 rounded-full ${
              unavailable
                ? "bg-[#cf8b43]"
                : "bg-[#74a95b]"
            }`}
          />

          {unavailable
            ? "Authoritative state unavailable"
            : "Morning coordination active"}
        </div>
      </section>


      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <Metric
          label="Affected periods"
          value={String(
            totalPeriods,
          )}
          detail={`${cases.length} coverage cases`}
        />

        <Metric
          label="Coverage recorded"
          value={String(
            coveredPeriods,
          )}
          detail="Confirmed assignments only"
        />

        <Metric
          label="Needs judgment"
          value={String(
            judgmentCases.length,
          )}
          detail="Human decisions pending"
        />
      </section>


      <section className="mt-6 grid gap-6 lg:grid-cols-[1.45fr_0.8fr]">
        <div className="overflow-hidden rounded-2xl border border-[#e1e5df] bg-white">
          <div className="flex items-center justify-between border-b border-[#edf0eb] px-5 py-4 sm:px-6">
            <div>
              <h2 className="font-semibold tracking-tight">
                Coverage board
              </h2>

              <p className="mt-1 text-xs text-[#818a84]">
                Today · Riverside Community School
              </p>
            </div>

            <Link
              href="/coverage"
              className="rounded-full bg-[#f1f3ef] px-2.5 py-1 text-[11px] font-medium text-[#657068] transition hover:bg-[#e7ebe5]"
            >
              View all
            </Link>
          </div>


          {unavailable ? (
            <div className="px-6 py-12 text-center">
              <p className="font-medium">
                Coverage state is unavailable.
              </p>

              <p className="mt-2 text-sm text-[#7d8780]">
                Check the AWS session and refresh.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#edf0eb]">
              {cases.map(
                (
                  currentCase,
                ) => (
                  <CoverageRow
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


        <div className="rounded-2xl border border-[#e1e5df] bg-white">
          <div className="border-b border-[#edf0eb] px-5 py-4">
            <h2 className="font-semibold tracking-tight">
              Case status
            </h2>

            <p className="mt-1 text-xs text-[#818a84]">
              Authoritative operational state
            </p>
          </div>


          <div className="p-5">
            <div className="space-y-5">
              {cases.map(
                (
                  currentCase,
                ) => (
                  <CaseStatus
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


            <div className="mt-6 border-t border-[#edf0eb] pt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#818a84]">
                  Human decisions recorded
                </span>

                <span className="font-semibold text-[#28332c]">
                  {approvedDecisionCases.length}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-[#818a84]">
                  Data source
                </span>

                <span className="font-semibold text-[#28332c]">
                  DynamoDB
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>


      <JudgmentBoundary
        judgmentCases={
          judgmentCases
        }
        approvedDecisionCases={
          approvedDecisionCases
        }
      />
    </div>
  );
}


function Metric({
  label,
  value,
  detail,
}: {
  label:
    string;

  value:
    string;

  detail:
    string;
}) {
  return (
    <div className="rounded-2xl border border-[#e2e5df] bg-white p-5 shadow-[0_1px_2px_rgba(20,30,24,0.02)]">
      <p className="text-sm text-[#717b74]">
        {label}
      </p>

      <p className="mt-5 text-3xl font-semibold tracking-[-0.04em]">
        {value}
      </p>

      <p className="mt-1 text-xs text-[#8a938d]">
        {detail}
      </p>
    </div>
  );
}


function CoverageRow({
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


  const status =
    resolved
      ? "Coverage secured"
      : needsJudgment
        ? "Decision required"
        : awaitingExecution
          ? "Fulfillment pending"
          : "Coordinating";


  const statusClass =
    resolved
      ? "bg-[#edf6e9] text-[#4f7b42]"
      : needsJudgment
        ? "bg-[#fff4df] text-[#9a6a21]"
        : awaitingExecution
          ? "bg-[#eef0e8] text-[#687253]"
          : "bg-[#eff2ef] text-[#667069]";


  return (
    <Link
      href={`/cases/${currentCase.id}`}
      className={`grid gap-4 px-5 py-5 transition-colors hover:bg-[#fafbf8] sm:grid-cols-[1fr_0.8fr_auto] sm:items-center sm:px-6 ${
        needsJudgment
          ? "bg-[#fffdf8]"
          : ""
      }`}
    >
      <div>
        <p className="text-sm font-semibold text-[#26312a]">
          {currentCase.staffName}
        </p>

        <p className="mt-1 text-xs text-[#828b85]">
          {currentCase.roleLabel}
        </p>
      </div>


      <div>
        <p className="text-xs font-medium text-[#5f6b63]">
          {currentCase
            .affectedPeriods
            .join(
              " · ",
            )}
        </p>

        <p className="mt-1 text-xs text-[#929a95]">
          {currentCase
            .coveredPeriods
            .length}
          /
          {currentCase
            .affectedPeriods
            .length}
          {" "}periods covered
        </p>
      </div>


      <span
        className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-medium ${statusClass}`}
      >
        {status}
      </span>
    </Link>
  );
}


function CaseStatus({
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


  return (
    <Link
      href={`/cases/${currentCase.id}`}
      className="flex gap-3 rounded-xl transition hover:bg-[#fafbf8]"
    >
      <div className="mt-1 flex flex-col items-center">
        <span
          className={`size-2 rounded-full ${
            resolved
              ? "bg-[#70a754]"
              : needsJudgment
                ? "bg-[#d29b3f]"
                : "bg-[#9ba39d]"
          }`}
        />

        <span className="mt-2 h-full min-h-8 w-px bg-[#e4e8e2]" />
      </div>


      <div className="pb-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#9ba29d]">
          Scenario {currentCase.scenario}
        </p>

        <p className="mt-1 text-sm font-medium text-[#253029]">
          {currentCase.staffName}
        </p>

        <p className="mt-1 text-xs leading-5 text-[#78817b]">
          {resolved
            ? `${currentCase.coveredPeriods.length}/${currentCase.affectedPeriods.length} covered · resolved`
            : needsJudgment
              ? `${currentCase.coveredPeriods.length}/${currentCase.affectedPeriods.length} covered · judgment required`
              : `${currentCase.coveredPeriods.length}/${currentCase.affectedPeriods.length} covered · coordinating`}
        </p>
      </div>
    </Link>
  );
}


function JudgmentBoundary({
  judgmentCases,
  approvedDecisionCases,
}: {
  judgmentCases:
    CoverageCaseView[];

  approvedDecisionCases:
    CoverageCaseView[];
}) {
  const pending =
    judgmentCases[0];

  const completed =
    approvedDecisionCases[0];


  return (
    <section className="mt-6 rounded-2xl bg-[#101914] p-6 text-white sm:p-7">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-[#d8f36b]" />

            <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/50">
              Human judgment boundary
            </p>
          </div>

          <h2 className="mt-3 text-xl font-semibold tracking-[-0.025em]">
            Safe routine decisions happen automatically.
          </h2>

          <p className="mt-2 max-w-xl text-sm leading-6 text-white/55">
            When policy requires genuine judgment, BeforeBell stops,
            presents only authoritative options, and waits for an
            administrator.
          </p>
        </div>


        {pending ? (
          <Link
            href={`/cases/${pending.id}`}
            className="rounded-xl border border-[#d8f36b]/20 bg-[#d8f36b]/[0.06] px-4 py-3 transition hover:bg-[#d8f36b]/[0.1]"
          >
            <p className="text-xs text-white/40">
              Current decision
            </p>

            <p className="mt-1 text-sm font-medium">
              {pending.staffName}
              {" · "}
              {pending
                .unresolvedPeriods
                .join(
                  ", ",
                )}
            </p>

            <p className="mt-1 text-xs text-[#d8f36b]">
              Administrator input required
            </p>
          </Link>
        ) : completed ? (
          <Link
            href={`/cases/${completed.id}`}
            className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 transition hover:bg-white/[0.09]"
          >
            <p className="text-xs text-white/40">
              Judgment status
            </p>

            <p className="mt-1 text-sm font-medium">
              No decisions pending
            </p>

            <p className="mt-1 text-xs text-[#d8f36b]">
              Human decision preserved in evidence
            </p>
          </Link>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3">
            <p className="text-xs text-white/40">
              Judgment status
            </p>

            <p className="mt-1 text-sm font-medium">
              No decisions pending
            </p>

            <p className="mt-1 text-xs text-white/45">
              Routine coordination active
            </p>
          </div>
        )}
      </div>
    </section>
  );
}