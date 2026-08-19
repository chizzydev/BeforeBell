import Link from "next/link";

import {
  loadHumanDecisionBoard,
  type HumanDecisionView,
} from "@/server/decisions/beforebell-decision-read-model";


export const dynamic =
  "force-dynamic";


export default async function DecisionsPage() {
  let decisions:
    HumanDecisionView[] = [];

  let unavailable =
    false;


  try {
    decisions =
      await loadHumanDecisionBoard();
  } catch (
    error
  ) {
    unavailable =
      true;

    console.error(
      "BeforeBell human-decision read failed.",
      error,
    );
  }


  const pendingCount =
    decisions.filter(
      (
        decision,
      ) =>
        decision.status ===
        "pending",
    ).length;


  const fulfilledCount =
    decisions.filter(
      (
        decision,
      ) =>
        decision.executionState ===
        "fulfilled",
    ).length;


  return (
    <div className="mx-auto max-w-[1180px]">
      <section className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium text-[#69746c]">
            Human judgment
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
            Decisions
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#68736b]">
            A durable record of the moments BeforeBell stopped automation
            and handed genuine judgment to an administrator.
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
            ? "Decision evidence unavailable"
            : "DynamoDB authoritative"}
        </div>
      </section>


      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <Metric
          label="Human decisions"
          value={String(
            decisions.length,
          )}
          detail="Persisted judgment records"
        />

        <Metric
          label="Awaiting response"
          value={String(
            pendingCount,
          )}
          detail="Administrator action pending"
        />

        <Metric
          label="Fulfilled approvals"
          value={String(
            fulfilledCount,
          )}
          detail="Approved path executed"
        />
      </section>


      <section className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="overflow-hidden rounded-2xl border border-[#e1e5df] bg-white">
          <div className="border-b border-[#edf0eb] px-5 py-4 sm:px-6">
            <h2 className="font-semibold tracking-tight">
              Decision history
            </h2>

            <p className="mt-1 text-xs text-[#818a84]">
              Human approvals remain distinct from operational execution
            </p>
          </div>


          {unavailable ? (
            <div className="px-6 py-12 text-center">
              <p className="font-medium">
                Decision evidence is temporarily unavailable.
              </p>

              <p className="mt-2 text-sm text-[#7d8780]">
                Check the AWS session and refresh.
              </p>
            </div>
          ) : decisions.length ===
            0 ? (
            <div className="px-6 py-12 text-center">
              <p className="font-medium">
                No human decisions have been recorded.
              </p>

              <p className="mt-2 text-sm text-[#7d8780]">
                Routine coverage has not crossed a human-judgment boundary.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#edf0eb]">
              {decisions.map(
                (
                  decision,
                ) => (
                  <DecisionRow
                    key={
                      decision.id
                    }
                    decision={
                      decision
                    }
                  />
                ),
              )}
            </div>
          )}
        </div>


        <div className="space-y-6">
          <div className="rounded-2xl bg-[#101914] p-5 text-white">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#d8f36b]" />

              <p className="text-xs font-medium uppercase tracking-[0.12em] text-white/45">
                Control boundary
              </p>
            </div>

            <h2 className="mt-4 text-lg font-semibold">
              Approval is not execution.
            </h2>

            <p className="mt-2 text-sm leading-6 text-white/55">
              BeforeBell persists human judgment separately from the action
              that later fulfills it. That makes the approval trail visible
              instead of hiding it inside an agent response.
            </p>
          </div>


          <div className="rounded-2xl border border-[#e1e5df] bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#89928c]">
              Evidence model
            </p>

            <div className="mt-5 space-y-4">
              <EvidenceRow
                label="Decision source"
                value="Human response"
              />

              <EvidenceRow
                label="Decision store"
                value="DynamoDB"
              />

              <EvidenceRow
                label="Execution link"
                value="decisionId"
              />

              <EvidenceRow
                label="Pending decisions"
                value={String(
                  pendingCount,
                )}
              />
            </div>
          </div>
        </div>
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


function DecisionRow({
  decision,
}: {
  decision:
    HumanDecisionView;
}) {
  const status =
    getDecisionStatus(
      decision,
    );


  return (
    <Link
      href={`/cases/${decision.caseId}`}
      className="block px-5 py-5 transition-colors hover:bg-[#fafbf8] sm:px-6"
    >
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#f1f3ef] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.08em] text-[#68736c]">
              Scenario {decision.scenario}
            </span>

            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${status.className}`}
            >
              {status.label}
            </span>
          </div>

          <h3 className="mt-3 text-base font-semibold text-[#253029]">
            {decision.staffName}
          </h3>

          <p className="mt-1 text-xs text-[#818a84]">
            {decision.roleLabel}
            {" · "}
            {decision.schoolName}
          </p>
        </div>


        <div className="text-left sm:text-right">
          <p className="text-xs text-[#8b948e]">
            Approved periods
          </p>

          <p className="mt-1 text-sm font-semibold text-[#2d3931]">
            {decision
              .periodIds
              .join(
                " · ",
              )}
          </p>
        </div>
      </div>


      <div className="mt-5 rounded-xl bg-[#f7f8f5] p-4">
        <p className="text-xs font-medium uppercase tracking-[0.1em] text-[#8b948e]">
          {decision.kindLabel}
        </p>

        <p className="mt-2 text-sm font-medium leading-6 text-[#344038]">
          {decision.summary}
        </p>
      </div>


      <div className="mt-4 grid gap-3 text-xs sm:grid-cols-3">
        <DecisionEvidence
          label="Decision"
          value={
            capitalize(
              decision.status,
            )
          }
        />

        <DecisionEvidence
          label="Execution"
          value={
            getExecutionLabel(
              decision
                .executionState,
            )
          }
        />

        <DecisionEvidence
          label="Fulfilled by"
          value={
            decision
              .fulfilledBy ??
            "Not yet fulfilled"
          }
        />
      </div>
    </Link>
  );
}


function DecisionEvidence({
  label,
  value,
}: {
  label:
    string;

  value:
    string;
}) {
  return (
    <div>
      <p className="text-[#929a95]">
        {label}
      </p>

      <p className="mt-1 font-semibold text-[#344038]">
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


function getDecisionStatus(
  decision:
    HumanDecisionView,
): {
  label:
    string;

  className:
    string;
} {
  if (
    decision.executionState ===
    "fulfilled"
  ) {
    return {
      label:
        "Approved · fulfilled",

      className:
        "bg-[#edf6e9] text-[#4f7b42]",
    };
  }


  if (
    decision.executionState ===
    "approved_pending_execution"
  ) {
    return {
      label:
        "Approved · pending execution",

      className:
        "bg-[#fff4df] text-[#9a6a21]",
    };
  }


  if (
    decision.executionState ===
    "rejected"
  ) {
    return {
      label:
        "Rejected",

      className:
        "bg-[#f5eeee] text-[#845c5c]",
    };
  }


  return {
    label:
      "Awaiting administrator",

    className:
      "bg-[#fff4df] text-[#9a6a21]",
  };
}


function getExecutionLabel(
  executionState:
    HumanDecisionView["executionState"],
): string {
  switch (
    executionState
  ) {
    case "fulfilled":
      return "Fulfilled";

    case "approved_pending_execution":
      return "Pending fulfillment";

    case "pending":
      return "Not approved";

    case "rejected":
      return "Not executed";
  }
}


function capitalize(
  value:
    string,
): string {
  return (
    value.charAt(
      0,
    ).toUpperCase() +
    value.slice(
      1,
    )
  );
}