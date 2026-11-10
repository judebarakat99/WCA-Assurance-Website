import Eyebrow from "@/components/atoms/Eyebrow";

/** Page title block: context chip, heading and lead paragraph. */
export default function PageHead({ chip, title, lead }) {
  return (
    <div className="page-head">
      {chip && <Eyebrow chip>{chip}</Eyebrow>}
      <h2>{title}</h2>
      {lead && <p className="lead">{lead}</p>}
    </div>
  );
}
