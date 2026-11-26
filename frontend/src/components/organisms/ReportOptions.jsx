"use client";

import ChoiceCard from "@/components/molecules/ChoiceCard";
import { FORMATS, SCOPES, SCOPE_GROUPS, narrowFor, targetsFor } from "@/lib/reports/model.mjs";

function Select({ label, value, onChange, empty, options }) {
  return (
    <label className="f">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{empty}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * What the report is: its format, what it is for (scope), and the stadium, city, chapter or owner it covers.
 * choice: { format, scope, target, narrow }; onChange(patch). data: the report data (lib/reports/data).
 */
export default function ReportOptions({ choice, onChange, data }) {
  const { format, scope, target, narrow } = choice;
  const scopeInfo = SCOPES.find((s) => s.id === scope);
  const narrowInfo = scope ? narrowFor(scope, data) : null;
  return (
    <>
      <section className="rp-block" aria-labelledby="rp-format">
        <h2 id="rp-format">Format</h2>
        <div className="rp-choices" role="radiogroup" aria-labelledby="rp-format">
          {FORMATS.map((f) => (
            <ChoiceCard
              key={f.id}
              checked={format === f.id}
              onClick={() => onChange({ format: f.id })}
              title={f.label}
              hint={f.hint}
              badge={f.ext.toUpperCase()}
            />
          ))}
        </div>
      </section>
      <section className="rp-block" aria-labelledby="rp-scope">
        <h2 id="rp-scope">Report for</h2>
        <div role="radiogroup" aria-labelledby="rp-scope" className="rp-groups">
          {SCOPE_GROUPS.map((g) => (
            <div key={g.id} className="rp-group">
              <h3 className="rp-group-title">{g.label}</h3>
              <div className="rp-choices five">
                {SCOPES.filter((s) => (s.group || "compliance") === g.id).map((s) => (
                  <ChoiceCard
                    key={s.id}
                    checked={scope === s.id}
                    onClick={() => onChange({ scope: s.id, target: "", narrow: "" })}
                    title={s.label}
                    hint={s.hint}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        {scope && (scopeInfo.targetLabel || narrowInfo) && (
          <div className="rp-selects">
            {scopeInfo.targetLabel && (
              <Select
                label={scopeInfo.targetLabel}
                value={target}
                onChange={(v) => onChange({ target: v })}
                empty="Choose…"
                options={targetsFor(scope, data)}
              />
            )}
            {narrowInfo && (
              <Select
                label={`${narrowInfo.label} (optional)`}
                value={narrow}
                onChange={(v) => onChange({ narrow: v })}
                empty="No limit"
                options={narrowInfo.options}
              />
            )}
          </div>
        )}
      </section>
    </>
  );
}
