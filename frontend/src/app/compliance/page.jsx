import FifaLibrary from "@/components/organisms/FifaLibrary";
import CompliancePage from "@/components/pages/CompliancePage";

export const metadata = { title: "Compliance · Compliance Assurance Suite" };

// FifaLibrary is a Server Component, rendered at build time and passed into
// the client page.
export default function Page() {
  return <CompliancePage library={<FifaLibrary />} />;
}
