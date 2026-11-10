"use client";

import PageHead from "@/components/molecules/PageHead";
import Section from "@/components/molecules/Section";
import DecisionCard from "@/components/organisms/DecisionCard";
import EscalationLadder from "@/components/organisms/EscalationLadder";
import IssueCard from "@/components/organisms/IssueCard";
import PageTemplate from "@/components/templates/PageTemplate";
import { DECISIONS, SLA } from "@/lib/domain/data";
import { decRec } from "@/lib/domain/actions";

/** Decisions & actions for a given programme model (exported for tests). */
export function ActionsView({ S }) {
  const openDecisions = DECISIONS.filter((d) => decRec(d.id).status === "Open").length;
  const open = S.issues.filter((i) => i.status === "Open");
  const closed = S.issues.filter((i) => i.status !== "Open");
  const late = open.filter((i) => S.today > i.due).length;
  return (
    <>
      <PageHead
        chip={`Decisions & actions · ${openDecisions} decisions open · ${open.length} actions open · ${late} past SLA`}
        title="Decisions & actions"
        lead="Everything waiting on the programme in one place: executive decisions with their last responsible moments, then the corrective actions and escalations the rule engine is driving. Taking a decision re-runs the forecast at once; an action closes only when new evidence passes validation."
      />
      <Section
        eyebrow="Executive decisions"
        title={`Decision log · ${openDecisions} open · ${DECISIONS.length - openDecisions} decided`}
      >
        <p className="muted section-intro">
          Each decision carries its last responsible moment: the latest date it can be taken before options
          start to close. Taking one re-runs the forecast at once, so the effect on P80 is visible in the room.
        </p>
        <div className="grid decs">
          {DECISIONS.map((d) => (
            <DecisionCard key={d.id} decision={d} S={S} />
          ))}
        </div>
      </Section>
      <Section eyebrow="Corrective actions" title="Open issues · SLA status">
        <p className="muted section-intro">
          Every failed check opens a corrective action with an SLA set by criticality (Critical {SLA.Critical}{" "}
          days, High {SLA.High}, Medium {SLA.Medium}). A missed SLA climbs the ladder. An issue closes only when
          new evidence passes validation.
        </p>
        {open.length ? (
          <div className="grid issues">
            {open.map((i) => (
              <IssueCard key={i.id} issue={i} S={S} />
            ))}
          </div>
        ) : (
          <div className="panel">
            <div className="okbig">
              <i>✓</i>
              <span>No open issues</span>
            </div>
          </div>
        )}
      </Section>
      <Section eyebrow="Escalation ladder" title="Where open actions sit">
        <EscalationLadder openIssues={open} />
      </Section>
      {closed.length > 0 && (
        <Section eyebrow="Resolved" title="Closed by evidence">
          <div className="grid issues">
            {closed.map((i) => (
              <IssueCard key={i.id} issue={i} S={S} />
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

export default function ActionsPage() {
  return <PageTemplate label="Decisions and actions">{(p) => <ActionsView S={p.S} />}</PageTemplate>;
}
