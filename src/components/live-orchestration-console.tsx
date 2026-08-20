import type {
  CoverageActivityEventView,
} from "@/server/coverage/beforebell-coverage-read-model";


export function LiveOrchestrationConsole({
  events,
  resolved,
}: {
  events:
    readonly CoverageActivityEventView[];

  resolved:
    boolean;
}) {
  return (
    <section className="bb-panel-dark">
      <div className="relative z-10 border-b border-white/[0.07] px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="bb-eyebrow text-white/35">
              Machine operations
            </p>

            <h2 className="mt-2 text-base font-semibold tracking-[-0.02em] text-white">
              {resolved
                ? "Authoritative trace replay"
                : "Orchestration evidence"}
            </h2>

            <p className="mt-1 max-w-xl text-xs leading-5 text-white/40">
              Persisted DynamoDB activity only. Every row below is authoritative
              evidence produced by the coordination workflow.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.035] px-2.5 py-1.5">
            <span
              className={`size-1.5 rounded-full ${
                resolved
                  ? "bg-[var(--success)]"
                  : "bg-[var(--cyan)]"
              }`}
            />

            <span className="bb-mono text-[10px] uppercase tracking-[0.12em] text-white/40">
              {events.length} persisted
            </span>
          </div>
        </div>
      </div>

      <div className="relative z-10">
        {events.length ===
        0 ? (
          <div className="px-5 py-10 text-center sm:px-6">
            <p className="text-sm font-medium text-white/60">
              No orchestration evidence yet.
            </p>

            <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-white/35">
              This console remains empty until authoritative activity is
              persisted for this coverage case.
            </p>
          </div>
        ) : (
          <ol className="divide-y divide-white/[0.065]">
            {events.map(
              (
                event,
                index,
              ) => (
                <ActivityRow
                  key={
                    event.eventId
                  }
                  event={
                    event
                  }
                  index={
                    index
                  }
                />
              ),
            )}
          </ol>
        )}
      </div>
    </section>
  );
}


function ActivityRow({
  event,
  index,
}: {
  event:
    CoverageActivityEventView;

  index:
    number;
}) {
  const signal =
    getEventSignal(
      event,
    );

  return (
    <li className="group px-5 py-4 transition-colors hover:bg-white/[0.025] sm:px-6">
      <div className="grid gap-3 sm:grid-cols-[70px_minmax(0,1fr)]">
        <div>
          <p className="bb-mono text-[11px] tabular-nums text-white/35">
            {formatTimestamp(
              event.timestamp,
            )}
          </p>

          <p className="bb-mono mt-1 text-[9px] uppercase tracking-[0.1em] text-white/20">
            EVT{" "}
            {String(
              index +
                1,
            ).padStart(
              2,
              "0",
            )}
          </p>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`size-1.5 shrink-0 rounded-full ${signal.dotClass}`}
            />

            <span
              className={`bb-mono text-[10px] font-semibold uppercase tracking-[0.11em] ${signal.textClass}`}
            >
              {formatActor(
                event.actorType,
              )}
            </span>

            <span className="text-white/15">
              /
            </span>

            <span className="bb-mono break-all text-[10px] text-white/42">
              {event.action}
            </span>

            <span
              className={`ml-auto rounded-md border px-1.5 py-0.5 bb-mono text-[9px] uppercase tracking-[0.08em] ${signal.badgeClass}`}
            >
              {event.status}
            </span>
          </div>

          <p className="mt-2 text-[13px] leading-5 text-white/72">
            {event.summary}
          </p>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {event.toolName ? (
              <EvidenceMeta
                label="tool"
                value={
                  event.toolName
                }
              />
            ) : null}

            {event.durationMs !==
            undefined ? (
              <EvidenceMeta
                label="duration"
                value={`${event.durationMs}ms`}
              />
            ) : null}

            <EvidenceMeta
              label="correlation"
              value={
                event.correlationId
              }
              breakable
            />
          </div>
        </div>
      </div>
    </li>
  );
}


function EvidenceMeta({
  label,
  value,
  breakable = false,
}: {
  label:
    string;

  value:
    string;

  breakable?:
    boolean;
}) {
  return (
    <span className="bb-mono text-[9px] leading-4 text-white/24">
      <span className="text-white/16">
        {label}:
      </span>{" "}
      <span
        className={
          breakable
            ? "break-all"
            : undefined
        }
      >
        {value}
      </span>
    </span>
  );
}


function getEventSignal(
  event:
    CoverageActivityEventView,
): {
  dotClass:
    string;

  textClass:
    string;

  badgeClass:
    string;
} {
  if (
    event.status ===
    "failed"
  ) {
    return {
      dotClass:
        "bg-[var(--danger)]",

      textClass:
        "text-[var(--danger)]",

      badgeClass:
        "border-[rgba(223,107,110,0.24)] bg-[rgba(223,107,110,0.08)] text-[var(--danger)]",
    };
  }

  if (
    event.status ===
      "waiting" ||
    event.actorType ===
      "administrator"
  ) {
    return {
      dotClass:
        "bg-[var(--warning)]",

      textClass:
        "text-[var(--warning)]",

      badgeClass:
        "border-[rgba(225,160,75,0.24)] bg-[rgba(225,160,75,0.08)] text-[var(--warning)]",
    };
  }

  if (
    event.actorType ===
      "system" &&
    event.status ===
      "succeeded"
  ) {
    return {
      dotClass:
        "bg-[var(--success)]",

      textClass:
        "text-[var(--success)]",

      badgeClass:
        "border-[rgba(114,185,104,0.24)] bg-[rgba(114,185,104,0.08)] text-[var(--success)]",
    };
  }

  if (
    event.actorType ===
      "agent" ||
    event.toolName
  ) {
    return {
      dotClass:
        "bg-[var(--cyan)]",

      textClass:
        "text-[var(--cyan)]",

      badgeClass:
        "border-[rgba(78,215,241,0.22)] bg-[rgba(78,215,241,0.07)] text-[var(--cyan)]",
    };
  }

  return {
    dotClass:
      "bg-white/35",

    textClass:
      "text-white/55",

    badgeClass:
      "border-white/10 bg-white/[0.04] text-white/45",
  };
}


function formatTimestamp(
  timestamp:
    string,
): string {
  const match =
    timestamp.match(
      /T(\d{2}:\d{2}:\d{2})/,
    );

  return (
    match?.[1] ??
    timestamp
  );
}


function formatActor(
  actorType:
    CoverageActivityEventView["actorType"],
): string {
  switch (
    actorType
  ) {
    case "administrator":
      return "ADMIN";

    case "candidate":
      return "CANDIDATE";

    case "agent":
      return "AGENT";

    case "system":
      return "SYSTEM";
  }
}
