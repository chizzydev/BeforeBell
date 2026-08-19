"use client";

import Link from "next/link";

import {
  usePathname,
} from "next/navigation";


const navigation = [
  {
    label:
      "Overview",

    href:
      "/",

    ready:
      true,
  },

  {
    label:
      "Coverage",

    href:
      "/coverage",

    ready:
      true,
  },

  {
    label:
      "Decisions",

    href:
      "/decisions",

    ready:
      true,
  },

  {
    label:
      "Demo",

    href:
      "/demo",

    ready:
      true,
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


export function SidebarNav() {
  const pathname =
    usePathname();


  return (
    <nav className="mt-10 space-y-1">
      {navigation.map(
        (
          item,
        ) => {
          const active =
            item.ready &&
            isActiveRoute(
              pathname,
              item.href,
            );


          if (
            !item.ready
          ) {
            return (
              <div
                key={
                  item.label
                }
                className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm text-white/45"
              >
                <span>
                  {item.label}
                </span>

                <span className="rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-white/30">
                  soon
                </span>
              </div>
            );
          }


          return (
            <Link
              key={
                item.label
              }
              href={
                item.href
              }
              className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-white/[0.08] text-white"
                  : "text-white/55 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              <span>
                {item.label}
              </span>

              {active ? (
                <span className="size-1.5 rounded-full bg-[#d8f36b]" />
              ) : null}
            </Link>
          );
        },
      )}
    </nav>
  );
}