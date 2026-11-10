"use client";

import CritBadge from "@/components/atoms/CritBadge";
import StatusPill from "@/components/atoms/StatusPill";
import { SAMPLE_CLAUSE, VENUES, fmtN } from "@/lib/domain/data";
import { decompose } from "@/lib/domain/actions";
import { addDecomposed } from "@/lib/domain/intake";
import { updateUi } from "@/lib/store/state";

const OP = { min: "≥ ", max: "≤ ", eq: "= " };

const LEGEND = [
  ["Binding", "“shall”, “must”", "Become obligations with an owner and a gate.", "info"],
  ["Advisory", "“should”", "Stays advisory and optional to keep.", "mute"],
  ["Measurable", "numbers with units", "Become pass or fail criteria the evidence check can test.", "good"],
  ["Yes / no", "no number", "Become checks that need a certificate.", "warn"],
];

function Legend() {
  return (
    <div className="lgrid">
      {LEGEND.map(([t, k, x, tone]) => (
        <div key={t} className="lg-c">
          <StatusPill tone={tone}>{t}</StatusPill>
          <b>{k}</b>
          <span>{x}</span>
        </div>
      ))}
    </div>
  );
}

function Counts({ rows }) {
  const binding = rows.filter((d) => d.binding).length;
  const measurable = rows.filter((d) => d.op !== "bool").length;
  const items = [
    [binding, "binding", "good"],
    [rows.length - binding, "advisory", "mid"],
    [measurable, "measurable criteria", "good"],
    [rows.length - measurable, "yes / no checks", "warn"],
  ];
  return (
    <div className="mini-grid four mt-lg">
      {items.map(([n, label, tone]) => (
        <div key={label} className={`mini ${tone}`}>
          <b>{n}</b>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

function Candidates({ rows, venue }) {
  const toggle = (i, keep) => updateUi({ decoOut: rows.map((d, k) => (k === i ? { ...d, keep } : d)) });
  return (
    <div className="mt-lg">
      <div className="flex deco-head">
        <h3 className="m0">{rows.length} candidate obligations</h3>
        <div className="flex">
          <label className="f inline" htmlFor="decoV">
            Add to
          </label>
          <select id="decoV" value={venue} onChange={(e) => updateUi({ decoVenue: e.target.value })}>
            {VENUES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <button type="button" className="primary" id="decoAdd" onClick={addDecomposed}>
            Add selected to register
          </button>
        </div>
      </div>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Keep</th>
              <th>Ref</th>
              <th>Obligation</th>
              <th>Type</th>
              <th>Criterion</th>
              <th>Family</th>
              <th>Criticality</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d, i) => (
              <tr key={i}>
                <td>
                  <input
                    type="checkbox"
                    checked={d.keep}
                    aria-label={`Keep obligation ${i + 1}`}
                    onChange={(e) => toggle(i, e.target.checked)}
                  />
                </td>
                <td className="mono">{d.ref}</td>
                <td>{d.text}</td>
                <td>
                  <StatusPill tone={d.binding ? "info" : "mute"}>{d.binding ? "Binding" : "Advisory"}</StatusPill>
                </td>
                <td className="mono">{d.op === "bool" ? "yes / no" : `${OP[d.op]}${fmtN(d.value)} ${d.unit}`}</td>
                <td>{d.fam}</td>
                <td>
                  <CritBadge level={d.crit} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Rule-based clause decomposition into candidate obligations. */
export default function RequirementIntake({ ui }) {
  const rows = ui.decoOut;
  return (
    <div className="panel" id="reqIntake">
      <div className="eyebrow">Requirement intake · rule-based PoC</div>
      <h3>Decompose requirements</h3>
      <p className="muted section-intro">
        Paste FIFA clause text. The engine splits it into atomic obligations, flags binding language and extracts
        measurable criteria. In the full product a language model does this with a reviewer approving every line;
        this PoC uses rules.
      </p>
      <label className="f" htmlFor="decoIn">
        Clause text (sample written for the demo)
      </label>
      <textarea id="decoIn" className="deco-in" value={ui.decoInput} onChange={(e) => updateUi({ decoInput: e.target.value })} />
      <div className="flex mt">
        <button type="button" className="primary" id="decoRun" onClick={() => updateUi({ decoOut: decompose(ui.decoInput) })}>
          Decompose
        </button>
        <button type="button" className="ghost" id="decoSample" onClick={() => updateUi({ decoInput: SAMPLE_CLAUSE, decoOut: null })}>
          Load sample
        </button>
      </div>
      <details className="mt" open={!rows}>
        <summary className="muted clickable">How clauses are read</summary>
        <Legend />
      </details>
      {rows && (
        <>
          <Counts rows={rows} />
          <Candidates rows={rows} venue={ui.decoVenue} />
        </>
      )}
    </div>
  );
}
