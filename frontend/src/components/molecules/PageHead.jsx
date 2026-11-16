import Eyebrow from "@/components/atoms/Eyebrow";

/** Page title block: context chip, heading and lead paragraph (wideLead: full container width). */
export default function PageHead({ chip, title, lead, wideLead = false }) {
  return (
    <div className="page-head">
      {chip && <Eyebrow chip>{chip}</Eyebrow>}
      <h2>{title}</h2>
      {lead && <p className={wideLead ? "lead wide" : "lead"}>{lead}</p>}
    </div>
  );
}
