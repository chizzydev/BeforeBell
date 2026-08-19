import Link from "next/link";

import {
  SidebarNav,
} from "@/components/sidebar-nav";

type AppShellProps = {
  children: React.ReactNode;
};


export function AppShell({
  children,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-[#f7f8f5] text-[#17201b]">
      <aside className="fixed inset-y-0 left-0 hidden w-[260px] flex-col border-r border-white/10 bg-[#101914] px-5 py-6 text-white lg:flex">
        <Link
          href="/"
          className="flex items-center gap-3 px-2"
        >
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#d8f36b] font-semibold text-[#101914]">
            B
          </div>

          <div>
            <p className="text-[15px] font-semibold tracking-tight">
              BeforeBell
            </p>
            <p className="mt-0.5 text-xs text-white/45">
              School coverage
            </p>
          </div>
        </Link>

<SidebarNav />

        <div className="mt-auto rounded-2xl border border-white/10 bg-white/[0.045] p-4">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-[#d8f36b]" />

            <p className="text-xs font-medium text-white/80">
              Cloud runtime connected
            </p>
          </div>

          <p className="mt-2 text-xs leading-5 text-white/40">
            Routine decisions stay automatic.
            Judgment stays human.
          </p>
        </div>
      </aside>

      <div className="lg:pl-[260px]">
        <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-[#e6e8e2] bg-[#f7f8f5]/90 px-5 backdrop-blur-xl sm:px-8 lg:px-10">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[#101914] font-semibold text-[#d8f36b]">
              B
            </div>

            <span className="font-semibold">
              BeforeBell
            </span>
          </div>

          <div className="hidden lg:block">
            <p className="text-sm text-[#6a746d]">
              Riverside Community School
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-[#dde1db] bg-white px-3 py-1.5 text-xs text-[#5c6860] sm:flex">
              <span className="size-1.5 rounded-full bg-[#70a754]" />
              AgentCore live
            </div>

            <div className="flex size-9 items-center justify-center rounded-full bg-[#e8ebe5] text-xs font-semibold text-[#314039]">
              AD
            </div>
          </div>
        </header>

        <main className="px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}