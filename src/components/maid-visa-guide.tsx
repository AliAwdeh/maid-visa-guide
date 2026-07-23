import { useEffect, useState } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   MAID VISA GUIDE — shared, variant-driven component
   ─────────────────────────────────────────────────────────────────────────
   Every version of the guide is fully described by a VariantConfig:

     emirate   "dubai" | "abu-dhabi"
     pkg       "8.5k"  | "10.96k"        (10.96k → no monthly fee, no fee VAT)
     payment   "direct-debit" | "credit-card"
                 direct-debit → collected on the 1st of each month
                 credit-card  → collected at PED = last day of the previous
                                month − 4 (computed per month, so it adapts
                                to 30/31-day months automatically)
     speed     7 | 14                    (14 → CoS ~8, Medical ~3, Residency ~3)
     eidType   "new" | "renew"           (Abu Dhabi only; "new" inserts a
                                          Biometric Test ~2 days between
                                          Medical Test and Residency Visa;
                                          "renew" = same timeline as Dubai)

   Her Rights is identical in every variant.

   Brand palette (maids.cc logo + Expectation Message deck):
   blue #4878BC · orange #F6891E · green #15B886 / #0A7C5A
   dark #111827 · gray #6B7280 / #374151 · wash #EEF3FB · #B9CCE6 / #E5E7EB
   ═══════════════════════════════════════════════════════════════════════════ */

export type Emirate = "dubai" | "abu-dhabi";
export type Pkg = "8.5k" | "10.96k";
export type Payment = "direct-debit" | "credit-card";
export type Speed = 7 | 14;
export type EidType = "new" | "renew";

export type VariantConfig = {
  emirate: Emirate;
  pkg: Pkg;
  payment: Payment;
  speed: Speed;
  /** Only meaningful for Abu Dhabi. Ignored for Dubai. */
  eidType: EidType;
};

export const DEFAULT_CONFIG: VariantConfig = {
  emirate: "dubai",
  pkg: "8.5k",
  payment: "direct-debit",
  speed: 7,
  eidType: "new",
};

/** Human-readable key, e.g. "Dubai · 8.5k · Direct Debit · 7 days" */
export function variantLabel(c: VariantConfig): string {
  const parts = [
    c.emirate === "dubai" ? "Dubai" : "Abu Dhabi",
    c.pkg,
    c.payment === "direct-debit" ? "Direct Debit" : "Credit Card",
    `${c.speed} days`,
  ];
  if (c.emirate === "abu-dhabi") parts.push(c.eidType === "new" ? "EID New" : "EID Renew");
  return parts.join(" · ");
}

/* ------------------------- payment-date computation ------------------------ */
/* The demo cohort (same as the Expectation Message deck) pays for July,
   August and September. Salary months are July & August, paid by the 3rd of
   the following month. */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function daysInMonth(monthIndex: number, year = 2026): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

/**
 * Collection date for the payment that covers `coveredMonthIndex`.
 * direct-debit → the 1st of the covered month.
 * credit-card  → PED: (last day of the PREVIOUS month − 4), dynamic per
 *                month (30-day June → 26th, 31-day July/August → 27th).
 */
export function collectionDate(payment: Payment, coveredMonthIndex: number): string {
  if (payment === "direct-debit") return `1st of ${MONTHS[coveredMonthIndex]}`;
  const prev = (coveredMonthIndex + 11) % 12;
  const day = daysInMonth(prev) - 4;
  return `${ordinal(day)} of ${MONTHS[prev]}`;
}

/* ------------------------------ receipt maths ------------------------------ */

export function receiptFor(pkg: Pkg) {
  const rows: { label: string; value: string; orange?: boolean; vat?: boolean }[] = [
    { label: "Maid's salary", value: "AED 1,000" },
    { label: "VAT (5%)", value: "AED 50", vat: true },
  ];
  if (pkg === "8.5k") {
    rows.push(
      { label: "Monthly payment fee", value: "AED 160", orange: true },
      { label: "VAT (5%)", value: "AED 8", vat: true },
    );
  }
  const total = pkg === "8.5k" ? "AED 1,218" : "AED 1,050";
  return { rows, total };
}

/* ---------------------------------- icons --------------------------------- */

type IconProps = { className?: string };

