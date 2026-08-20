"use client";

import Link from "next/link";

import {
  usePathname,
} from "next/navigation";


type NavIconName =
  | "overview"
  | "coverage"
  | "decisions"
  | "demo";


type SidebarNavProps = {
  variant?:
    | "desktop"
    | "mobile";
};


const navigation: Array<{
  label: string;
  shortLabel: string;
  description: string;
  href: string;
  icon: NavIconName;
}> = [
  {
    label:
      "Overview",

    shortLabel:
      "Overview",

    description:
      "Morning operations",

    href:
      "/",

    icon:
      "overview",
  },

  {
    label:
      "Coverage",

    shortLabel:
      "Coverage",

    description:
      "Cases and assignments",

    href:
      "/coverage",

    icon:
      "coverage",
  },

  {
    label:
      "Decisions",

    shortLabel:
      "Decisions",

    description:
      "Human judgment",

    href:
      "/decisions",

    icon:
      "decisions",
  },

  {
    label:
      "Demo",

    shortLabel:
      "Demo",

    description:
      "Agent walkthrough",

    href:
      "/demo",

    icon:
      "demo",
  },
];


function isActiveRoute(
  pathname:
    string,
  href:
    string,
): boolean {
  if (
    href ===
    "/"
  ) {
    return pathname ===
      "/";
  }

  if (
    href ===
      "/coverage" &&
    pathname.startsWith(
      "/cases/",
    )
  ) {
    return true;
  }

  return (
    pathname ===
      href ||
    pathname.startsWith(
      `${href}/`,
    )
  );
}


export function SidebarNav({
  variant =
    "desktop",
}: SidebarNavProps) {
  const pathname =
    usePathname();


  if (
    variant ===
    "mobile"
  ) {
    return (
      <nav
        aria-label="Primary navigation"
        className="grid grid-cols-4 gap-1"
      >
        {navigation.map(
          (
            item,
          ) => {
            const active =
              isActiveRoute(
                pathname,
                item.href,
              );


            return (
              <Link
                key={
                  item.label
                }
                href={
                  item.href
                }
                aria-current={
                  active
                    ? "page"
                    : undefined
                }
                className={`relative flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-[9px] px-1 py-2 text-[10px] font-medium transition ${
                  active
                    ? "bg-[#11171b] text-white"
                    : "text-[#768188] hover:bg-[#edf0f2] hover:text-[#202a2f]"
                }`}
              >
                <NavIcon
                  name={
                    item.icon
                  }
                  className={`size-[18px] ${
                    active
                      ? "text-[#4ed7f1]"
                      : "text-current"
                  }`}
                />

                <span className="truncate">
                  {
                    item.shortLabel
                  }
                </span>

                {active ? (
                  <span className="absolute bottom-1 left-1/2 h-[2px] w-4 -translate-x-1/2 rounded-full bg-[#c8f35a]" />
                ) : null}
              </Link>
            );
          },
        )}
      </nav>
    );
  }


  return (
    <nav
      aria-label="Primary navigation"
      className="mt-9"
    >
      <p className="px-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/27">
        Workspace
      </p>

      <div className="mt-3 space-y-1">
        {navigation.map(
          (
            item,
          ) => {
            const active =
              isActiveRoute(
                pathname,
                item.href,
              );


            return (
              <Link
                key={
                  item.label
                }
                href={
                  item.href
                }
                aria-current={
                  active
                    ? "page"
                    : undefined
                }
                className={`group relative flex items-center gap-3 rounded-[10px] border px-3 py-3 transition ${
                  active
                    ? "border-white/[0.075] bg-white/[0.065] text-white"
                    : "border-transparent text-white/50 hover:border-white/[0.04] hover:bg-white/[0.032] hover:text-white"
                }`}
              >
                {active ? (
                  <span className="absolute -left-[1px] top-1/2 h-6 w-[2px] -translate-y-1/2 rounded-full bg-[#c8f35a]" />
                ) : null}


                <div
                  className={`flex size-9 shrink-0 items-center justify-center rounded-[8px] border transition ${
                    active
                      ? "border-[#4ed7f1]/15 bg-[#4ed7f1]/[0.075] text-[#4ed7f1]"
                      : "border-white/[0.045] bg-white/[0.025] text-white/38 group-hover:text-white/70"
                  }`}
                >
                  <NavIcon
                    name={
                      item.icon
                    }
                    className="size-[18px]"
                  />
                </div>


                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-[13px] font-semibold ${
                      active
                        ? "text-white"
                        : ""
                    }`}
                  >
                    {
                      item.label
                    }
                  </p>

                  <p
                    className={`mt-0.5 truncate text-[9px] ${
                      active
                        ? "text-white/36"
                        : "text-white/23"
                    }`}
                  >
                    {
                      item.description
                    }
                  </p>
                </div>


                {active ? (
                  <span className="size-1 rounded-full bg-[#c8f35a]" />
                ) : null}
              </Link>
            );
          },
        )}
      </div>
    </nav>
  );
}


function NavIcon({
  name,
  className,
}: {
  name:
    NavIconName;

  className?:
    string;
}) {
  const commonProps = {
    className,
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
    "aria-hidden":
      true,
  };


  switch (
    name
  ) {
    case "overview":
      return (
        <svg {...commonProps}>
          <path d="M4 13h6V4H4v9Z" />
          <path d="M14 20h6v-9h-6v9Z" />
          <path d="M4 20h6v-3H4v3Z" />
          <path d="M14 7h6V4h-6v3Z" />
        </svg>
      );

    case "coverage":
      return (
        <svg {...commonProps}>
          <path d="M7 3.75h10a2 2 0 0 1 2 2v14.5H5V5.75a2 2 0 0 1 2-2Z" />
          <path d="M8.5 8h7" />
          <path d="M8.5 12h4" />
          <path d="m14.5 15.5 1.5 1.5 3-3" />
        </svg>
      );

    case "decisions":
      return (
        <svg {...commonProps}>
          <path d="M12 3.5 19 7v5c0 4.1-2.65 7.25-7 8.5-4.35-1.25-7-4.4-7-8.5V7l7-3.5Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );

    case "demo":
      return (
        <svg {...commonProps}>
          <rect
            x="3.5"
            y="5"
            width="17"
            height="14"
            rx="2"
          />

          <path d="m10 9 5 3-5 3V9Z" />
        </svg>
      );
  }
}