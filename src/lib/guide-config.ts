import { z } from "zod";

/* ═══════════════════════════════════════════════════════════════════════════
   GUIDE CONFIG — single source of truth (client-safe, pure)
   ─────────────────────────────────────────────────────────────────────────
   Shared by the API (validate + persist), the /debug generator, and the
   <MaidVisaGuide> React component. No server-only imports here so it bundles
   into the client too.

   Three shapes flow through the app:
     • GuideInput  — the raw API request body (UPPER_SNAKE keys, as sent by the
                     maids.cc system). Validated by GuideInputSchema.
     • GuideData   — the normalized, stored shape (one row in `guides`).
     • VariantConfig — the component's render config (internal enum spellings)
                     plus the client's salary + contract start date.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ------------------------------- API enums -------------------------------- */

export type ApiEmirate = "dubai" | "abu_dhabi";
export type ApiPackage = "8.5" | "10.96";
export type ApiPayment = "CC" | "DD";
export type ApiSpeed = 7 | 14;
export type ApiEid = "NEW" | "RENEW";

/* Tolerant coercions: the caller may send numbers or strings ("8.5" vs 8.5,
   7 vs "7"). Normalize before enum-checking so a stringly-typed body still
   validates. */
const zEmirate = z.enum(["dubai", "abu_dhabi"]);
const zPackage = z.preprocess((v) => String(v), z.enum(["8.5", "10.96"]));
const zPayment = z.preprocess((v) => String(v).toUpperCase(), z.enum(["CC", "DD"]));
const zSpeed = z.preprocess((v) => Number(v), z.union([z.literal(7), z.literal(14)]));
const zEid = z.preprocess(
  (v) => (v == null ? v : String(v).toUpperCase()),
  z.enum(["NEW", "RENEW"]),
);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const GuideInputSchema = z
  .object({
    CLIENT_ID: z.union([z.string(), z.number()]).transform((v) => String(v).trim()),
    contract_start_date: z
      .string()
      .regex(DATE_RE, "expected yyyy-mm-dd")
      .refine(isRealDate, "not a real calendar date"),
    salary: z.preprocess((v) => Number(v), z.number().positive("salary must be > 0")),
    EMIRATE: zEmirate,
    PACKAGE: zPackage,
    PAYMENT_METHOD: zPayment,
    Visa_timeline: zSpeed,
    EID_APPLICATION_TYPE: zEid.optional(),
  })
  .refine((d) => d.EMIRATE !== "abu_dhabi" || d.EID_APPLICATION_TYPE != null, {
    message: "EID_APPLICATION_TYPE is required when EMIRATE is abu_dhabi",
    path: ["EID_APPLICATION_TYPE"],
  });

export type GuideInput = z.infer<typeof GuideInputSchema>;

/* ------------------------------ stored shape ------------------------------ */

export type GuideData = {
  emirate: ApiEmirate;
  package: ApiPackage;
  paymentMethod: ApiPayment;
  visaTimeline: ApiSpeed;
  /** null for Dubai (not applicable). */
  eidApplicationType: ApiEid | null;
  salary: number;
  contractStartDate: string; // yyyy-mm-dd
};

/** Normalize a validated API body into the stored/renderable shape. */
export function guideDataFromInput(input: GuideInput): GuideData {
  return {
    emirate: input.EMIRATE,
    package: input.PACKAGE,
    paymentMethod: input.PAYMENT_METHOD,
    visaTimeline: input.Visa_timeline,
    eidApplicationType: input.EMIRATE === "abu_dhabi" ? (input.EID_APPLICATION_TYPE ?? null) : null,
    salary: Math.round(input.salary),
    contractStartDate: input.contract_start_date,
  };
}

/* --------------------------- component render config --------------------------- */

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
  salary: number;
  contractStartDate: string; // yyyy-mm-dd
};

export function toVariantConfig(g: GuideData): VariantConfig {
  return {
    emirate: g.emirate === "abu_dhabi" ? "abu-dhabi" : "dubai",
    pkg: g.package === "10.96" ? "10.96k" : "8.5k",
    payment: g.paymentMethod === "CC" ? "credit-card" : "direct-debit",
    speed: g.visaTimeline,
    eidType: g.eidApplicationType === "RENEW" ? "renew" : "new",
    salary: g.salary,
    contractStartDate: g.contractStartDate,
  };
}

