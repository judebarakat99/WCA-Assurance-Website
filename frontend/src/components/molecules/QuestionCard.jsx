const BASIS = {
  ev: "Evidence-based",
  fc: "Forecast · 1,000 runs",
  dl: "Decision log",
};

/**
 * A numbered readiness question: a visual, a one-paragraph answer, optional
 * detail rows, and a footer with the basis of the answer and a link.
 * kind: "ev" (evidence) | "fc" (forecast) | "dl" (decision log).
 */
export default function QuestionCard({ n, question, visual, answer, rows, kind, basis, action }) {
  return (
    <article className="qcard" id={`q${n}`}>
      <div className="qhead">
        <span className="qnum">{n}</span>
        <h3>{question}</h3>
      </div>
      <div className="qvis">{visual}</div>
      <p className="ans">{answer}</p>
      {rows && <div className="qrows">{rows}</div>}
      <div className="qfoot">
        <span className={`conf ${kind}`}>{BASIS[kind]}</span>
        <span>{basis}</span>
        <span className="spacer" />
        {action}
      </div>
    </article>
  );
}
