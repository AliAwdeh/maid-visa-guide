import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  MaidVisaGuide,
  variantLabel,
  type EidType,
  type Emirate,
  type Payment,
  type Pkg,
  type Speed,
  type VariantConfig,
} from "../components/maid-visa-guide";

export const Route = createFileRoute("/")({
  component: Index,
});

/* ═══════════════════════════════════════════════════════════════════════════
   VERSION SELECTOR APP — internal tool
   ─────────────────────────────────────────────────────────────────────────
   Renders EVERY permutation of the Maid Visa Guide from one shared component
   (src/components/maid-visa-guide.tsx). The panel below is the "extra
   section": pick a mode on each dimension and the guide underneath re-renders
   exactly as it would be deployed for that variant.

   Dimensions:
     Emirate            Dubai | Abu Dhabi
     Package            8.5k (fee AED 160 + VAT → total 1,218)
                        | 10.96k (no fee, no fee VAT → total 1,050)
     Payment method     Direct Debit (1st of each month)
                        | Credit Card (PED = last day of previous month − 4,
                          computed per month: 26 Jun / 27 Jul / 27 Aug)
     Visa timeline      7 days (CoS 3 · Medical 2 · Residency 2)
                        | 14 days (CoS 8 · Medical 3 · Residency 3)
     EID application    New | Renew — Abu Dhabi only. "New" inserts a
                        Biometric Test (~2 days) between Medical Test and
                        Residency Visa; "Renew" follows the Dubai timeline.

   Dubai: 2 × 2 × 2 = 8 variants. Abu Dhabi: 2 × 2 × 2 × 2 = 16.
   Total: 24 deployable versions. Her Rights never changes.
   ═══════════════════════════════════════════════════════════════════════════ */

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
            className={`rounded-xl border px-3 py-2 text-[13px] font-bold whitespace-nowrap transition-colors duration-150 ${
              value === o.value
                ? "border-[#4878BC] bg-[#4878BC] text-white shadow"
                : "border-[#B9CCE6]/80 bg-white text-[#374151] hover:bg-[#EEF3FB]"
            }`}
            title={o.hint}
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
    { value: "8.5k", label: "8.5k", hint: "Salary + VAT + AED 160 fee + VAT = AED 1,218" },
    { value: "10.96k", label: "10.96k", hint: "No monthly fee, no fee VAT = AED 1,050" },
  ],
};
const PAYMENTS: OptionGroup<Payment> = {
  label: "Payment method",
  options: [
    { value: "direct-debit", label: "Direct Debit", hint: "Collected on the 1st of each month" },
    {
      value: "credit-card",
      label: "Credit Card",
      hint: "Collected at PED = last day of previous month − 4",
    },
  ],
};
const SPEEDS: OptionGroup<Speed> = {
  label: "Visa timeline",
  options: [
    { value: 7, label: "7 days", hint: "CoS 3 · Medical 2 · Residency 2" },
    { value: 14, label: "14 days", hint: "CoS 8 · Medical 3 · Residency 3" },
  ],
};
const EID_TYPES: OptionGroup<EidType> = {
  label: "EID application type (Abu Dhabi only)",
  options: [
    { value: "new", label: "New", hint: "Adds Biometric Test (~2 days) before Residency Visa" },
    { value: "renew", label: "Renew", hint: "Same visa timeline as Dubai" },
  ],
};

function Index() {
  const [emirate, setEmirate] = useState<Emirate>("dubai");
  const [pkg, setPkg] = useState<Pkg>("8.5k");
  const [payment, setPayment] = useState<Payment>("direct-debit");
  const [speed, setSpeed] = useState<Speed>(7);
  const [eidType, setEidType] = useState<EidType>("new");

  const config: VariantConfig = useMemo(
    () => ({ emirate, pkg, payment, speed, eidType }),
    [emirate, pkg, payment, speed, eidType],
  );

  return (
    <div className="min-h-screen bg-[#EEF3FB]">
      {/* ══════════════════ EXTRA SECTION: VERSION SELECTOR ══════════════════
          This panel does not exist in the client-facing deployments — it is
          the internal switchboard for previewing each deployable version. */}
      <div className="border-b-2 border-dashed border-[#F6891E]/60 bg-[#FFF7ED] px-4 py-5">
        <div className="mx-auto max-w-xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-extrabold tracking-[0.15em] text-[#F6891E] uppercase">
              Internal · Version selector
            </p>
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#6B7280] shadow-sm">
              24 versions total
            </span>
          </div>

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
        </div>
      </div>

      {/* the guide below renders exactly as that variant would be deployed */}
      <MaidVisaGuide key={variantLabel(config)} config={config} />
    </div>
  );
}
