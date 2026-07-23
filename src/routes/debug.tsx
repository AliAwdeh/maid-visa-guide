import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { MaidVisaGuide } from "../components/maid-visa-guide";
import { TokenGate } from "../components/token-gate";
import {
  variantLabel,
  type EidType,
  type Emirate,
  type Payment,
  type Pkg,
  type Speed,
  type VariantConfig,
} from "../lib/guide-config";

export const Route = createFileRoute("/debug")({
  component: DebugPage,
});

/* ─────────────────────────────────────────────────────────────────────────
   /debug — internal, token-gated. Fill in a client's terms (the same inputs
   the API accepts), preview the exact guide that would deploy, and generate a
   real /Views link (persisted, appears in /admin/admin).
   ───────────────────────────────────────────────────────────────────────── */

type OptionGroup<T extends string | number> = {
  label: string;
  options: { value: T; label: string; hint?: string }[];
};

function Segmented<T extends string | number>({
  group,
  value,
  onChange,
}: {
  group: OptionGroup<T>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <p className="text-xs font-bold tracking-wide text-[#6B7280] uppercase">{group.label}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {group.options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onChange(o.value)}
            title={o.hint}
            className={`rounded-xl border px-3 py-2 text-[13px] font-bold whitespace-nowrap transition-colors duration-150 ${
              value === o.value
                ? "border-[#4878BC] bg-[#4878BC] text-white shadow"
                : "border-[#B9CCE6]/80 bg-white text-[#374151] hover:bg-[#EEF3FB]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const EMIRATES: OptionGroup<Emirate> = {
  label: "Emirate",
  options: [
    { value: "dubai", label: "Dubai" },
    { value: "abu-dhabi", label: "Abu Dhabi" },
  ],
};
const PKGS: OptionGroup<Pkg> = {
  label: "Package",
  options: [
    { value: "8.5k", label: "8.5k", hint: "Salary + VAT + AED 160 fee + VAT" },
    { value: "10.96k", label: "10.96k", hint: "No monthly fee, no fee VAT" },
  ],
};
const PAYMENTS: OptionGroup<Payment> = {
  label: "Payment method",
  options: [
    { value: "direct-debit", label: "Direct Debit", hint: "Collected on the 1st" },
    { value: "credit-card", label: "Credit Card", hint: "Collected at PED (prev month − 4)" },
  ],
};
const SPEEDS: OptionGroup<Speed> = {
  label: "Visa timeline",
  options: [
    { value: 7, label: "7 days" },
    { value: 14, label: "14 days" },
  ],
};
const EID_TYPES: OptionGroup<EidType> = {
  label: "EID application type (Abu Dhabi only)",
  options: [
    { value: "new", label: "New", hint: "Adds Biometric Test" },
    { value: "renew", label: "Renew" },
  ],
};

type GenResult =
  | { ok: true; url: string; token: string }
  | { ok: false; step?: string; message: string; issues?: unknown };

function DebugPage() {
  return (
    <TokenGate
      title="Internal · Guide generator"
      subtitle="Enter the API token to preview and generate client guides."
    >
      {(token, clear) => <Generator token={token} onClear={clear} />}
    </TokenGate>
  );
}

function Generator({ token, onClear }: { token: string; onClear: () => void }) {
  const [clientId, setClientId] = useState("12345");
  const [contractStartDate, setContractStartDate] = useState("2026-06-01");
  const [salary, setSalary] = useState(1000);
  const [emirate, setEmirate] = useState<Emirate>("dubai");
  const [pkg, setPkg] = useState<Pkg>("8.5k");
  const [payment, setPayment] = useState<Payment>("direct-debit");
  const [speed, setSpeed] = useState<Speed>(7);
  const [eidType, setEidType] = useState<EidType>("new");

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<GenResult | null>(null);

  const config: VariantConfig = useMemo(
    () => ({ emirate, pkg, payment, speed, eidType, salary, contractStartDate }),
    [emirate, pkg, payment, speed, eidType, salary, contractStartDate],
  );

  async function generate() {
    setBusy(true);
    setResult(null);
    const apiBody = {
      CLIENT_ID: clientId,
      contract_start_date: contractStartDate,
      salary,
      EMIRATE: emirate === "abu-dhabi" ? "abu_dhabi" : "dubai",
      PACKAGE: pkg === "10.96k" ? "10.96" : "8.5",
      PAYMENT_METHOD: payment === "credit-card" ? "CC" : "DD",
      Visa_timeline: speed,
      ...(emirate === "abu-dhabi"
        ? { EID_APPLICATION_TYPE: eidType === "renew" ? "RENEW" : "NEW" }
        : {}),
    };
    try {
      const res = await fetch("/api/guides", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify(apiBody),
      });
      const data = (await res.json()) as GenResult;
      setResult(data);
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#EEF3FB]">
      <div className="border-b-2 border-dashed border-[#F6891E]/60 bg-[#FFF7ED] px-4 py-5">
        <div className="mx-auto max-w-xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-extrabold tracking-[0.15em] text-[#F6891E] uppercase">
              Internal · Guide generator
            </p>
            <button
              type="button"
              onClick={onClear}
              className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#6B7280] shadow-sm hover:text-[#111827]"
            >
              Lock
            </button>
          </div>

          {/* client inputs */}
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="text-xs font-bold tracking-wide text-[#6B7280] uppercase">
                Client ID
              </span>
              <input
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[#B9CCE6] bg-white px-3 py-2 text-sm font-semibold text-[#111827] outline-none focus:border-[#4878BC]"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold tracking-wide text-[#6B7280] uppercase">
                Contract start
              </span>
              <input
                type="date"
                value={contractStartDate}
                onChange={(e) => setContractStartDate(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[#B9CCE6] bg-white px-3 py-2 text-sm font-semibold text-[#111827] outline-none focus:border-[#4878BC]"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold tracking-wide text-[#6B7280] uppercase">
                Salary (AED)
              </span>
              <input
                type="number"
                min={0}
                value={salary}
                onChange={(e) => setSalary(Number(e.target.value))}
                className="mt-1.5 w-full rounded-xl border border-[#B9CCE6] bg-white px-3 py-2 text-sm font-semibold text-[#111827] outline-none focus:border-[#4878BC]"
              />
            </label>
          </div>

          {/* variant selectors */}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Segmented group={EMIRATES} value={emirate} onChange={setEmirate} />
            <Segmented group={PKGS} value={pkg} onChange={setPkg} />
            <Segmented group={PAYMENTS} value={payment} onChange={setPayment} />
            <Segmented group={SPEEDS} value={speed} onChange={setSpeed} />
            {emirate === "abu-dhabi" ? (
              <div className="sm:col-span-2">
                <Segmented group={EID_TYPES} value={eidType} onChange={setEidType} />
              </div>
            ) : null}
          </div>

          <p className="mt-4 rounded-xl bg-white px-3 py-2.5 text-sm font-bold text-[#111827] shadow-sm">
            Previewing:&nbsp;<span className="text-[#4878BC]">{variantLabel(config)}</span>
          </p>

          {/* generate */}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={generate}
              disabled={busy}
              className="rounded-xl bg-[#4878BC] px-4 py-2.5 text-sm font-bold text-white shadow transition-colors hover:bg-[#3a67a8] disabled:opacity-60"
            >
              {busy ? "Generating…" : "Generate link"}
            </button>
            {result?.ok ? (
              <a
                href={result.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-[#15B886] bg-white px-3 py-2 text-sm font-bold break-all text-[#0A7C5A] hover:bg-[#E9FBF4]"
              >
                {result.url}
              </a>
            ) : null}
          </div>
          {result && !result.ok ? (
            <p className="mt-2 rounded-xl bg-[#FEF2F2] px-3 py-2 text-sm font-semibold text-[#B91C1C]">
              Failed{result.step ? ` at step "${result.step}"` : ""}: {result.message}
            </p>
          ) : null}
        </div>
      </div>

      {/* live preview — renders exactly as the variant would deploy */}
      <MaidVisaGuide key={variantLabel(config)} config={config} />
    </div>
  );
}
