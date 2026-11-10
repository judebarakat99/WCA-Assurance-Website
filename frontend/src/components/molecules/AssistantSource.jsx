import StatusPill from "@/components/atoms/StatusPill";

const LABELS = {
  forecasts: "Milestone forecast",
  venues: "Venue & gate assessment",
  obligations: "Obligation",
  issues: "Corrective action",
  decisions: "Executive decision",
  summary: "Programme snapshot",
};

function displayDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

/**
 * One supporting source under an assistant answer: a programme record (named
 * facts and gate checks) or a document passage with its page. Model and
 * document text is rendered as text, never as HTML.
 */
export default function AssistantSource({ source }) {
  const isDocument = source.kind === "document";
  const category = isDocument ? "Document passage" : LABELS[source.category] || "Programme record";
  const page = isDocument && source.page ? ` · page ${source.page}` : "";
  const facts = (source.facts || []).filter((f) => f.value && f.value !== "Not supplied");
  const checks = source.checks || [];
  return (
    <details className="ai-source-card">
      <summary>
        <span className="ai-source-type">{category}</span>
        <strong>
          {source.title}
          {page}
        </strong>
        <span className="ai-source-expand" aria-hidden="true">
          ＋
        </span>
      </summary>
      <div className="ai-source-body">
        {source.as_of && <p className="ai-source-date">Demo snapshot · {displayDate(source.as_of)}</p>}
        {facts.length > 0 && (
          <dl className="ai-source-facts">
            {facts.map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {checks.map((check) => (
          <div key={check.label} className="ai-source-check">
            <StatusPill tone={check.met ? "good" : "bad"}>{check.met ? "Met" : "Unmet"}</StatusPill>
            <div>
              <p>{check.label}</p>
              {check.blockers?.length > 0 && <small>Blocking obligations: {check.blockers.join(", ")}</small>}
            </div>
          </div>
        ))}
        {isDocument && source.excerpt && <blockquote>{source.excerpt}</blockquote>}
        {!isDocument && !facts.length && !checks.length && (
          <p>Supporting programme record. Refresh the page to load its readable details.</p>
        )}
      </div>
    </details>
  );
}
