import { createIsomorphicFn } from "@tanstack/react-start";

/* Analytics beacon for /Views guide pages, as an isomorphic function: the
   server impl is a no-op (keeps browser globals out of the SSR bundle so
   TanStack's import-protection is satisfied), the client impl does the real
   work. Sensitive fields (IP, UA, device, Dubai time) are derived server-side
   in /api/visits — this reports only what the browser knows plus engagement
   (dwell, scroll depth, sections seen). Returns a cleanup function. */

type BeaconInit = { guideToken: string | null; path: string };

const SECTION_IDS = ["timeline", "payments", "rights"];
const HEARTBEAT_MS = 10_000;

export const startVisitBeacon = createIsomorphicFn()
  .server((_init: BeaconInit): (() => void) => () => {})
  .client((init: BeaconInit): (() => void) => {
    const { guideToken, path } = init;
    const sessionId = crypto.randomUUID();
    const startedAt = Date.now();
    const sections = new Set<string>();
    let maxScrollPct = 0;

    // Source of the visit. A `?ref=` (or `?utm_source=`) tag on the link wins,
    // because links opened from WhatsApp / SMS / a typed URL send no browser
    // referrer. Falls back to the referring page, then null ("direct").
    const params = new URLSearchParams(window.location.search);
    const referrer = params.get("ref") || params.get("utm_source") || document.referrer || null;

    const payload = () => ({
      sessionId,
      guideToken,
      path,
      referrer,
      language: navigator.language || null,
      screen: `${window.screen.width}x${window.screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
      dwellMs: Date.now() - startedAt,
      maxScrollPct,
      sectionsViewed: [...sections],
    });

    const send = (useBeacon = false) => {
      const data = JSON.stringify(payload());
      if (useBeacon && navigator.sendBeacon) {
        navigator.sendBeacon("/api/visits", new Blob([data], { type: "application/json" }));
        return;
      }
      void fetch("/api/visits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: data,
        keepalive: true,
      }).catch(() => {});
    };

    const onScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const pct = scrollable > 0 ? Math.round((window.scrollY / scrollable) * 100) : 100;
      if (pct > maxScrollPct) maxScrollPct = Math.min(100, pct);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting && e.target.id) sections.add(e.target.id);
      },
      { threshold: 0.3 },
    );
    for (const id of SECTION_IDS) {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    }

    const onVisibility = () => {
      if (document.visibilityState === "hidden") send(true);
    };
    const onPageHide = () => send(true);

    send(); // initial hit
    const heartbeat = window.setInterval(() => send(), HEARTBEAT_MS);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      obs.disconnect();
      send(true);
    };
  });
