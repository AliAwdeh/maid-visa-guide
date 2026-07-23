# Maid Visa Guide

Per-client onboarding guide for maids.cc. A backend system POSTs a client's contract
terms to an authenticated API; the app stores them and returns an unguessable
`https://maidscc.app/Views/<token>` link (the real `CLIENT_ID` never appears in the URL).
The guide renders that client's actual salary, VAT, totals, payment dates, visa timeline
and rights. Self-hosted under Bun and exposed via cloudflared.

- `/` — public maids.cc landing
- `/Views/<token>` — the client-facing guide
- `/debug` — token-gated generator + live preview
- `/admin/admin` — token-gated visitor analytics
- Full API reference: [docs/API.md](docs/API.md) · Postman collection: [docs/maid-visa-guide.postman_collection.json](docs/maid-visa-guide.postman_collection.json)

## Run

```bash
bun install
cp .env.example .env      # set a strong API_TOKEN
bun run dev               # local dev at http://localhost:5173
# production:
bun run build && bun run start   # Bun server on $PORT (default 3000)
```

`.env` (auto-loaded by Bun): `API_TOKEN`, `PUBLIC_APP_HOST` (`https://maidscc.app`),
`ALLOWED_ORIGINS`, `DB_PATH` (`./data/app.db`), `PORT`. Point cloudflared at the port.

---

## Using the API

Create a guide with a single authenticated `POST`. The response contains the shareable link.

```bash
curl -X POST https://maidscc.app/api/guides \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "CLIENT_ID": 12345,
    "contract_start_date": "2026-06-01",
    "salary": 1000,
    "EMIRATE": "dubai",
    "PACKAGE": "8.5",
    "PAYMENT_METHOD": "DD",
    "Visa_timeline": 7
  }'
```

Response:

```json
{ "ok": true, "token": "xPEiU5ouKFape7KcpITgMg",
  "url": "https://maidscc.app/Views/xPEiU5ouKFape7KcpITgMg" }
```

### Fields

| Field | Required | Values |
| --- | --- | --- |
| `CLIENT_ID` | yes | your internal id (number or string); stored, never shown in the URL |
| `contract_start_date` | yes | `yyyy-mm-dd`; drives the payment-window months |
| `salary` | yes | monthly salary in AED (> 0); VAT and totals are computed from it |
| `EMIRATE` | yes | `dubai` \| `abu_dhabi` |
| `PACKAGE` | yes | `8.5` (adds AED 160 monthly fee + VAT) \| `10.96` (no fee) |
| `PAYMENT_METHOD` | yes | `DD` (collected on the 1st) \| `CC` (collected at PED = last day of previous month − 4) |
| `Visa_timeline` | yes | `7` \| `14` |
| `EID_APPLICATION_TYPE` | Abu Dhabi only | `NEW` \| `RENEW` — see below |

On failure the response tells you the exact step that failed — `auth` (401), `origin`
(403), `parse` (400), `validate` (422, with a Zod `issues` array), `compute`/`persist`
(500) — e.g. `{ "ok": false, "step": "validate", "message": "...", "issues": [...] }`.

Send the token as `Authorization: Bearer <API_TOKEN>` (value from `.env`). Server-to-server
callers (no `Origin` header) always pass; browser callers must be in `ALLOWED_ORIGINS`.

### `EID_APPLICATION_TYPE` — Abu Dhabi only

This field applies **only when `EMIRATE` is `abu_dhabi`**, where it is **required**. For
Dubai it is ignored — omit it.

- **`NEW`** — first-time Emirates ID. Inserts an extra **Biometric Test (~2 days)** step
  between the Medical Test and the Residency Visa (6 visa steps total).
- **`RENEW`** — renewing an existing Emirates ID. No biometric step; the visa timeline is
  identical to Dubai (5 steps).

Dubai always has 5 steps and no biometric regardless of anything else.

---

## The 24 combinations

Every deployable version = `EMIRATE × PACKAGE × PAYMENT_METHOD × Visa_timeline`, plus
`EID_APPLICATION_TYPE` for Abu Dhabi. Dubai: 2×2×2 = **8**. Abu Dhabi: 2×2×2×2 = **16**.
**Total: 24.** (Her Rights is identical in every version.)

The examples below are all for the **same client** with fixed inputs, so only the four
filters differ:

```
CLIENT_ID = 12345 · salary = AED 1,000 · contract_start_date = 2026-06-01 (June)
```

**What each filter changes** (for the inputs above):

- **Total you pay us** — `8.5` → **AED 1,218** (1,000 salary + 50 VAT + 160 fee + 8 fee VAT); `10.96` → **AED 1,050** (1,000 + 50 VAT, no fee).
- **Salary paid to the maid** — **AED 1,000**, by the 3rd of August and the 3rd of September, then every month.
- **Collection dates** — `DD` → **1 Jul · 1 Aug · 1 Sep**; `CC` → **26 Jun · 27 Jul · 27 Aug** (PED, adapts to month length). Either way the guide notes: *"pay your maid for June directly."*
- **Visa timeline** — `7` → Change of Status ~3d, Medical ~2d, Residency ~2d, Emirates ID ~10d; `14` → CoS ~8d, Medical ~3d, Residency ~3d, Emirates ID ~10d.
- **Biometric step** — added only for Abu Dhabi + `NEW`.

