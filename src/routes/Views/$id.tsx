import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect } from "react";

import { MaidVisaGuide } from "../../components/maid-visa-guide";
import { toVariantConfig } from "../../lib/guide-config";
import { fetchGuideData } from "../../lib/guides.functions";
import { startVisitBeacon } from "../../lib/visit-beacon";

/* /Views/<token> — the client-facing guide. The token maps to a stored guide;
   the real CLIENT_ID is never in the URL or the render data. Unknown tokens
   fall through to the app's 404. */
export const Route = createFileRoute("/Views/$id")({
  loader: async ({ params }) => {
    const data = await fetchGuideData({ data: { token: params.id } });
    if (!data) throw notFound();
    return { data };
  },
  component: ViewGuide,
});

function ViewGuide() {
  const { data } = Route.useLoaderData();
  const { id } = Route.useParams();

  // Isomorphic beacon: no-op on the server, records the visit in the browser.
  useEffect(() => startVisitBeacon({ guideToken: id, path: `/Views/${id}` }), [id]);

  return <MaidVisaGuide config={toVariantConfig(data)} />;
}
