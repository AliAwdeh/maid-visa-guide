import { createFileRoute } from "@tanstack/react-router";
import process from "node:process";

import { requireAllowedOrigin, requireBearer } from "../../lib/auth.server";
import { getGuideData, insertGuide } from "../../lib/db.server";
import { GuideInputSchema, guideDataFromInput } from "../../lib/guide-config";
import { fail, json } from "../../lib/http";
import { newToken } from "../../lib/token.server";

/* ═══════════════════════════════════════════════════════════════════════════
   POST /api/guides — create a client guide, return its /Views link.
   ─────────────────────────────────────────────────────────────────────────
   Bearer-authenticated (env API_TOKEN). Each call mints a NEW token (history
   is kept). On failure the response names the exact step that failed:
     auth → origin → parse → validate → compute → persist
   ═══════════════════════════════════════════════════════════════════════════ */

export const Route = createFileRoute("/api/guides")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // 1. auth
        const auth = requireBearer(request);
        if (!auth.ok) return fail(auth.step, auth.message, 401);

        // 2. origin (browser callers only; server-to-server has no Origin)
        const origin = requireAllowedOrigin(request);
        if (!origin.ok) return fail(origin.step, origin.message, 403);

        // 3. parse
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return fail("parse", "request body is not valid JSON", 400);
        }

        // 4. validate
        const parsed = GuideInputSchema.safeParse(body);
        if (!parsed.success) {
          return fail("validate", "one or more fields are invalid", 422, parsed.error.issues);
        }

        // 5. compute
        let token: string;
        let data;
        try {
          data = guideDataFromInput(parsed.data);
          token = newToken();
        } catch (e) {
          return fail("compute", e instanceof Error ? e.message : String(e), 500);
        }

        // 6. persist
        try {
          await insertGuide(token, parsed.data.CLIENT_ID, data);
        } catch (e) {
          return fail("persist", e instanceof Error ? e.message : String(e), 500);
        }

        // done
        const host = (process.env.PUBLIC_APP_HOST || new URL(request.url).origin).replace(
          /\/+$/,
          "",
        );
        return json({ ok: true, token, url: `${host}/Views/${token}` }, 200);
      },

      // Convenience for the /debug preview: fetch a stored guide's render data
      // (never returns client_id). Bearer-gated like the rest of the tooling.
      GET: async ({ request }) => {
        const auth = requireBearer(request);
        if (!auth.ok) return fail(auth.step, auth.message, 401);
        const token = new URL(request.url).searchParams.get("token");
        if (!token) return fail("validate", "missing ?token", 422);
        const data = await getGuideData(token);
        if (!data) return json({ ok: false, message: "not found" }, 404);
        return json({ ok: true, data }, 200);
      },
    },
  },
});
