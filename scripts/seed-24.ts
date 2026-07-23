#!/usr/bin/env bun
/*
 * Generate all 24 filter combinations for one client and print the /Views links.
 * Each API call mints a fresh token, so run this against whatever server you
 * want the links to live on (they are tied to that server's database).
 *
 * Usage:
 *   API_TOKEN=your-token BASE=https://maidscc.app bun run scripts/seed-24.ts
 *
 * Optional env: CLIENT_ID (default 12345), SALARY (1000), CONTRACT_START (2026-06-01)
 */
import process from "node:process";

const BASE = (process.env.BASE || "http://localhost:3000").replace(/\/+$/, "");
const TOKEN = process.env.API_TOKEN;
if (!TOKEN) {
  console.error("Set API_TOKEN (and optionally BASE). See script header.");
  process.exit(1);
}
const CLIENT_ID = process.env.CLIENT_ID || "12345";
const SALARY = Number(process.env.SALARY || 1000);
const CONTRACT_START = process.env.CONTRACT_START || "2026-06-01";

const emirates = ["dubai", "abu_dhabi"] as const;
const packages = ["8.5", "10.96"] as const;
const payments = ["DD", "CC"] as const;
const timelines = [7, 14] as const;
const eids = ["NEW", "RENEW"] as const;

let n = 0;
for (const EMIRATE of emirates) {
  for (const PACKAGE of packages) {
    for (const PAYMENT_METHOD of payments) {
      for (const Visa_timeline of timelines) {
        const eidList = EMIRATE === "abu_dhabi" ? eids : [null];
        for (const EID_APPLICATION_TYPE of eidList) {
          const body: Record<string, unknown> = {
            CLIENT_ID,
            contract_start_date: CONTRACT_START,
            salary: SALARY,
            EMIRATE,
            PACKAGE,
            PAYMENT_METHOD,
            Visa_timeline,
          };
          if (EID_APPLICATION_TYPE) body.EID_APPLICATION_TYPE = EID_APPLICATION_TYPE;

          const res = await fetch(`${BASE}/api/guides`, {
            method: "POST",
            headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
            body: JSON.stringify(body),
          });
          const data = (await res.json()) as { ok: boolean; url?: string; step?: string; message?: string };
          n += 1;
          const label = [EMIRATE, `${PACKAGE}k`, PAYMENT_METHOD, `${Visa_timeline}d`, EID_APPLICATION_TYPE ?? ""]
            .filter(Boolean)
            .join(" · ");
          console.log(data.ok ? `${String(n).padStart(2)}. ${label}\n    ${data.url}` : `${n}. ${label}\n    FAILED (${data.step}): ${data.message}`);
        }
      }
    }
  }
}
