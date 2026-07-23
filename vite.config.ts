import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import {
  higgsfieldDesignInspectorVitePlugin,
  higgsfieldDesignSourceBabelPlugin,
} from "./src/module/design-inspector/vite";
import svgr from "vite-plugin-svgr";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { fileURLToPath } from "node:url";

// The vendored @higgsfield/quanta components import their glyphs from the private
// Nexus-only `@higgsfield-ai/icons`. Generated sites build on the PUBLIC npm
// registry, so we redirect every `@higgsfield-ai/icons/*` import to a Material
// Symbols shim instead (see src/lib/quanta-material-icons.ts). tsconfig.json has
// the matching `paths` entry so type-checking resolves it too.
const QUANTA_ICONS_SHIM = fileURLToPath(
  new URL("./src/lib/quanta-material-icons.ts", import.meta.url),
);

// This app self-hosts under Bun, not Cloudflare Workers, so the workerd
// built-in `cloudflare:workers` module doesn't exist at runtime. Redirect it to
// a shim (empty env) so any import resolves; persistence uses bun:sqlite.
const CLOUDFLARE_SHIM = fileURLToPath(
  new URL("./src/lib/cloudflare-workers-shim.ts", import.meta.url),
);

export default defineConfig(({ mode, command }) => {
  const designInspectorEnabled = process.env.HF_DESIGN_INSPECTOR === "1" || mode === "design";

  return {
    resolve: {
      alias: [
        { find: /^@higgsfield-ai\/icons(\/.*)?$/, replacement: QUANTA_ICONS_SHIM },
        // Off-Workers: resolve the workerd `cloudflare:workers` builtin to a shim.
        { find: /^cloudflare:workers$/, replacement: CLOUDFLARE_SHIM },
      ],
    },
    // The SSR bundle is served by a Bun process (server/serve.ts). Bundle npm
    // deps in for the production build so the output is self-contained; keep
    // Bun runtime builtins (bun:sqlite) external — Bun provides them, they must
    // NOT be bundled.
    ssr: {
      // Bundle-everything only applies to the production build; the dev server
      // leaves CJS deps (react) external or the ESM module runner chokes on
      // them ("module is not defined").
      noExternal: command === "build" ? true : undefined,
      // `bun:sqlite` is a Bun runtime builtin (used by src/lib/db.server.ts).
      // Like node: builtins it must stay external; the Bun runtime provides it.
      external: ["bun:sqlite"],
    },
    build: {
      // Keep `bun:*` builtins external in the SSR rollup pass too — `noExternal`
      // above would otherwise try to resolve+bundle them and fail.
      rollupOptions: { external: [/^bun:/] },
    },
    plugins: [
      // Material Symbols SVGs (the app icon set) import as React components via
      // `?react`. `icon: true` sizes them 1em; fill is forced to currentColor so
      // they color like text (the raw SVGs have no fill attribute). Keep the
      // viewBox so CSS sizing scales the glyph.
      svgr({
        svgrOptions: {
          icon: true,
          svgProps: { fill: "currentColor" },
          svgoConfig: {
            plugins: [
              { name: "preset-default", params: { overrides: { removeViewBox: false } } },
            ],
          },
        },
      }),
      // TanStack Start plugin must run before React's plugin.
      //
      // SSR build: `vite build` emits a Workers-shaped server bundle
      // (dist/server/server.js — `export default { fetch }`) plus dist/client
      // (hashed static assets). The platform publishes that as a per-tenant
      // Worker on Workers for Platforms, served at <sub>.higgsfield.app/ (host
      // root, so Vite's default base "/" — no base-path juggling).
      //
      // Rendering happens on the server per request, so site code must be
      // SSR-safe: never touch browser-only globals (window, document,
      // localStorage, navigator) during render or at module top level — only
      // inside effects/handlers, or guarded with `typeof window !== "undefined"`.
      tanstackStart({
        server: { entry: "server" },
      }),
      higgsfieldDesignInspectorVitePlugin(designInspectorEnabled),
      react({
        babel: {
          plugins: designInspectorEnabled ? [higgsfieldDesignSourceBabelPlugin] : [],
        },
      }),
      tailwindcss(),
      tsconfigPaths(),
    ],
  };
});
