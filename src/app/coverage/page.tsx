import Link from "next/link";

import {
  loadCoverageBoard,
  type CoverageCaseView,
} from "@/server/coverage/beforebell-coverage-read-model";


export const dynamic =
  "force-dynamic";


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


  const judgmentCount =
    cases.filter(
      (
        currentCase,
      ) =>
        currentCase
          .needsAdministratorDecision,
    ).length;


  return (
    <div className="mx-auto max-w-[1280px]">
      <section className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium text-[#69746c]">
            Coverage operations
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
            Today&apos;s coverage
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#68736b]">
            Authoritative absence, assignment and judgment state from
            BeforeBell&apos;s operational store.
          </p>
        </div>

        <div className="flex w-fit items-center gap-2 rounded-full border border-[#dce1da] bg-white px-3 py-2 text-xs font-medium text-[#536057] shadow-sm">
          <span
            className={`size-2 rounded-full ${
              unavailable
                ? "bg-[#cf8b43]"
                : "bg-[#74a95b]"
            }`}
          />

          {unavailable
            ? "Authoritative store unavailable"
            : "DynamoDB authoritative"}
        </div>
      </section>


      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <Metric
          label="Affected periods"
          value={String(
            totalPeriods,
          )}
          detail={`${cases.length} active demo cases`}
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
            judgmentCount,
          )}
          detail="Deterministic policy boundary"
        />
      </section>


      <section className="mt-6 overflow-hidden rounded-2xl border border-[#e1e5df] bg-white">
        <div className="flex items-center justify-between border-b border-[#edf0eb] px-5 py-4 sm:px-6">
          <div>
            <h2 className="font-semibold tracking-tight">
              Coverage cases
            </h2>

            <p className="mt-1 text-xs text-[#818a84]">
              Riverside Community School
            </p>
          </div>

          <span className="rounded-full bg-[#f1f3ef] px-2.5 py-1 text-[11px] font-medium text-[#657068]">
            Live state
          </span>
        </div>


        {unavailable ? (
          <div className="px-6 py-12 text-center">
            <p className="font-medium">
              Coverage state is temporarily unavailable.
            </p>

            <p className="mt-2 text-sm text-[#7d8780]">
              Check the local AWS session and refresh this page.
            </p>
          </div>
        ) : cases.length ===
          0 ? (
          <div className="px-6 py-12 text-center">
            <p className="font-medium">
              No persistent demo cases are seeded yet.
            </p>

            <p className="mt-2 text-sm text-[#7d8780]">
              Run the BeforeBell demo seed checkpoint, then refresh.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#edf0eb]">
            {cases.map(
              (
                currentCase,
              ) => (
                <CoverageCaseRow
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
      </section>
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
    <div className="rounded-2xl border border-[#e2e5df] bg-white p-5">
      <p className="text-sm text-[#717b74]">
        {label}
      </p>

      <p className="mt-4 text-3xl font-semibold tracking-[-0.04em]">
        {value}
      </p>

      <p className="mt-1 text-xs text-[#8a938d]">
        {detail}
      </p>
    </div>
  );
}


function CoverageCaseRow({
  currentCase,
}: {
  currentCase:
    CoverageCaseView;
}) {
  const isResolved =
    currentCase.status ===
    "resolved";

  const needsDecision =
    currentCase
      .needsAdministratorDecision;


  const statusLabel =
    isResolved
      ? "Coverage secured"
      : needsDecision
        ? "Decision required"
        : "Coordinating";


  const statusClass =
    isResolved
      ? "bg-[#edf6e9] text-[#4f7b42]"
      : needsDecision
        ? "bg-[#fff4df] text-[#9a6a21]"
        : "bg-[#eff2ef] text-[#667069]";


  return (
    <Link
      href={`/cases/${currentCase.id}`}
      className={`grid gap-4 px-5 py-5 transition-colors hover:bg-[#fafbf8] sm:grid-cols-[1fr_0.8fr_auto] sm:items-center sm:px-6 ${
        needsDecision
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


      <div className="flex items-center gap-3">
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${statusClass}`}
        >
          {statusLabel}
        </span>

        <span className="text-[#9aa29c]">
          →
        </span>
      </div>
    </Link>
  );
}