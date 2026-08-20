import Link from "next/link";

import {
  SidebarNav,
} from "@/components/sidebar-nav";


type AppShellProps = {
  children:
    React.ReactNode;
};


export function AppShell({
  children,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-transparent text-[#11181c]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[284px] flex-col overflow-hidden border-r border-white/[0.065] bg-[#0a0d0f] px-5 py-5 text-white lg:flex">
        <div className="pointer-events-none absolute -left-24 top-[-8rem] size-72 rounded-full bg-[#4ed7f1]/[0.035] blur-3xl" />

        <div className="pointer-events-none absolute bottom-[-11rem] right-[-10rem] size-72 rounded-full bg-[#c8f35a]/[0.025] blur-3xl" />


        <div className="relative">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-[10px] px-2 py-1"
          >
            <BrandMark />

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-[15px] font-semibold tracking-[-0.025em]">
                  BeforeBell
                </p>

                <span className="rounded border border-white/[0.08] bg-white/[0.035] px-1.5 py-0.5 font-mono text-[7px] font-semibold uppercase tracking-[0.16em] text-white/33">
                  OPS
                </span>
              </div>

              <p className="mt-0.5 truncate text-[9px] font-medium text-white/32">
                School coverage command
              </p>
            </div>
          </Link>


          <SidebarNav />
        </div>


        <div className="relative mt-auto space-y-3">
          <div className="overflow-hidden rounded-[12px] border border-white/[0.07] bg-[#10161a]">
            <div className="flex items-center gap-3 border-b border-white/[0.055] px-4 py-3.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-[8px] border border-[#4ed7f1]/15 bg-[#4ed7f1]/[0.07] text-[#4ed7f1]">
                <RuntimeIcon />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-[10px] font-semibold text-white/78">
                    AWS AgentCore
                  </p>

                  <span className="bb-live-dot size-1.5 rounded-full bg-[#4ed7f1] text-[#4ed7f1]" />
                </div>

                <p className="mt-0.5 text-[8px] uppercase tracking-[0.11em] text-white/27">
                  orchestration runtime
                </p>
              </div>
            </div>


            <div className="grid grid-cols-2 divide-x divide-white/[0.055]">
              <BoundaryStat
                label="Routine"
                value="Autonomous"
                tone="machine"
              />

              <BoundaryStat
                label="Judgment"
                value="Human"
                tone="human"
              />
            </div>
          </div>


          <div className="border-t border-white/[0.055] px-2 pt-3">
            <p className="text-[8px] font-semibold uppercase tracking-[0.135em] text-white/19">
              Operating principle
            </p>

            <p className="mt-2 text-[9px] leading-[1.7] text-white/27">
              Routine coordination is
              autonomous. Exceptions stop
              at the human boundary.
            </p>
          </div>
        </div>
      </aside>


      <div className="lg:pl-[284px]">
        <header className="sticky top-0 z-30 border-b border-[#dce2e5]/90 bg-[#f3f5f6]/90 backdrop-blur-xl">
          <div className="flex h-[74px] items-center justify-between px-5 sm:px-8 lg:px-9 xl:px-10">
            <div className="flex min-w-0 items-center gap-3 lg:hidden">
              <BrandMark
                compact
              />

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold tracking-[-0.02em]">
                  BeforeBell
                </p>

                <p className="truncate text-[9px] uppercase tracking-[0.09em] text-[#7a858b]">
                  Riverside Community School
                </p>
              </div>
            </div>


            <div className="hidden min-w-0 lg:block">
              <div className="flex items-center gap-2">
                <SchoolIcon />

                <p className="truncate text-[12px] font-semibold text-[#263138]">
                  Riverside Community School
                </p>
              </div>

              <p className="mt-1 font-mono text-[8px] font-medium uppercase tracking-[0.16em] text-[#899399]">
                Morning operations command
              </p>
            </div>


            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="hidden items-center gap-2 rounded-[8px] border border-[#d9e0e3] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(10,13,15,0.025)] sm:flex">
                <span className="size-1.5 rounded-full bg-[#4ed7f1]" />

                <div className="leading-none">
                  <p className="font-mono text-[8px] font-semibold uppercase tracking-[0.1em] text-[#536168]">
                    AgentCore
                  </p>
                </div>
              </div>


              <div className="hidden h-7 w-px bg-[#dce2e5] sm:block" />


              <div className="flex items-center gap-2.5">
                <div className="hidden text-right md:block">
                  <p className="text-[10px] font-semibold text-[#344148]">
                    Administrator
                  </p>

                  <p className="mt-0.5 text-[8px] uppercase tracking-[0.08em] text-[#929ba0]">
                    Operations
                  </p>
                </div>

                <div className="flex size-9 items-center justify-center rounded-[9px] border border-[#d8dfe2] bg-[#e8ecee] text-[9px] font-bold text-[#354249]">
                  AD
                </div>
              </div>
            </div>
          </div>
        </header>


        <main className="px-5 pb-28 pt-7 sm:px-8 sm:pt-8 lg:px-9 lg:pb-10 lg:pt-9 xl:px-10">
          {children}
        </main>
      </div>


      <div className="fixed bottom-3 left-3 right-3 z-50 rounded-[13px] border border-[#d8dfe2] bg-white/95 p-1.5 shadow-[0_18px_55px_rgba(10,13,15,0.18)] backdrop-blur-xl lg:hidden">
        <SidebarNav
          variant="mobile"
        />
      </div>
    </div>
  );
}


function BrandMark({
  compact =
    false,
}: {
  compact?:
    boolean;
}) {
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center border border-[#c8f35a]/30 bg-[#11171b] text-[#c8f35a] shadow-[0_0_0_1px_rgba(200,243,90,0.035),0_8px_22px_rgba(0,0,0,0.16)] ${
        compact
          ? "size-9 rounded-[9px]"
          : "size-10 rounded-[10px]"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={
          compact
            ? "size-[18px]"
            : "size-5"
        }
        aria-hidden="true"
      >
        <path d="M7.5 15.5V11a4.5 4.5 0 0 1 9 0v4.5" />
        <path d="M6 15.5h12" />
        <path d="M9.5 18.25h5" />
        <path d="M12 4.5V3" />
      </svg>

      <span className="absolute right-[5px] top-[5px] size-1.5 rounded-full bg-[#4ed7f1]" />
    </div>
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
      className="size-4"
      aria-hidden="true"
    >
      <path d="M8 7.5h8a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3Z" />
      <path d="M12 7.5V4" />
      <path d="M10 4h4" />
      <path d="M9 12h.01" />
      <path d="M15 12h.01" />
      <path d="M9.5 15h5" />
    </svg>
  );
}


function SchoolIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 text-[#7e8a91]"
      aria-hidden="true"
    >
      <path d="m3.5 9 8.5-5 8.5 5" />
      <path d="M5.5 10v8.5" />
      <path d="M18.5 10v8.5" />
      <path d="M9 18.5V14h6v4.5" />
      <path d="M3.5 20h17" />
    </svg>
  );
}


function BoundaryStat({
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
    | "human";
}) {
  return (
    <div className="px-3 py-3">
      <div className="flex items-center gap-1.5">
        <span
          className={`size-1.5 rounded-full ${
            tone ===
            "machine"
              ? "bg-[#4ed7f1]"
              : "bg-[#e1a04b]"
          }`}
        />

        <p className="font-mono text-[7px] uppercase tracking-[0.13em] text-white/28">
          {label}
        </p>
      </div>

      <p className="mt-1.5 text-[9px] font-semibold text-white/70">
        {value}
      </p>
    </div>
  );
}