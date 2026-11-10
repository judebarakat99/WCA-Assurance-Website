import Link from "next/link";

/** Back link to a parent page (the Control Tower by default) and the current page name. */
export default function Breadcrumbs({ label, parent = { href: "/control-tower", label: "Control Tower" } }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <Link href={parent.href}>← {parent.label}</Link>
      <span aria-hidden="true">/</span>
      <b>{label}</b>
    </nav>
  );
}