> **Note on the links:** the links below are **live on `maidscc.app`** (generated
> 2026-07-23 for client 12345). Each API call mints a fresh token bound to the server's
> database, so if you rotate the key or redeploy with a fresh database, regenerate them
> with `API_TOKEN=… BASE=https://maidscc.app bun run scripts/seed-24.ts`.

### Dubai (8)

| # | Package | Payment | Visa timeline | You pay | 1st collection | Guide |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 8.5 | DD | 7 days | AED 1,218 | 1 Jul | https://maidscc.app/Views/xPEiU5ouKFape7KcpITgMg |
| 2 | 8.5 | DD | 14 days | AED 1,218 | 1 Jul | https://maidscc.app/Views/nw78T-I1FVWFjaK_re01ig |
| 3 | 8.5 | CC | 7 days | AED 1,218 | 26 Jun | https://maidscc.app/Views/FYVokasnJTfCiJyMLSrdpA |
| 4 | 8.5 | CC | 14 days | AED 1,218 | 26 Jun | https://maidscc.app/Views/K2I9LNGAERbpUmd9sRlG3Q |
| 5 | 10.96 | DD | 7 days | AED 1,050 | 1 Jul | https://maidscc.app/Views/DDstWYUWoIjeptLEoRKoNg |
| 6 | 10.96 | DD | 14 days | AED 1,050 | 1 Jul | https://maidscc.app/Views/LdoliG5T0H1Axe9LSeENFQ |
| 7 | 10.96 | CC | 7 days | AED 1,050 | 26 Jun | https://maidscc.app/Views/aShyr6pSE5bffsO9nGVZ2w |
| 8 | 10.96 | CC | 14 days | AED 1,050 | 26 Jun | https://maidscc.app/Views/QBKBKp23sypT4aTCCry9bg |

### Abu Dhabi (16)

`NEW` adds the Biometric Test step; `RENEW` matches the Dubai timeline.

| # | Package | Payment | Visa timeline | EID | You pay | 1st collection | Guide |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 9 | 8.5 | DD | 7 days | NEW | AED 1,218 | 1 Jul | https://maidscc.app/Views/iDzn2QD2N6Q60fDsMsIYYA |
| 10 | 8.5 | DD | 7 days | RENEW | AED 1,218 | 1 Jul | https://maidscc.app/Views/Ov9KeK46MgCMOGB_mjwKQA |
| 11 | 8.5 | DD | 14 days | NEW | AED 1,218 | 1 Jul | https://maidscc.app/Views/ep5tsne1GPsadW6swaKloQ |
| 12 | 8.5 | DD | 14 days | RENEW | AED 1,218 | 1 Jul | https://maidscc.app/Views/Md8fE9Y-500ZOmszm_ei9w |
| 13 | 8.5 | CC | 7 days | NEW | AED 1,218 | 26 Jun | https://maidscc.app/Views/qHrlZ7BITSezMC9vZSxTlw |
| 14 | 8.5 | CC | 7 days | RENEW | AED 1,218 | 26 Jun | https://maidscc.app/Views/Mg07aVTUE-0Ce-f4QrUc7g |
| 15 | 8.5 | CC | 14 days | NEW | AED 1,218 | 26 Jun | https://maidscc.app/Views/SVrADTa8EczCtZiGpCwy7w |
| 16 | 8.5 | CC | 14 days | RENEW | AED 1,218 | 26 Jun | https://maidscc.app/Views/r-fQVIOCrECVQ6azeoEFjA |
| 17 | 10.96 | DD | 7 days | NEW | AED 1,050 | 1 Jul | https://maidscc.app/Views/FWAkgV4wuc1fTgsuu7IgzA |
| 18 | 10.96 | DD | 7 days | RENEW | AED 1,050 | 1 Jul | https://maidscc.app/Views/VW5x3q0ZRUBk1ciuc7dung |
| 19 | 10.96 | DD | 14 days | NEW | AED 1,050 | 1 Jul | https://maidscc.app/Views/PgH-8os2DF2GbKCrYYBiLg |
| 20 | 10.96 | DD | 14 days | RENEW | AED 1,050 | 1 Jul | https://maidscc.app/Views/At0dLYvgWN9d90XE6g55nw |
| 21 | 10.96 | CC | 7 days | NEW | AED 1,050 | 26 Jun | https://maidscc.app/Views/6kTHA7GKoZwoXmvxk0vmJg |
| 22 | 10.96 | CC | 7 days | RENEW | AED 1,050 | 26 Jun | https://maidscc.app/Views/NTYdHGM4NSkICC2N_ay9KQ |
| 23 | 10.96 | CC | 14 days | NEW | AED 1,050 | 26 Jun | https://maidscc.app/Views/vnngvcoCat1F9YH_XhToDg |
| 24 | 10.96 | CC | 14 days | RENEW | AED 1,050 | 26 Jun | https://maidscc.app/Views/ezEgNLuFfc_dqiK0WWn_4g |

Regenerate all 24 for any client/date/salary on any server:

```bash
API_TOKEN=your-token BASE=https://maidscc.app \
  CLIENT_ID=12345 SALARY=1000 CONTRACT_START=2026-06-01 \
  bun run scripts/seed-24.ts
```
