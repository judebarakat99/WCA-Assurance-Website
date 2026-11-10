import FacilityPage from "@/components/pages/FacilityPage";
import { FACILITY_REGISTER } from "@/lib/domain/facilities.mjs";

export const dynamicParams = false;

export function generateStaticParams() {
  return FACILITY_REGISTER.stadiums.map((s) => ({ facilityId: s.id }));
}

export async function generateMetadata({ params }) {
  const { facilityId } = await params;
  const s = FACILITY_REGISTER.stadiums.find((x) => x.id === facilityId);
  return { title: `${s ? s.name : "Facility"} · Facility assessment · Compliance Assurance Suite` };
}

export default async function Page({ params }) {
  const { facilityId } = await params;
  return <FacilityPage facilityId={facilityId} />;
}
