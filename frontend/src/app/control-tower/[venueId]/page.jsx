import AppView from "@/legacy/AppView";
import { VENUES, venueMeta } from "@/lib/domain/data";

export const dynamicParams = false;

export function generateStaticParams() {
  return VENUES.map((v) => ({ venueId: v.id }));
}

export async function generateMetadata({ params }) {
  const { venueId } = await params;
  const m = venueMeta(venueId);
  return { title: `${m ? m.name : "Venue"} · Compliance Assurance Suite` };
}

export default async function VenueDetailPage({ params }) {
  const { venueId } = await params;
  return <AppView view="venue" param={venueId} />;
}
