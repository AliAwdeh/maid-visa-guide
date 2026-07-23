# Maid Visa Guide — API reference

Base URL: `https://maidscc.app` (prod) · `http://localhost:5173` (dev) · `http://localhost:3000` (built Bun server).

All responses are JSON with `Cache-Control: no-store`.

## Authentication

A single shared bearer token gates the write/admin endpoints. Send it as:

```
Authorization: Bearer <API_TOKEN>
```

`API_TOKEN` is read from the server's `.env`. Server-to-server calls (no `Origin`
header — e.g. curl, your backend) are always allowed once the token is valid.
Browser calls are additionally restricted to the origins in `ALLOWED_ORIGINS`
(defaults to `https://maidscc.app,http://localhost:5173,http://localhost:3000`).

| Endpoint | Auth |
| --- | --- |
| `POST /api/guides` | Bearer |
| `GET /api/guides` | Bearer |
| `GET /api/admin` | Bearer |
| `POST /api/visits` | none (open beacon) |

---

## POST /api/guides

Create a guide for a client and get back its shareable link. Each call creates a
**new** guide + token (history is preserved). The real `CLIENT_ID` is stored but
never appears in the URL or in any client-facing response.

### Request body

| Field | Type | Required | Values / rules |
| --- | --- | --- | --- |
| `CLIENT_ID` | string \| number | yes | Your internal client identifier. Stored, never exposed. |
| `contract_start_date` | string | yes | `yyyy-mm-dd`, must be a real calendar date. Drives the payment-window months. |
| `salary` | number | yes | Monthly salary in AED, > 0. Accepts a numeric string. |
| `EMIRATE` | string | yes | `dubai` \| `abu_dhabi` |
| `PACKAGE` | string \| number | yes | `8.5` (has AED 160 monthly fee + VAT) \| `10.96` (no fee) |
| `PAYMENT_METHOD` | string | yes | `DD` (direct debit, collected on the 1st) \| `CC` (credit card, collected at PED = last day of previous month − 4) |
| `Visa_timeline` | number | yes | `7` \| `14` (14 → CoS ~8, Medical ~3, Residency ~3 days) |
| `EID_APPLICATION_TYPE` | string | conditional | `NEW` \| `RENEW`. **Required when `EMIRATE` is `abu_dhabi`**; ignored for Dubai. `NEW` inserts a Biometric Test step. |

Enum values are case-insensitive for `PAYMENT_METHOD`/`EID_APPLICATION_TYPE`, and
numbers may be sent as strings.

### Success — `200`

```json
{
  "ok": true,
  "token": "RdPWeelerOgbtEikcaKGAg",
  "url": "https://maidscc.app/Views/RdPWeelerOgbtEikcaKGAg"
}
```

`url` uses `PUBLIC_APP_HOST` from `.env`, falling back to the request origin.

### Errors — step-labelled

Every failure names the step that failed so you can pinpoint it:

| Step | Status | When |
| --- | --- | --- |
| `auth` | 401 | Missing/invalid bearer token, or server has no `API_TOKEN`. |
| `origin` | 403 | Browser request from an origin not in `ALLOWED_ORIGINS`. |
| `parse` | 400 | Body is not valid JSON. |
| `validate` | 422 | A field is missing/invalid (includes a Zod `issues` array). |
| `compute` | 500 | Internal error deriving the guide. |
| `persist` | 500 | Database write failed. |

```json
{
  "ok": false,
  "step": "validate",
  "message": "one or more fields are invalid",
  "issues": [
    { "code": "custom", "path": ["EID_APPLICATION_TYPE"],
      "message": "EID_APPLICATION_TYPE is required when EMIRATE is abu_dhabi" }
  ]
}
```

### Example

```bash
curl -X POST https://maidscc.app/api/guides \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "CLIENT_ID": 1002,
    "contract_start_date": "2026-07-15",
    "salary": 1500,
    "EMIRATE": "abu_dhabi",
    "PACKAGE": "10.96",
    "PAYMENT_METHOD": "CC",
    "Visa_timeline": 14,
    "EID_APPLICATION_TYPE": "NEW"
  }'
```

---

## GET /api/guides