/** Sensible default used by /debug's initial state. Dubai · 8.5k · DD · 7 · June start. */
export const DEFAULT_VARIANT: VariantConfig = {
  emirate: "dubai",
  pkg: "8.5k",
  payment: "direct-debit",
  speed: 7,
  eidType: "new",
  salary: 1000,
  contractStartDate: "2026-06-01",
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

/* ------------------------------ receipt maths ------------------------------ */

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

export function aed(n: number): string {
  return `AED ${Math.round(n).toLocaleString("en-US")}`;
}

export type ReceiptRow = { label: string; value: string; orange?: boolean; vat?: boolean };

/**
 * The mini receipt. VAT is 5% on the salary and (when present) on the AED 160
 * monthly payment fee. The fee + its VAT appear ONLY for the 8.5k package;
 * the 10.96k package folds the fee into the salary, so no fee rows.
 */
export function receiptFor(salary: number, pkg: Pkg): {
  rows: ReceiptRow[];
  total: string;
  totalNumber: number;
} {
  const salaryVat = Math.round(salary * 0.05);
  const fee = pkg === "8.5k" ? 160 : 0;
  const feeVat = Math.round(fee * 0.05);
  const rows: ReceiptRow[] = [
    { label: "Maid's salary", value: aed(salary) },
    { label: "VAT (5%)", value: aed(salaryVat), vat: true },
  ];
  if (fee > 0) {
    rows.push(
      { label: "Monthly payment fee", value: aed(fee), orange: true },
      { label: "VAT (5%)", value: aed(feeVat), vat: true },
    );
  }
  const totalNumber = salary + salaryVat + fee + feeVat;
  return { rows, total: aed(totalNumber), totalNumber };
}

/* ------------------------- payment-date computation ------------------------ */

function isRealDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function daysInMonth(monthIndex: number, year: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

type YM = { year: number; monthIndex: number };

function addMonths(base: YM, delta: number): YM {
  const total = base.monthIndex + delta;
  const year = base.year + Math.floor(total / 12);
  const monthIndex = ((total % 12) + 12) % 12;
  return { year, monthIndex };
}

/**
 * Collection date for the payment covering month `ym`.
 * direct-debit → the 1st of the covered month.
 * credit-card  → PED: (last day of the PREVIOUS month − 4), computed per month
 *                so it adapts to 30/31-day months and year boundaries.
 */
function collectionDate(payment: Payment, ym: YM): string {
  if (payment === "direct-debit") return `1st of ${MONTHS[ym.monthIndex]}`;
  const prev = addMonths(ym, -1);
  const day = daysInMonth(prev.monthIndex, prev.year) - 4;
  return `${ordinal(day)} of ${MONTHS[prev.monthIndex]}`;
}

export type PaymentSchedule = {
  /** Contract start month name (e.g. "June") — used in the pay-directly note. */
  startMonthName: string;
  /** The three "you pay us" entries, covering start+1, +2, +3. */
  entries: { coversName: string; collect: string }[];
  /** The two "by the 3rd of …" salary blocks (covered months +2 and +3). */
  payHerMonths: string[];
};

/**
 * Builds the illustrative 3-month payment window relative to the contract
 * start month. Contract starts month M0; the client's first full billing
 * month is M0+1. The window covers M0+1..M0+3 and shifts with the start date
 * (June start → Jul/Aug/Sep; July start → Aug/Sep/Oct), with year rollover.
 */
export function paymentSchedule(contractStartDate: string, payment: Payment): PaymentSchedule {
  const [y, m] = contractStartDate.split("-").map(Number);
  const m0: YM = { year: y, monthIndex: m - 1 };
  const m1 = addMonths(m0, 1);
  const m2 = addMonths(m0, 2);
  const m3 = addMonths(m0, 3);
  return {
    startMonthName: MONTHS[m0.monthIndex],
    entries: [
      { coversName: MONTHS[m1.monthIndex], collect: collectionDate(payment, m1) },
      { coversName: MONTHS[m2.monthIndex], collect: collectionDate(payment, m2) },
      { coversName: MONTHS[m3.monthIndex], collect: collectionDate(payment, m3) },
    ],
    payHerMonths: [MONTHS[m2.monthIndex], MONTHS[m3.monthIndex]],
  };
}
