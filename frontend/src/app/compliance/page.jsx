import FacilityRegister from "@/components/organisms/FacilityRegister";
import FifaLibrary from "@/components/organisms/FifaLibrary";
import CompliancePage from "@/components/pages/CompliancePage";

export const metadata = { title: "Compliance · Compliance Assurance Suite" };

// FifaLibrary and FacilityRegister are Server Components, rendered at build
// time and passed into the client page.
export default function Page() {
  return (
    <CompliancePage
      reference={
        <>
          <FifaLibrary />
          <FacilityRegister />
        </>
      }
    />
  );
}
