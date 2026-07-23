// Self-host shim. This app runs under Bun (not Cloudflare Workers), where the
// workerd built-in `cloudflare:workers` module does not exist. vite.config.ts
// aliases `cloudflare:workers` to this file so any lingering import resolves.
// There are no CF bindings off-Workers, so env is empty; persistence goes
// through bun:sqlite (see src/lib/db.server.ts).
export const env = {};
