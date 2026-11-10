"use client";

import Eyebrow from "@/components/atoms/Eyebrow";
import Legend from "@/components/atoms/Legend";
import Ring from "@/components/atoms/Ring";
import SegmentBar from "@/components/atoms/SegmentBar";
import Breadcrumbs from "@/components/molecules/Breadcrumbs";
import HBar from "@/components/molecules/HBar";
import PageHead from "@/components/molecules/PageHead";
import Select from "@/components/molecules/Select";
import ObligationTable from "@/components/organisms/ObligationTable";
import PageTemplate from "@/components/templates/PageTemplate";
import { VENUES, STATES, pct } from "@/lib/domain/data";
import { isProven } from "@/lib/domain/scoring";
import { updateUi } from "@/lib/store/state";
import { stateParts } from "@/lib/ui/tones";

const CRITS = ["Critical", "High", "Medium"];
const ALL_STATES = [...STATES, "Rejected"];

function matches(o, f) {
  return (
    (f.venue === "all" || o.venue === f.venue) &&
    (f.family === "all" || o.family === f.family) &&
    (f.state === "all" || o.state === f.state) &&
    (!f.q || (o.text + o.id + o.owner).toLowerCase().includes(f.q.toLowerCase()))
  );
}

function Summary({ list, total }) {
  const proven = list.filter(isProven).length;
  const byCrit = CRITS.map((c) => {
    const l = list.filter((o) => o.crit === c);
    return { c, n: l.length, p: l.filter(isProven).length };
  });
  const max = Math.max(1, ...byCrit.map((x) => x.n));
  const parts = stateParts(list);
  return (
    <div className="sumrow">
      <div className="sumcard">
        <Eyebrow>In view</Eyebrow>
        <div className="v3">
          <Ring
            parts={[
              { n: proven, c: "var(--brand-deep)" },
              { n: Math.max(list.length - proven, 0), c: "var(--sunk)" },
            ]}
            value={`${proven}/${list.length}`}
            label="proven"
            size="sm"
          />
          <div className="v3-side">
            <div className="kpi">
              <b>{list.length}</b>
              <span>
                of {total}
                <br />
                obligations
              </span>
            </div>
            <div className="muted fine">
              {list.length
                ? `${pct(proven / list.length)}% backed by validated evidence`
                : "Nothing matches these filters"}
            </div>
          </div>
        </div>
      </div>
      <div className="sumcard">
        <Eyebrow>By state</Eyebrow>
        <SegmentBar parts={parts} />
        <Legend parts={parts} />
      </div>
      <div className="sumcard">
        <Eyebrow>By criticality</Eyebrow>
        <div className="hbs">
          {byCrit.map((x) => (
            <HBar
              key={x.c}
              name={x.c}
              segments={[
                { n: x.p, k: "good" },
                { n: x.n - x.p, k: "oth" },
              ]}
              total={`${x.p}/${x.n}`}
              max={max}
            />
          ))}
        </div>
        <div className="leg">
          <span>
            <i className="good" />
            proven
          </span>
          <span>
            <i className="oth" />
            not yet
          </span>
        </div>
      </div>
    </div>
  );
}

function Register({ S, ui }) {
  const f = ui.filters;
  const set = (key) => (value) => updateUi({ filters: { ...f, [key]: value } });
  const families = [...new Set(S.obligations.map((o) => o.family))];
  const list = S.obligations.filter((o) => matches(o, f));
  return (
    <>
      <Breadcrumbs label="Obligation register" />
      <PageHead
        chip={`Obligation register · ${S.obligations.length} obligations`}
        title="Obligation register"
        lead="Each FIFA clause becomes an owned, testable obligation with a measurable acceptance criterion. Status changes only when evidence passes the rule."
      />
      <Summary list={list} total={S.obligations.length} />
      <div className="filters">
        <Select
          id="fVenue"
          label="Venue"
          value={f.venue}
          onChange={set("venue")}
          options={[["all", "All venues"], ...VENUES.map((v) => [v.id, v.name])]}
        />
        <Select
          id="fFamily"
          label="Requirement family"
          value={f.family}
          onChange={set("family")}
          options={[["all", "All families"], ...families.map((x) => [x, x])]}
        />
        <Select
          id="fState"
          label="State"
          value={f.state}
          onChange={set("state")}
          options={[["all", "All states"], ...ALL_STATES.map((s) => [s, s])]}
        />
        <input
          id="fQ"
          type="search"
          placeholder="Search obligations"
          aria-label="Search"
          value={f.q}
          onChange={(e) => set("q")(e.target.value)}
        />
        <span className="muted">{list.length} shown</span>
      </div>
      <ObligationTable obligations={list} />
    </>
  );
}

export default function RegisterPage() {
  return <PageTemplate label="Obligation register">{(p) => <Register {...p} />}</PageTemplate>;
}
