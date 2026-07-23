import process from "node:process";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import type { ApiEid, ApiEmirate, ApiPackage, ApiPayment, ApiSpeed, GuideData } from "./guide-config";

/* ═══════════════════════════════════════════════════════════════════════════
   DB (server-only) — local SQLite, cross-runtime.
   ─────────────────────────────────────────────────────────────────────────
   Production serves the built bundle under Bun → bun:sqlite. The Vite dev
   server SSRs under Node → node:sqlite (Node ≥ 22.5). Neither builtin loads in
   the other runtime, so we pick at runtime behind a tiny adapter and speak
   positional `?` parameters (supported by both). Both are external in the Vite
   build (vite.config.ts). `.server.ts` keeps this out of the client bundle.
   ═══════════════════════════════════════════════════════════════════════════ */

type SqlValue = string | number | null;

interface Db {
  run(sql: string, ...params: SqlValue[]): void;
  get<T>(sql: string, ...params: SqlValue[]): T | null;
  all<T>(sql: string, ...params: SqlValue[]): T[];
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS guides (
    token TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    contract_start_date TEXT NOT NULL,
    salary INTEGER NOT NULL,
    emirate TEXT NOT NULL,
    package TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    visa_timeline INTEGER NOT NULL,
    eid_application_type TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_guides_client ON guides(client_id)`,
  `CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guide_token TEXT,
    session_id TEXT NOT NULL,
    path TEXT,
    ip TEXT,
    user_agent TEXT,
    device TEXT,
    os TEXT,
    browser TEXT,
    referrer TEXT,
    language TEXT,
    screen TEXT,
    timezone TEXT,
    started_at_utc TEXT NOT NULL,
    started_at_dubai TEXT NOT NULL,
    last_seen_utc TEXT NOT NULL,
    dwell_ms INTEGER NOT NULL DEFAULT 0,
    max_scroll_pct INTEGER NOT NULL DEFAULT 0,
    sections_viewed TEXT,
    events TEXT
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_visits_session ON visits(session_id)`,
  `CREATE INDEX IF NOT EXISTS idx_visits_guide ON visits(guide_token)`,
];

async function openBun(path: string): Promise<Db> {
  const { Database } = await import("bun:sqlite");
  const db = new Database(path, { create: true });
  db.run("PRAGMA journal_mode = WAL;");
  return {
    run: (sql, ...p) => {
      db.query(sql).run(...(p as never[]));
    },
    get: (sql, ...p) => (db.query(sql).get(...(p as never[])) as never) ?? null,
    all: (sql, ...p) => db.query(sql).all(...(p as never[])) as never,
  };
}

async function openNode(path: string): Promise<Db> {
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL;");
  return {
    run: (sql, ...p) => {
      db.prepare(sql).run(...(p as never[]));
    },
    get: (sql, ...p) => (db.prepare(sql).get(...(p as never[])) as never) ?? null,
    all: (sql, ...p) => db.prepare(sql).all(...(p as never[])) as never,
  };
}

let _dbPromise: Promise<Db> | null = null;

function getDb(): Promise<Db> {
  if (_dbPromise) return _dbPromise;
  _dbPromise = (async () => {
    const path = process.env.DB_PATH || "./data/app.db";
    mkdirSync(dirname(path), { recursive: true });
    const isBun = typeof (globalThis as { Bun?: unknown }).Bun !== "undefined";
    const db = isBun ? await openBun(path) : await openNode(path);
    for (const stmt of SCHEMA) db.run(stmt);
    return db;
  })();
  return _dbPromise;
}

/* -------------------------------- guides --------------------------------- */

export type GuideRow = GuideData & {
  token: string;
  clientId: string;
  createdAt: string;
};

type RawGuide = {
  token: string;
  client_id: string;
  contract_start_date: string;
  salary: number;
  emirate: string;
  package: string;
  payment_method: string;
  visa_timeline: number;
  eid_application_type: string | null;
  created_at: string;
};

function mapGuide(r: RawGuide): GuideRow {
  return {
    token: r.token,
    clientId: r.client_id,
    contractStartDate: r.contract_start_date,
    salary: r.salary,
    emirate: r.emirate as ApiEmirate,
    package: r.package as ApiPackage,
    paymentMethod: r.payment_method as ApiPayment,
    visaTimeline: r.visa_timeline as ApiSpeed,
    eidApplicationType: (r.eid_application_type as ApiEid | null) ?? null,
    createdAt: r.created_at,
  };
}

export async function insertGuide(
  token: string,
  clientId: string,
  data: GuideData,
): Promise<GuideRow> {
  const createdAt = new Date().toISOString();
  const db = await getDb();
  db.run(
    `INSERT INTO guides
       (token, client_id, contract_start_date, salary, emirate, package,
        payment_method, visa_timeline, eid_application_type, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    token,
    clientId,
    data.contractStartDate,
    data.salary,
    data.emirate,
    data.package,
    data.paymentMethod,
    data.visaTimeline,
    data.eidApplicationType,
    createdAt,
  );
  return { token, clientId, createdAt, ...data };
}

/** Public render data for /Views — never exposes client_id to the caller. */
export async function getGuideData(token: string): Promise<GuideData | null> {
  const db = await getDb();
  const row = db.get<RawGuide>("SELECT * FROM guides WHERE token = ?", token);
  if (!row) return null;
  const { token: _t, clientId: _c, createdAt: _cr, ...data } = mapGuide(row);
  return data;
}

export type GuideListRow = GuideRow & {
  createdAtDubai: string;
  visitCount: number;
  lastVisitDubai: string | null;
};

export async function listGuides(): Promise<GuideListRow[]> {
  const db = await getDb();
  const rows = db.all<RawGuide & { visit_count: number; last_visit: string | null }>(
    `SELECT g.*,
       (SELECT COUNT(*) FROM visits v WHERE v.guide_token = g.token) AS visit_count,
       (SELECT MAX(v.last_seen_utc) FROM visits v WHERE v.guide_token = g.token) AS last_visit
     FROM guides g ORDER BY g.created_at DESC`,
  );
  return rows.map((r) => ({
    ...mapGuide(r),
    createdAtDubai: dubaiFromIso(r.created_at),
    visitCount: r.visit_count,
    lastVisitDubai: r.last_visit ? dubaiFromIso(r.last_visit) : null,
  }));
}

/* -------------------------------- visits --------------------------------- */

export type VisitRecord = {
  sessionId: string;
  guideToken: string | null;
  path: string | null;
  ip: string | null;
  userAgent: string | null;
  device: string | null;
  os: string | null;
  browser: string | null;
  referrer: string | null;
  language: string | null;
  screen: string | null;
  timezone: string | null;
  startedAtUtc: string;
  startedAtDubai: string;
  lastSeenUtc: string;
  dwellMs: number;
  maxScrollPct: number;
  sectionsViewed: string[];
};

export async function recordVisit(v: VisitRecord): Promise<void> {
  const db = await getDb();
  db.run(
    `INSERT INTO visits
       (guide_token, session_id, path, ip, user_agent, device, os, browser,
        referrer, language, screen, timezone, started_at_utc, started_at_dubai,
        last_seen_utc, dwell_ms, max_scroll_pct, sections_viewed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(session_id) DO UPDATE SET
       last_seen_utc   = excluded.last_seen_utc,
       dwell_ms        = MAX(visits.dwell_ms, excluded.dwell_ms),
       max_scroll_pct  = MAX(visits.max_scroll_pct, excluded.max_scroll_pct),
       sections_viewed = excluded.sections_viewed,
       guide_token     = COALESCE(visits.guide_token, excluded.guide_token)`,
    v.guideToken,
    v.sessionId,
    v.path,
    v.ip,
    v.userAgent,
    v.device,
    v.os,
    v.browser,
    v.referrer,
    v.language,
    v.screen,
    v.timezone,
    v.startedAtUtc,
    v.startedAtDubai,
    v.lastSeenUtc,
    v.dwellMs,
    v.maxScrollPct,
    JSON.stringify(v.sectionsViewed ?? []),
  );
}

export type VisitListRow = {
  id: number;
  guideToken: string | null;
  sessionId: string;
  path: string | null;
  ip: string | null;
  device: string | null;
  os: string | null;
  browser: string | null;
  userAgent: string | null;
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

type RawVisit = {
  id: number;
  guide_token: string | null;
  session_id: string;
  path: string | null;
  ip: string | null;
  device: string | null;
  os: string | null;
  browser: string | null;
  user_agent: string | null;
  referrer: string | null;
  language: string | null;
  screen: string | null;
  timezone: string | null;
  started_at_dubai: string;
  last_seen_utc: string;
  dwell_ms: number;
  max_scroll_pct: number;
  sections_viewed: string | null;
};

export async function listVisits(limit = 500): Promise<VisitListRow[]> {
  const db = await getDb();
  const rows = db.all<RawVisit>(
    "SELECT * FROM visits ORDER BY last_seen_utc DESC LIMIT ?",
    limit,
  );
  return rows.map((r) => ({
    id: r.id,
    guideToken: r.guide_token,
    sessionId: r.session_id,
    path: r.path,
    ip: r.ip,
    device: r.device,
    os: r.os,
    browser: r.browser,
    userAgent: r.user_agent,
    referrer: r.referrer,
    language: r.language,
    screen: r.screen,
    timezone: r.timezone,
    startedAtDubai: r.started_at_dubai,
    lastSeenDubai: dubaiFromIso(r.last_seen_utc),
    dwellMs: r.dwell_ms,
    maxScrollPct: r.max_scroll_pct,
    sectionsViewed: safeParse(r.sections_viewed),
  }));
}

function safeParse(s: string | null): string[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function dubaiFromIso(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}