function Icon({ children, className }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const IcDoc = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="m9 15 2 2 4-4" />
  </Icon>
);
const IcRefresh = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M3 21v-5h5" />
  </Icon>
);
const IcPulse = (p: IconProps) => (
  <Icon {...p}>
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </Icon>
);
const IcFingerprint = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
    <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
    <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
    <path d="M2 12a10 10 0 0 1 18-6" />
    <path d="M2 16h.01" />
    <path d="M21.8 16c.2-2 .131-5.354 0-6" />
    <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
    <path d="M8.65 22c.21-.66.45-1.32.57-2" />
    <path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
  </Icon>
);
const IcFile = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M8 13h8" />
    <path d="M8 17h5" />
  </Icon>
);
const IcIdCard = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <circle cx="8" cy="10" r="2" />
    <path d="M5.5 15.5a3 3 0 0 1 5 0" />
    <path d="M15 10h4" />
    <path d="M15 14h4" />
  </Icon>
);
const IcMoney = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M6 12h.01" />
    <path d="M18 12h.01" />
  </Icon>
);
const IcCheck = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
);
const IcClock = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </Icon>
);
const IcCalendar = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4" />
    <path d="M8 2v4" />
    <path d="M3 10h18" />
  </Icon>
);
const IcMedical = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M8 12h8" />
    <path d="M12 8v8" />
  </Icon>
);
const IcShield = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="m9 12 2 2 4-4" />
  </Icon>
);
const IcPlane = (p: IconProps) => (
  <Icon {...p}>
    <path d="m22 2-7 20-4-9-9-4Z" />
    <path d="M22 2 11 13" />
  </Icon>
);
const IcChevron = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);
/* corner arrow (↳) tying VAT lines to their parent line in the receipt */
const IcCornerArrow = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 4v7a4 4 0 0 0 4 4h12" />
    <path d="m15 10 5 5-5 5" />
  </Icon>
);

/* --------------------------- variant-driven data --------------------------- */

type VisaStep = {
  title: string;
  days: string | null;
  icon: (p: IconProps) => React.ReactElement;
  body: string | null;
  note: string | null;
};

/** Builds the visa steps for a variant. Colors alternate blue/orange by index. */
export function buildVisaSteps(cfg: VariantConfig): VisaStep[] {
  const slow = cfg.speed === 14;
  const steps: VisaStep[] = [
    {
      title: "Document Collection",
      days: null,
      icon: IcDoc,
      body: "Your maid's visa process starts once you submit all required documents.",
      note: null,
    },
    {
      title: "Change of Status",
      days: `~ ${slow ? 8 : 3} days`,
      icon: IcRefresh,
      body: null,
      note: null,
    },
    {
      title: "Medical Test",
      days: `~ ${slow ? 3 : 2} days`,
      icon: IcPulse,
      body: null,
      note: null,
    },
  ];
  /* Abu Dhabi + a NEW Emirates ID application → extra Biometric Test step
     between Medical Test and Residency Visa. Renewals follow the Dubai flow. */
  if (cfg.emirate === "abu-dhabi" && cfg.eidType === "new") {
    steps.push({
      title: "Biometric Test",
      days: "~ 2 days",
      icon: IcFingerprint,
      body: null,
      note: null,
    });
  }
  steps.push(
    {
      title: "Residency Visa",
      days: `~ ${slow ? 3 : 2} days`,
      icon: IcFile,
      body: null,
      note: "maids.cc is not liable for the maid until her residency visa is issued.",
    },
    { title: "Emirates ID", days: "~ 10 days", icon: IcIdCard, body: null, note: null },
  );
  return steps;
}

const RIGHTS = [
  {
    icon: IcClock,
    title: "Working hours & rest",
    body: "12 hours of rest each day, including 8 hours in a row. Any extra working hours can be arranged based on mutual agreement with the maid.",
  },
  {
    icon: IcCalendar,
    title: "Paid time off",
    body: "She receives 30 days of paid annual leave per year, scheduled by mutual agreement, at her full salary.",
  },
  {
    icon: IcMedical,
    title: "Sick leave",
    body: "Up to 90 days of sick leave a year; 15 fully paid, 30 at half pay, and 45 unpaid. A medical certificate from an approved health authority is required for any sick leave lasting more than 5 consecutive days.",
  },
  {
    icon: IcShield,
    title: "Medical insurance",
    body: "Medical insurance activates 2 days after her residency visa is issued.",
  },
  {
    icon: IcMoney,
    title: "End-of-service gratuity",
    body: "Once you decide to end your contract, we'll use your last payment to cover your maid's end-of-service gratuity.",
  },
  {
    icon: IcPlane,
    title: "Return flight home",
    body: "If requested, you provide her with a return ticket to her home country when the contract ends.",
  },
];

