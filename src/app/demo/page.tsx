import Link from "next/link";

import {
  loadCoverageBoard,
  type CoverageCaseView,
} from "@/server/coverage/beforebell-coverage-read-model";

import {
  ScenarioBReplayControls,
} from "@/components/scenario-b-replay-controls";

export const dynamic =
  "force-dynamic";


export default async function DemoPage() {
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
      "BeforeBell demo read failed.",
      error,
    );
  }


  const scenarioA =
    cases.find(
      (
        currentCase,
      ) =>
        currentCase.scenario ===
        "A",
    );


  const scenarioB =
    cases.find(
      (
        currentCase,
      ) =>
        currentCase.scenario ===
        "B",
    );


  const scenarioC =
    cases.find(
      (
        currentCase,
      ) =>
        currentCase.scenario ===
        "C",
    );

    const scenarioBReadyToReplay =
  Boolean(
    scenarioB &&
    scenarioB.status ===
      "partially_covered" &&
    scenarioB
      .coveredPeriods
      .length ===
      2 &&
    scenarioB
      .coveredPeriods
      .includes(
        "P2",
      ) &&
    scenarioB
      .coveredPeriods
      .includes(
        "P3",
      ) &&
    scenarioB
      .unresolvedPeriods
      .length ===
      1 &&
    scenarioB
      .unresolvedPeriods
      .includes(
        "P5",
      ) &&
    scenarioB
      .needsAdministratorDecision &&
    !scenarioB
      .approvedDecision,
  );

  return (
    <div className="mx-auto max-w-[1180px]">
      <section className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium text-[#69746c]">
            Guided product walkthrough
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
            BeforeBell demo
          </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#68736b]">
            Three synthetic school-coverage scenarios show what BeforeBell
            automates, where it stops for human judgment, and how it safely
            recovers when the first plan fails.
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
            ? "Demo state unavailable"
            : "Live authoritative state"}
        </div>
      </section>


      <section className="mt-8 rounded-3xl bg-[#101914] p-6 text-white sm:p-8">
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div>
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#d8f36b]" />

              <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/45">
                Centerpiece scenario
              </p>
            </div>

            <h2 className="mt-4 max-w-2xl text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
              Daniel Reed — where automation stops on purpose.
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">
              BeforeBell covers P2 and P3 through routine policy, detects that
              P5 crosses a protected-planning boundary, interrupts the live
              agent, and resumes only after an administrator selects a
              permitted option.
            </p>
          </div>

{scenarioB ? (
  <ScenarioBReplayControls
    caseId={
      scenarioB.id
    }
    readyToReplay={
      scenarioBReadyToReplay
    }
  />
) : (
  <span className="inline-flex w-fit whitespace-nowrap rounded-xl border border-white/10 px-5 py-3 text-sm text-white/40">
    Scenario unavailable
  </span>
)}
</div>


        <div className="mt-8 grid gap-3 md:grid-cols-4">
          <DemoStep
            number="01"
            title="Routine coverage"
            detail="P2 and P3 are safely assigned."
          />

          <DemoStep
            number="02"
            title="Judgment boundary"
            detail="P5 cannot be safely automated."
          />

          <DemoStep
            number="03"
            title="Human decision"
            detail="Administrator selects one permitted option."
          />

          <DemoStep
            number="04"
            title="Trusted fulfillment"
            detail="Approved path executes and resolves 3/3."
          />
        </div>
      </section>


      <section className="mt-6 grid gap-5 lg:grid-cols-3">
        <ScenarioCard
          number="A"
          title="Routine success"
          staffName="Sarah Miller"
          description="A single safe candidate can cover the entire Math absence. No administrator judgment is required."
          currentCase={
            scenarioA
          }
          emphasis="Autonomous"
        />

        <ScenarioCard
          number="B"
          title="Human judgment"
          staffName="Daniel Reed"
          description="Routine Science coverage succeeds for P2/P3, but P5 crosses a protected policy boundary."
          currentCase={
            scenarioB
          }
          emphasis="Centerpiece"
          featured
        />

        <ScenarioCard
          number="C"
          title="Safe fallback"
          staffName="Olivia Chen"
          description="The preferred candidate declines, so BeforeBell preserves the decline, replans, and safely moves to the next eligible candidate."
          currentCase={
            scenarioC
          }
          emphasis="Resilient"
        />
      </section>


      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <div className="rounded-2xl border border-[#e1e5df] bg-white p-6">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#89928c]">
            What this demo proves
          </p>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <ProofPoint
              title="Deterministic policy"
              detail="Eligibility, conflicts, protected planning and assignment safety stay outside the model."
            />

            <ProofPoint
              title="Real agent orchestration"
              detail="Strands coordinates the workflow through Amazon Bedrock and deployed AgentCore."
            />

            <ProofPoint
              title="Human-in-the-loop"
              detail="The agent cannot choose or fabricate an exception. Administrator judgment arrives through a real interrupt."
            />

            <ProofPoint
              title="Authoritative evidence"
              detail="Assignments, human decisions, and workflow events are persisted in DynamoDB."
            />
          </div>
        </div>


        <div className="rounded-2xl border border-[#e1e5df] bg-white p-6">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#89928c]">
            Design principle
          </p>

          <h2 className="mt-4 text-xl font-semibold tracking-[-0.025em] text-[#202b24]">
            Safe routine decisions happen automatically.
          </h2>

          <p className="mt-3 text-sm leading-6 text-[#6d7870]">
            Judgment stays human. BeforeBell is intentionally narrow:
            absence coordination, safe coverage, exception handling and
            resolution — nothing more.
          </p>

          <div className="mt-5 rounded-xl bg-[#f5f7f3] p-4">
            <p className="text-xs leading-5 text-[#68736b]">
              Synthetic demo data only. Riverside Community School and all
              people shown here are fictional training entities.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}