Fetch a stored guide's render data by token (used by the `/debug` preview).
Never returns `client_id`.

Query params: `token` (required).

- `200` → `{ "ok": true, "data": GuideData }`
- `404` → `{ "ok": false, "message": "not found" }`
- `422` → `{ "ok": false, "step": "validate", "message": "missing ?token" }`
- `401` → auth failure

`GuideData`:

```json
{
  "emirate": "abu_dhabi",
  "package": "10.96",
  "paymentMethod": "CC",
  "visaTimeline": 14,
  "eidApplicationType": "NEW",
  "salary": 1500,
  "contractStartDate": "2026-07-15"
}
```

```bash
curl "https://maidscc.app/api/guides?token=RdPWeelerOgbtEikcaKGAg" \
  -H "Authorization: Bearer $API_TOKEN"
```

---

## GET /api/admin

Full analytics feed backing the `/admin/admin` dashboard.

- `200` → `{ "ok": true, "guides": GuideListRow[], "visits": VisitListRow[] }`
- `401` → auth failure

`GuideListRow`:

| Field | Notes |
| --- | --- |
| `token` | public /Views token |
| `clientId` | internal client id (admin-only) |
| `contractStartDate`, `salary`, `emirate`, `package`, `paymentMethod`, `visaTimeline`, `eidApplicationType` | the stored terms |
| `createdAt` | ISO 8601 UTC |
| `createdAtDubai` | Dubai wall-clock (`dd/mm/yyyy, HH:MM:SS`) |
| `visitCount` | number of visit sessions |
| `lastVisitDubai` | Dubai time of the most recent visit, or `null` |

`VisitListRow`:

| Field | Notes |
| --- | --- |
| `id`, `sessionId` | visit + session identifiers |
| `guideToken` | which guide was viewed (`null` if unknown) |
| `path` | page path, e.g. `/Views/<token>` |
| `ip` | from `CF-Connecting-IP` / `X-Forwarded-For` (null on localhost) |
| `device`, `os`, `browser` | parsed server-side from User-Agent |
| `userAgent`, `referrer`, `language`, `screen`, `timezone` | raw client context |
| `startedAtDubai`, `lastSeenDubai` | Dubai timestamps |
| `dwellMs` | time on page (ms) |
| `maxScrollPct` | furthest scroll depth (0–100) |
| `sectionsViewed` | array of section ids seen (`timeline`, `payments`, `rights`) |

```bash
curl https://maidscc.app/api/admin -H "Authorization: Bearer $API_TOKEN"
```

---

## POST /api/visits

Analytics beacon. **Open (no bearer)** — guide viewers are clients who don't hold
the token. Normally called automatically by the built-in client beacon on
`/Views` pages (initial hit, ~10s heartbeats, and a final `sendBeacon` on unload).
Documented here for completeness; you don't call this yourself. Rows are upserted
by `sessionId`. IP, User-Agent, device/OS/browser and Dubai time are derived
server-side and never trusted from the body.

### Request body

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `sessionId` | string | yes | Per-page-load id (client-generated UUID). |
| `guideToken` | string \| null | no | The /Views token being viewed. |
| `path` | string | no | Page path. |
| `referrer`, `language`, `screen`, `timezone` | string | no | Browser context. |
| `dwellMs` | number | no | Clamped 0…86,400,000. |
| `maxScrollPct` | number | no | Clamped 0…100. |
| `sectionsViewed` | string[] | no | Up to 20 section ids. |

- `200` → `{ "ok": true }`
- `400` → `{ "ok": false, "error": "missing sessionId" }` (or invalid JSON)
- `500` → `{ "ok": false, "error": "..." }`

---

## Page routes (not API)

| Path | Auth | Purpose |
| --- | --- | --- |
| `/` | public | maids.cc-branded landing. |
| `/Views/:token` | public | The client-facing guide (SSR). Unknown tokens → 404. |
| `/debug` | token gate | Internal generator: fill in terms, preview live, generate a link. |
| `/admin/admin` | token gate | Visitor analytics dashboard. |

`/debug` and `/admin/admin` prompt for the `API_TOKEN` in-page (kept in
`sessionStorage`) and send it as the bearer on their API calls.
