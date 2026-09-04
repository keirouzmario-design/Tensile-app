"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard/client", label: "Home" },
  { href: "/dashboard/client/package", label: "Package" },
  { href: "/dashboard/client/workout", label: "Workout" },
  { href: "/dashboard/client/injuries", label: "Injuries" },
  { href: "/dashboard/client/meal", label: "Meal" },
];

export default function ClientNav() {
  const pathname = usePathname();
  return (
    <div style={{ display: "flex", gap: 4, marginTop: 12, borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              padding: "8px 12px",
              fontSize: 13,
              fontWeight: 600,
              color: active ? "var(--ink)" : "var(--steel)",
              borderBottom: active ? "2px solid var(--moss)" : "2px solid transparent",
              textDecoration: "none",
              marginBottom: -1,
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