const SECTIONS = [
  { id: "timeline", label: "Visa Timeline" },
  { id: "payments", label: "Payments & Salary" },
  { id: "rights", label: "Her Rights" },
];

/* -------------------------------- components ------------------------------- */

function StepBadge({
  color,
  n,
  icon: I,
}: {
  color: "blue" | "orange" | "green";
  n?: number;
  icon: (p: IconProps) => React.ReactElement;
}) {
  const bg =
    color === "orange" ? "bg-[#F6891E]" : color === "green" ? "bg-[#15B886]" : "bg-[#4878BC]";
  return (
    <div className="relative z-10 shrink-0">
      <div
        className={`${bg} flex h-12 w-12 items-center justify-center rounded-full text-white shadow-md ring-4 ring-white`}
      >
        <I className="h-5 w-5" />
      </div>
      {n ? (
        <div className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-[#B9CCE6] bg-white text-[11px] font-bold text-[#4878BC]">
          {n}
        </div>
      ) : null}
    </div>
  );
}

/* a timeline: continuous line connecting the bubbles */
function Timeline({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="absolute top-4 bottom-4 left-6 w-0.5 -translate-x-1/2 rounded bg-[#4878BC]/45" />
      <div className="space-y-10">{children}</div>
    </div>
  );
}

function TimelineStep({
  badge,
  children,
}: {
  badge: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex gap-3 sm:gap-4">
      {badge}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/* the mini receipt — rows depend on the package; ↳ ties VAT to its line */
function PaymentBreakdown({ pkg }: { pkg: Pkg }) {
  const { rows, total } = receiptFor(pkg);
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-[#B9CCE6] bg-[#EEF3FB]">
      <div className="divide-y divide-[#B9CCE6]/50 px-3 text-[13px] sm:px-4 sm:text-sm">
        {rows.map((r, i) => (
          <div
            key={i}
            className={`flex items-center justify-between gap-3 py-2.5 ${r.vat ? "pl-4" : ""}`}
          >
            {r.vat ? (
              <span className="flex items-center gap-1.5 text-[#4878BC]">
                <IcCornerArrow className="h-3.5 w-3.5 shrink-0" />
                {r.label}
              </span>
            ) : (
              <span className="font-semibold whitespace-nowrap text-[#111827]">{r.label}</span>
            )}
            <span
              className={`whitespace-nowrap ${
                r.vat
                  ? "text-[#4878BC]"
                  : r.orange
                    ? "font-semibold text-[#F6891E]"
                    : "font-semibold text-[#111827]"
              }`}
            >
              {r.value}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 bg-[#4878BC] px-3 py-3 text-sm font-bold text-white sm:px-4">
        <span>Total you pay us</span>
        <span className="whitespace-nowrap">{total}</span>
      </div>
    </div>
  );
}

/* a "you pay us" card: date is the step title; amount reads on one clean row */
function PayCard({
  pkg,
  note,
  defaultOpen = false,
}: {
  pkg: Pkg;
  note?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { total } = receiptFor(pkg);
  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-3 shadow-sm sm:p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <span className="min-w-0">
          <span className="block text-xs font-semibold tracking-wide text-[#6B7280] uppercase">
            You pay us
          </span>
          <span className="block text-[22px] leading-tight font-extrabold whitespace-nowrap text-[#111827]">
            {total}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#EEF3FB] px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-[#4878BC]">
          Breakdown
          <IcChevron
            className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <PaymentBreakdown pkg={pkg} />
        </div>
      </div>
      {note ? <p className="mt-3 text-sm leading-relaxed text-[#6B7280]">{note}</p> : null}
    </div>
  );
}

function RightCard({
  icon: I,
  title,
  body,
}: {
  icon: (p: IconProps) => React.ReactElement;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#4878BC] text-white">
          <I className="h-5 w-5" />
        </div>
        <h3 className="text-[16px] font-bold text-[#111827]">{title}</h3>
      </div>
      <p className="mt-3 text-[15px] leading-relaxed text-[#374151]">{body}</p>
    </div>
  );
}

/* each big section is its own card so the 3 parts read as separate sections */
function SectionCard({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 rounded-3xl border border-[#B9CCE6]/70 bg-white p-4 shadow-[0_10px_30px_-18px_rgba(72,120,188,0.45)] sm:p-7"
    >
      <h2 className="text-[24px] font-extrabold text-[#4878BC]">{title}</h2>
      {children}
    </section>
  );
}

/* one "you pay us" timeline entry (date title + card) */
function PaymentEntry({
  date,
  covers,
  pkg,
  note,
  defaultOpen = false,
  showCovers,
}: {
  date: string;
  covers: string;
  pkg: Pkg;
  note?: string;
  defaultOpen?: boolean;
  showCovers: boolean;
}) {
  return (
    <TimelineStep badge={<StepBadge color="orange" icon={IcMoney} />}>
      <h3 className="pt-2.5 text-[18px] font-bold text-[#111827]">{date}</h3>
      {showCovers ? (
        <p className="mt-0.5 text-xs font-semibold tracking-wide text-[#6B7280] uppercase">
          {covers}'s payment
        </p>
      ) : null}
      <div className="mt-2">
        <PayCard pkg={pkg} note={note} defaultOpen={defaultOpen} />
      </div>
    </TimelineStep>
  );
}

/* --------------------------------- the page -------------------------------- */

export function MaidVisaGuide({ config }: { config: VariantConfig }) {
  const [active, setActive] = useState("timeline");

  const visaSteps = buildVisaSteps(config);
  const JULY = 6;
  const AUGUST = 7;
  const SEPTEMBER = 8;
  /* credit-card collections happen in the previous month, so show which
     month each payment covers to keep the timeline unambiguous */
  const showCovers = config.payment === "credit-card";

  /* keep the wash color under overscroll */
  useEffect(() => {
    document.documentElement.style.backgroundColor = "#EEF3FB";
    document.body.style.backgroundColor = "#EEF3FB";
  }, []);

  /* No run-once ref guard here: the effect must re-attach whenever it is
     cleaned up and re-run (variant `key` remounts, HMR) — a ref that survives
     that cycle would leave the nav with no observer and no scroll listener. */
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
        }
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    }
    const onScroll = () => {
      const nearBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 24;
      if (nearBottom) setActive("rights");
      /* above the first section nothing intersects the observer band, which
         would leave a stale highlight after scrolling back up */
      const timeline = document.getElementById("timeline");
      if (timeline && timeline.getBoundingClientRect().top > window.innerHeight * 0.4) {
        setActive("timeline");
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      obs.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const go = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-[#EEF3FB] font-sans text-[#111827] antialiased">
      {/* hero — maids.cc logo + title only */}
      <header className="bg-white px-5 pt-8 pb-14 shadow-sm">
        <div className="mx-auto max-w-xl">
          <img
            src="/assets/maids-logo.png"
            alt="maids.cc"
            className="h-10 w-auto"
            width={247}
            height={83}
          />
          <h1 className="mt-4 text-[32px] leading-tight font-extrabold text-[#111827]">
            Your Maid <span className="text-[#4878BC]">Visa Guide</span>
          </h1>
        </div>
      </header>

      {/* sticky nav — the only thing under the title */}
      <nav className="sticky top-0 z-20 -mt-7 px-4">
        <div className="mx-auto flex max-w-xl gap-1 rounded-2xl border border-[#B9CCE6]/70 bg-white p-1.5 shadow-lg">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => go(s.id)}
              className={`flex-auto rounded-xl px-2 py-2.5 text-[12px] font-bold whitespace-nowrap transition-colors duration-200 sm:text-[13px] ${
                active === s.id
                  ? "bg-[#4878BC] text-white shadow"
                  : "text-[#6B7280] hover:bg-[#EEF3FB]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-xl space-y-8 px-3 pt-10 pb-12 sm:px-5">
        {/* ------------------------------ timeline ------------------------------ */}
        <SectionCard id="timeline" title="Visa Timeline">
          <div className="mt-7">
            <Timeline>
              {visaSteps.map((s, i) => (
                <TimelineStep
                  key={s.title}
                  badge={
                    <StepBadge
                      color={i % 2 === 0 ? "blue" : "orange"}
                      n={i + 1}
                      icon={s.icon}
                    />
                  }
                >
                  <div className="pt-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[18px] font-bold text-[#111827]">{s.title}</h3>
                      {s.days ? (
                        <span className="rounded-full bg-[#EEF3FB] px-3 py-1 text-xs font-bold whitespace-nowrap text-[#4878BC]">
                          {s.days}
                        </span>
                      ) : null}
                    </div>
                    {s.body ? (
                      <p className="mt-1.5 text-[15px] leading-relaxed text-[#374151]">
                        {s.body}
                      </p>
                    ) : null}
                    {s.note ? (
                      <p className="mt-1.5 flex items-start gap-1.5 text-sm leading-relaxed font-semibold text-[#0A7C5A]">
                        <IcShield className="mt-0.5 h-4 w-4 shrink-0" />
                        {s.note}
                      </p>
                    ) : null}
                  </div>
                </TimelineStep>
              ))}
            </Timeline>
          </div>
        </SectionCard>

        {/* ------------------------------ payments ------------------------------ */}
        <SectionCard id="payments" title="Payments & Salary">
          <div className="mt-7">
            <Timeline>
              {/* July's payment */}
              <PaymentEntry
                date={collectionDate(config.payment, JULY)}
                covers="July"
                pkg={config.pkg}
                defaultOpen
                showCovers={showCovers}
                note="If you'd like to pay your maid for June, please do so directly to her."
              />

              {/* August's payment */}
              <PaymentEntry
                date={collectionDate(config.payment, AUGUST)}
                covers="August"
                pkg={config.pkg}
                showCovers={showCovers}
              />

              {/* by the 3rd of August — salary + ATM card note */}
              <TimelineStep badge={<StepBadge color="green" icon={IcCheck} />}>
                <h3 className="pt-1 text-[18px] font-bold text-[#111827]">
                  By the 3rd of August
                </h3>
                <p className="mt-0.5 text-[17px] font-bold text-[#111827]">
                  We pay her <span className="text-[#15B886]">AED 1,000</span>
                </p>
                <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-[#EEF3FB] px-3 py-2.5 text-sm leading-relaxed font-semibold text-[#4878BC]">
                  <IcIdCard className="mt-0.5 h-4 w-4 shrink-0" />
                  Before the 3rd of August, we'll send you the details to pick up her ATM
                  card.
                </p>
              </TimelineStep>

              {/* September's payment */}
              <PaymentEntry
                date={collectionDate(config.payment, SEPTEMBER)}
                covers="September"
                pkg={config.pkg}
                showCovers={showCovers}
              />

              {/* by the 3rd of September */}
              <TimelineStep badge={<StepBadge color="green" icon={IcCheck} />}>
                <h3 className="pt-1 text-[18px] font-bold text-[#111827]">
                  By the 3rd of September
                </h3>
                <p className="mt-0.5 text-[17px] font-bold text-[#111827]">
                  We pay her <span className="text-[#15B886]">AED 1,000</span>
                </p>
              </TimelineStep>
            </Timeline>

            {/* three dots — the long stretch until the contract ends,
                centered on the bubble axis and in the gap between the two bubbles */}
            <div className="flex w-12 items-center justify-center pt-2 pb-5">
              <div className="flex flex-col items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#4878BC]/50" />
                <span className="h-2 w-2 rounded-full bg-[#4878BC]/50" />
                <span className="h-2 w-2 rounded-full bg-[#4878BC]/50" />
              </div>
            </div>

            {/* end of contract */}
            <div className="flex gap-3 sm:gap-4">
              <StepBadge color="green" icon={IcCheck} />
              <div className="min-w-0 flex-1 pt-1">
                <h3 className="text-[18px] font-bold text-[#111827]">End of contract</h3>
                <p className="mt-1 text-[15px] leading-relaxed text-[#374151]">
                  Please pay your maid's last salary directly to her.
                </p>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* ------------------------------- rights ------------------------------- */}
        {/* Her Rights is identical in every variant */}
        <SectionCard id="rights" title="Her Rights">
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {RIGHTS.map((r) => (
              <RightCard key={r.title} icon={r.icon} title={r.title} body={r.body} />
            ))}
          </div>
        </SectionCard>
      </main>
    </div>
  );
}
