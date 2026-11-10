import Link from "next/link";

/** Back link to the Control Tower followed by the current page name. */
export default function Breadcrumbs({ label }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <Link href="/control-tower">← Control Tower</Link>
      <span aria-hidden="true">/</span>
      <b>{label}</b>
    </nav>
  );
}
