import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { TokenGate } from "../../components/token-gate";

export const Route = createFileRoute("/admin/admin")({
  component: AdminPage,
});

/* ─────────────────────────────────────────────────────────────────────────
   /admin/admin — internal, token-gated visitor analytics for the generated
   guides. Everything is logged server-side per visit: Dubai time, IP, device,
   dwell, scroll depth, sections viewed.
   ───────────────────────────────────────────────────────────────────────── */

type GuideRow = {
  token: string;
  clientId: string;
  contractStartDate: string;
  salary: number;
  emirate: string;
  package: string;
  paymentMethod: string;
  visaTimeline: number;
  eidApplicationType: string | null;
  createdAt: string;
  createdAtDubai: string;
  visitCount: number;
  lastVisitDubai: string | null;
};

type VisitRow = {
  id: number;
  guideToken: string | null;
  sessionId: string;
  path: string | null;
  ip: string | null;
  device: string | null;
  os: string | null;
  browser: string | null;
  referrer: string | null;
  language: string | null;
  screen: string | null;
  timezone: string | null;
  startedAtDubai: string;
  lastSeenDubai: string;
  dwellMs: number;
  maxScrollPct: number;
  sectionsViewed: string[];
};

type Feed = { ok: true; guides: GuideRow[]; visits: VisitRow[] };

function fmtDwell(ms: number): string {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

function variantSummary(g: GuideRow): string {
  const parts = [
    g.emirate === "abu_dhabi" ? "Abu Dhabi" : "Dubai",
    `${g.package}k`,
    g.paymentMethod,
    `${g.visaTimeline}d`,
  ];
  if (g.emirate === "abu_dhabi" && g.eidApplicationType) parts.push(`EID ${g.eidApplicationType}`);
  return parts.join(" · ");
}

function AdminPage() {
  return (
    <TokenGate title="Admin · Analytics" subtitle="Enter the API token to view visitor logs.">
      {(token, clear) => <Dashboard token={token} onClear={clear} />}
    </TokenGate>
  );
}

function Dashboard({ token, onClear }: { token: string; onClear: () => void }) {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin", { headers: { authorization: `Bearer ${token}` } });
      if (res.status === 401) {
        setError("Token rejected. Lock and re-enter a valid token.");
        setFeed(null);
        return;
      }
      const data = await res.json();
      if (!data.ok) {
        setError(data.message || "Failed to load");
        return;
      }
      setFeed(data as Feed);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-dvh bg-[#EEF3FB] px-4 py-6 font-sans text-[#111827]">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-[22px] font-extrabold">
            Admin <span className="text-[#4878BC]">Analytics</span>
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-xl bg-[#4878BC] px-3 py-2 text-sm font-bold text-white hover:bg-[#3a67a8]"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={onClear}
              className="rounded-xl border border-[#B9CCE6] bg-white px-3 py-2 text-sm font-bold text-[#6B7280] hover:text-[#111827]"
            >
              Lock
            </button>
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl bg-[#FEF2F2] px-3 py-2 text-sm font-semibold text-[#B91C1C]">
            {error}
          </p>
        ) : null}
        {loading && !feed ? <p className="mt-4 text-sm text-[#6B7280]">Loading…</p> : null}

        {feed ? (
          <>
            <Section
              title={`Generated guides (${feed.guides.length})`}
              columns={[
                "Created (Dubai)",
                "Client ID",
                "Variant",
                "Salary",
                "Start",
                "Visits",
                "Last visit (Dubai)",
                "Link",
              ]}
              rows={feed.guides.map((g) => [
                g.createdAtDubai,
                g.clientId,
                variantSummary(g),
                `AED ${g.salary.toLocaleString("en-US")}`,
                g.contractStartDate,
                String(g.visitCount),
                g.lastVisitDubai ?? "—",
                <a
                  key="l"
                  href={`/Views/${g.token}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-[#4878BC] hover:underline"
                >
                  /Views/{g.token.slice(0, 8)}…
                </a>,
              ])}
              empty="No guides generated yet."
            />

            <Section
              title={`Visits (${feed.visits.length})`}
              columns={[
                "Started (Dubai)",
                "Last seen",
                "Guide",
                "IP",
                "Device",
                "OS / Browser",
                "Dwell",
                "Scroll",
                "Sections",
                "Lang / TZ",
                "Referrer",
              ]}
              rows={feed.visits.map((v) => [
                v.startedAtDubai,
                v.lastSeenDubai,
                v.guideToken ? `${v.guideToken.slice(0, 8)}…` : "—",
                v.ip ?? "—",
                v.device ?? "—",
                `${v.os ?? "?"} / ${v.browser ?? "?"}`,
                fmtDwell(v.dwellMs),
                `${v.maxScrollPct}%`,
                v.sectionsViewed.length ? v.sectionsViewed.join(", ") : "—",
                `${v.language ?? "?"} / ${v.timezone ?? "?"}`,
                v.referrer ?? "direct",
              ])}
              empty="No visits recorded yet."
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

function Section({
  title,
  columns,
  rows,
  empty,
}: {
  title: string;
  columns: string[];
  rows: React.ReactNode[][];
  empty: string;
}) {
  return (
    <section className="mt-6 rounded-2xl border border-[#B9CCE6]/70 bg-white p-4 shadow-sm">
      <h2 className="text-[16px] font-extrabold text-[#4878BC]">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-[#6B7280]">{empty}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#E5E7EB] text-xs tracking-wide text-[#6B7280] uppercase">
                {columns.map((c) => (
                  <th key={c} className="whitespace-nowrap px-2 py-2 font-bold">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-[#F1F5F9] align-top">
                  {r.map((cell, j) => (
                    <td key={j} className="px-2 py-2 whitespace-nowrap text-[#374151]">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