function DemoStep({
  number,
  title,
  detail,
}: {
  number:
    string;

  title:
    string;

  detail:
    string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.05] p-4">
      <p className="text-[11px] font-semibold text-[#d8f36b]">
        {number}
      </p>

      <p className="mt-3 text-sm font-semibold">
        {title}
      </p>

      <p className="mt-1 text-xs leading-5 text-white/40">
        {detail}
      </p>
    </div>
  );
}


function ScenarioCard({
  number,
  title,
  staffName,
  description,
  currentCase,
  emphasis,
  featured = false,
}: {
  number:
    "A" |
    "B" |
    "C";

  title:
    string;

  staffName:
    string;

  description:
    string;

  currentCase:
    CoverageCaseView |
    undefined;

  emphasis:
    string;

  featured?:
    boolean;
}) {
  const status =
    currentCase
      ? getScenarioStatus(
          currentCase,
        )
      : {
          label:
            "Unavailable",

          className:
            "bg-[#eff2ef] text-[#667069]",
        };


  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-[#f1f3ef] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#69746c]">
          Scenario {number}
        </span>

        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${status.className}`}
        >
          {status.label}
        </span>
      </div>


      <p className="mt-5 text-xs font-medium uppercase tracking-[0.1em] text-[#919993]">
        {emphasis}
      </p>

      <h2 className="mt-2 text-lg font-semibold tracking-[-0.02em]">
        {title}
      </h2>

      <p className="mt-1 text-sm font-medium text-[#4e5a52]">
        {staffName}
      </p>

      <p className="mt-3 text-sm leading-6 text-[#778179]">
        {description}
      </p>


      {currentCase ? (
        <div className="mt-5 border-t border-[#edf0eb] pt-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#8c958f]">
              Coverage
            </span>

            <span className="font-semibold text-[#303c34]">
              {currentCase
                .coveredPeriods
                .length}
              /
              {currentCase
                .affectedPeriods
                .length}
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-[#8c958f]">
              Periods
            </span>

            <span className="font-semibold text-[#303c34]">
              {currentCase
                .affectedPeriods
                .join(
                  " · ",
                )}
            </span>
          </div>
        </div>
      ) : null}
    </>
  );


  if (
    !currentCase
  ) {
    return (
      <div
        className={`rounded-2xl border p-5 ${
          featured
            ? "border-[#dbe4b4] bg-[#fcfff1]"
            : "border-[#e1e5df] bg-white"
        }`}
      >
        {content}
      </div>
    );
  }


  return (
    <Link
      href={`/cases/${currentCase.id}`}
      className={`rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:shadow-sm ${
        featured
          ? "border-[#dbe4b4] bg-[#fcfff1]"
          : "border-[#e1e5df] bg-white"
      }`}
    >
      {content}
    </Link>
  );
}


function ProofPoint({
  title,
  detail,
}: {
  title:
    string;

  detail:
    string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="size-1.5 rounded-full bg-[#78a75f]" />

        <p className="text-sm font-semibold text-[#2a352e]">
          {title}
        </p>
      </div>

      <p className="mt-2 text-xs leading-5 text-[#778179]">
        {detail}
      </p>
    </div>
  );
}


function getScenarioStatus(
  currentCase:
    CoverageCaseView,
): {
  label:
    string;

  className:
    string;
} {
  if (
    currentCase.status ===
    "resolved"
  ) {
    return {
      label:
        "Resolved",

      className:
        "bg-[#edf6e9] text-[#4f7b42]",
    };
  }


  if (
    currentCase
      .needsAdministratorDecision
  ) {
    return {
      label:
        "Judgment required",

      className:
        "bg-[#fff4df] text-[#9a6a21]",
    };
  }


  if (
    currentCase
      .approvedDecision
  ) {
    return {
      label:
        "Fulfillment pending",

      className:
        "bg-[#eef0e8] text-[#687253]",
    };
  }


  return {
    label:
      "Ready",

    className:
      "bg-[#eff2ef] text-[#667069]",
  };
}