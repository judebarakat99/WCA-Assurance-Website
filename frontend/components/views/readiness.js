// ---------- Readiness Room page view ----------
import {GATES,DECISIONS,EXTERNAL,VENUES,MONTHS,REQMAT,esc,fmtD,pct,sn,dd,daysBetween,addDays,venueMeta,gateNum,decMeta,stateCls} from "../../lib/data";
import {S,ui,rerender,goView} from "../../lib/state";
import {scores,oblsOf,venueState,gateEval,matOf,isProven} from "../../lib/scoring";
import {forecast,forecasts} from "../../lib/forecast";
import {segV,legV,ringV,rowV,kpiV,hbV,barV,headV} from "./shared";

export function fcChart(f){
  const W=1100,L=260,R=24,top=34,rowH=46,H=top+f.length*rowH+12;
  const t0=Date.parse(S.today);
  let end=t0; f.forEach(x=>{[x.d80,x.gateDate,x.pmc.finish].forEach(d=>{end=Math.max(end,Date.parse(d))})});
  end+=45*864e5;
  const X=d=>L+(Date.parse(d)-t0)/(end-t0)*(W-L-R);
  const ticks=[]; const s=new Date(S.today+"T00:00:00Z"); s.setUTCDate(1); const span=(end-t0)/864e5, step=span>900?6:3;
  s.setUTCMonth(Math.ceil((s.getUTCMonth()+1)/step)*step);
  while(s.getTime()<end){ticks.push(s.toISOString().slice(0,10));s.setUTCMonth(s.getUTCMonth()+step);}
  const tk=ticks.map(d=>`<line x1="${X(d)}" x2="${X(d)}" y1="${top-8}" y2="${H-6}"/>`).join("");
  const tl=ticks.map(d=>`<text class="mut" x="${X(d)}" y="${top-14}" text-anchor="middle">${MONTHS[Number(d.slice(5,7))-1]} ${d.slice(2,4)}</text>`).join("");
  const rows=f.map((x,i)=>{
    const y=top+i*rowH+rowH/2, c=x.cls==="p-good"?"good":x.cls==="p-warn"?"warn":"bad";
    const tip=`<b>${esc(sn(x.id))}</b><br>${x.gate.id} ${x.gate.name}: FIFA milestone ${fmtD(x.gateDate)}<br>PMC deterministic finish ${fmtD(x.pmc.finish)}<br>Evidence-based P50 ${fmtD(x.d50)} · P60 ${fmtD(x.d60)} · P80 ${fmtD(x.d80)}<br>Chance of meeting the milestone: ${pct(x.prob)}%${S.scn.recovery.includes(x.id)?"<br>Recovery team deployed":""}`;
    const gx=X(x.gateDate);
    return `<g>
      <rect class="hit" x="0" y="${y-rowH/2}" width="${W}" height="${rowH}" data-tip="${esc(tip)}"/>
      <text x="0" y="${y-3}" style="font-weight:600">${esc(sn(x.id))}</text>
      <text class="mut" x="0" y="${y+12}">${x.gate.id} ${esc(x.gate.name)} · ${pct(x.prob)}% on time</text>
      <line class="gate" x1="${gx}" x2="${gx}" y1="${y-14}" y2="${y+14}" pointer-events="none"/>
      <path class="gated" d="M${gx} ${y-19} l4 4 l-4 4 l-4 -4 z" pointer-events="none"/>
      <rect class="band ${c}" x="${X(x.d50)}" y="${y-6}" width="${Math.max(3,X(x.d80)-X(x.d50))}" height="12" rx="4" pointer-events="none"/>
      <line class="p60" x1="${X(x.d60)}" x2="${X(x.d60)}" y1="${y-8}" y2="${y+8}" pointer-events="none"/>
      <circle class="p50" cx="${X(x.d50)}" cy="${y}" r="5" pointer-events="none"/>
      <circle class="pmc" cx="${X(x.pmc.finish)}" cy="${y}" r="5" pointer-events="none"/>
      ${x.p80===0?`<text class="mut" x="${X(x.d50)+8}" y="${y+19}" pointer-events="none">Gate rules met today</text>`:""}
    </g>`}).join("");
  return `<div class="fc-wrap"><svg class="fc-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gate forecast per venue: P50 to P80 range against FIFA milestone and PMC finish">
    <g class="grid">${tk}</g>${tl}<g class="today"><line x1="${L}" x2="${L}" y1="${top-8}" y2="${H-6}"/></g><text class="mut" x="${L+4}" y="${H-1}">Today</text>${rows}</svg><div class="fc-tip" hidden></div></div>
  <div class="fc-legend">
    <span><svg width="22" height="12"><circle cx="5" cy="6" r="4.5" style="fill:var(--ink)"/><rect x="5" y="2" width="16" height="8" rx="3" style="fill:var(--warn-soft);stroke:var(--warn)"/></svg>P50 to P80 from evidence</span>
    <span><svg width="6" height="14"><line x1="3" x2="3" y1="0" y2="14" style="stroke:var(--ink);stroke-width:2"/></svg>P60</span>
    <span><svg width="12" height="12"><circle cx="6" cy="6" r="4.5" style="fill:var(--surface);stroke:var(--muted);stroke-width:2"/></svg>PMC schedule finish</span>
    <span><svg width="10" height="14"><path d="M5 0 l4 4 l-4 4 l-4 -4 z" style="fill:var(--ink)"/><line x1="5" x2="5" y1="8" y2="14" style="stroke:var(--ink);stroke-dasharray:2 2"/></svg>FIFA milestone</span>
    <span><span class="pill p-good">On track at P80</span><span class="pill p-warn">At risk at P80</span><span class="pill p-bad">Late at P50</span></span>
  </div>`;
}
export function qcard(n,q,vis,ans,rows,conf,basis,btn){
  const cc=conf==="ev"?"Evidence-based":conf==="fc"?"Forecast · 1,000 runs":"Decision log";
  return `<article class="qcard" id="q${n}"><div class="qhead"><span class="qnum">${n}</span><h3>${esc(q)}</h3></div>
    <div class="qvis">${vis}</div><p class="ans">${ans}</p>${rows?`<div class="qrows">${rows}</div>`:""}
    <div class="qfoot"><span class="conf ${conf}">${cc}</span><span>${basis}</span><span class="spacer"></span>${btn||""}</div></article>`;
}
export function aiExecSummary() {
  const f = forecasts();
  const sc = scores(S.obligations);

  const onTrack = f.filter((x) => x.late80 <= 0).length;

  const worst = f
    .slice()
    .sort((a, b) => a.prob - b.prob || b.late80 - a.late80)[0];

  const criticalUnverified = S.obligations.filter(
    (o) => o.crit === "Critical" && o.state !== "Verified"
  ).length;

  const falseGreens = S.obligations.filter(
    (o) => o.claim && o.state === "Rejected"
  ).length;

  const unprovenClaims = S.obligations.filter(
    (o) =>
      o.claim &&
      o.state !== "Validated" &&
      o.state !== "Verified"
  ).length;

  const openIssues = S.issues.filter(
    (i) => i.status === "Open"
  );

  const overdueIssues = openIssues.filter(
    (i) => S.today > i.due
  ).length;

  const openDecisions = S.decisions
    .filter((record) => record.status === "Open")
    .map((record) => decMeta(record.id))
    .filter(Boolean)
    .sort(
      (a, b) =>
        daysBetween(S.today, a.lrm) -
        daysBetween(S.today, b.lrm)
    );

  const nextDecision = openDecisions[0];

  const worstName = worst
    ? sn(worst.id)
    : "No venue currently at risk";

  const worstVenue = worst
    ? venueMeta(worst.id)
    : null;

  const pmcConflict =
    worst &&
    worst.pmcLate <= 0 &&
    worst.late80 > 0;

  const decisionDays = nextDecision
    ? daysBetween(S.today, nextDecision.lrm)
    : null;

  return `
    <section class="exec-brief" id="aiExec">

      <div class="exec-brief-head">
        <div>
          <span class="exec-ai-label">
            ✦ AI Executive Brief
          </span>
        </div>
      </div>

      <div class="exec-kpis">

        <div class="exec-kpi">
          <strong>${pct(sc.assured)}%</strong>
          <span>Assured readiness</span>
          <small>
            ${pct(sc.declared)}% owner-declared
          </small>
        </div>

        <div class="exec-kpi">
          <strong>${onTrack}/${f.length}</strong>
          <span>Next gates on track</span>
          <small>at P80 confidence</small>
        </div>

        <div class="exec-kpi ${
          criticalUnverified ? "risk" : ""
        }">
          <strong>${criticalUnverified}</strong>
          <span>Critical unverified</span>
          <small>awaiting second-line verification</small>
        </div>

        <div class="exec-kpi ${
          openDecisions.length ? "warn" : ""
        }">
          <strong>${openDecisions.length}</strong>
          <span>Decisions open</span>
          <small>
            ${
              nextDecision
                ? `next due ${fmtD(nextDecision.lrm)}`
                : "none outstanding"
            }
          </small>
        </div>

      </div>

      ${
        worst
          ? `
            <div class="exec-priority">

              <div class="exec-priority-top">
                <span class="exec-priority-label">
                  Priority attention
                </span>

                <span class="pill ${worst.cls}">
                  ${esc(worst.status)}
                </span>
              </div>

              <div class="exec-priority-main">

                <div>
                  <h3>${esc(worstName)}</h3>

                  <p>
                    ${esc(worstVenue?.city || "")}
                    · ${worst.gate.id}
                    ${esc(worst.gate.name)}
                    · milestone ${fmtD(worst.gateDate)}
                  </p>
                </div>

                <div class="exec-risk-metrics">

                  <div>
                    <strong>${pct(worst.prob)}%</strong>
                    <span>on-time probability</span>
                  </div>

                  <div>
                    <strong>
                      ${
                        worst.late80 > 0
                          ? `+${worst.late80}`
                          : Math.abs(worst.late80)
                      }
                    </strong>

                    <span>
                      ${
                        worst.late80 > 0
                          ? "days late at P80"
                          : "days inside P80"
                      }
                    </span>
                  </div>

                  <div>
                    <strong>${falseGreens}</strong>
                    <span>
                      false green${falseGreens === 1 ? "" : "s"}
                    </span>
                  </div>

                </div>
              </div>

              ${
                pmcConflict
                  ? `
                    <div class="exec-insight">
                      <span>✦</span>

                      <p>
                        <strong>Assurance signal:</strong>
                        the PMC schedule shows this milestone on time,
                        but the evidence-based P80 forecast shows it late.
                        Leadership should resolve this discrepancy before
                        relying on the reported programme status.
                      </p>
                    </div>
                  `
                  : ""
              }

            </div>
          `
          : ""
      }

      <div class="exec-bottom">

        <div class="exec-watch">
          <span class="eyebrow">
            Programme watchlist
          </span>

          <ul>
            <li>
              <strong>${unprovenClaims}</strong>
              owner-declared item${
                unprovenClaims === 1 ? "" : "s"
              } not yet proven by evidence
            </li>

            <li>
              <strong>${criticalUnverified}</strong>
              Critical obligation${
                criticalUnverified === 1 ? "" : "s"
              } remain unverified
            </li>

            <li>
              <strong>${openIssues.length}</strong>
              corrective action${
                openIssues.length === 1 ? "" : "s"
              } remain open
            </li>

            ${
              overdueIssues
                ? `
                  <li class="exec-danger">
                    <strong>${overdueIssues}</strong>
                    action${overdueIssues === 1 ? " is" : "s are"}
                    past SLA
                  </li>
                `
                : ""
            }
          </ul>
        </div>

        <div class="exec-action">
          <span class="eyebrow">
            Leadership action
          </span>

          ${
            nextDecision
              ? `
                <strong class="exec-action-id">
                  ${esc(nextDecision.id)}
                </strong>

                <h3>
                  ${esc(nextDecision.title)}
                </h3>

                <p>
                  Decide by
                  <strong>${fmtD(nextDecision.lrm)}</strong>
                  ·
                  ${
                    decisionDays < 0
                      ? `${dd(decisionDays)} overdue`
                      : `${dd(decisionDays)} remaining`
                  }
                </p>

                <button
                  class="primary"
                  data-goto="actions"
                >
                  Review decision
                </button>
              `
              : `
                <div class="exec-ok">
                  ✓ No executive decision currently outstanding
                </div>
              `
          }
        </div>

      </div>

      <div class="exec-footer">

        <button
          class="exec-ai-question"
          data-ai-question="Why is the highest-risk venue at risk?"
        >
          ✦ Ask AI why
        </button>

        <button
          class="linkish"
          data-goto="tower"
        >
          View Control Tower →
        </button>

      </div>

    </section>
  `;
}
export function viewReadiness(){
  const f=forecasts(), on80=f.filter(x=>x.late80<=0), on50=f.filter(x=>x.late50<=0);
  const worst=f.slice().sort((a,b)=>a.prob-b.prob||b.late80-a.late80)[0];
  const pmcSaysOk=worst&&worst.pmcLate<=0;
  const scn=S.scn;
  // Q2 false greens
  const claims=S.obligations.filter(o=>o.claim&&!(o.state==="Validated"||o.state==="Verified"));
  const overturned=claims.filter(o=>o.state==="Rejected");
  const designOnly=S.obligations.filter(o=>{const v=venueState(o.venue);if(v.gateIdx>=GATES.length)return false;const gn=v.gateIdx+1;return gateNum(o.gate)<=gn&&gn>1&&(o.state==="Verified"||o.state==="Validated")&&matOf(o)<REQMAT[gn-1];});
  const critRank={Critical:0,High:1,Medium:2};
  // Q3 next inspection
  const next=f.slice().sort((a,b)=>a.gateDays-b.gateDays)[0], ge=gateEval(next.id);
  // FIFA inspects the whole venue, not only the current gate scope
  const gaps=oblsOf(next.id).filter(o=>o.crit!=="Medium"&&o.state!=="Verified").sort((a,b)=>critRank[a.crit]-critRank[b.crit]);
  // Q4 decisions
  const openD=S.decisions.filter(d=>d.status==="Open").map(d=>Object.assign({},decMeta(d.id),{left:daysBetween(S.today,decMeta(d.id).lrm)})).sort((a,b)=>a.left-b.left);
  const undecided=f.filter(x=>x.late80>0&&!DECISIONS.some(d=>d.venue===x.id));
  // Q5 recovery + visual helpers for the Readiness Room cards
  const kc=x=>x.cls||(x.late80<=0?"p-good":(x.prob>=0.5?"p-warn":"p-bad"));
  const c2=()=>{const nO=overturned.length,nU=claims.length-nO,nD=designOnly.length;
    const P=[{n:nO,c:"var(--bad)",l:"overturned"},{n:nU,c:"var(--warn)",l:"unproven"},{n:nD,c:"var(--mint)",l:"proven on drawings only"}];
    return kpiV(claims.length,"declared complete,<br>not proven","t-warn")+segV(P)+legV(P)};
  const c2rows=()=>claims.slice().sort((a,b)=>critRank[a.crit]-critRank[b.crit]).slice(0,4).map(o=>rowV(`<button class="linkish" data-obl="${o.id}">${o.id}</button>`,esc(o.text),`<span class="pill ${o.state==="Rejected"?"p-bad":"p-warn"}">${o.state==="Rejected"?"overturned":"unproven"}</span>`)).join("");
  const c3=()=>{const L=oblsOf(next.id),n=s=>L.filter(o=>o.state===s).length;
    const P=[{n:n("Verified"),c:"var(--brand-deep)",l:"verified"},{n:n("Validated"),c:"var(--mint)",l:"validated"},{n:n("Submitted"),c:"var(--warn)",l:"submitted"},{n:n("Assigned"),c:"color-mix(in srgb,var(--muted) 30%,var(--sunk))",l:"assigned"},{n:n("Rejected"),c:"var(--bad)",l:"rejected"}];
    return `<div class="v3">${ringV(P,(P[0].n+P[1].n)+"/"+L.length,"proven")}<div class="v3-side"><div class="v3-name">${esc(venueMeta(next.id).name)}</div><div class="flex"><span class="pill p-mute">${next.gate.id} · ${fmtD(next.gateDate)}</span><span class="pill ${ge.pass?"p-good":"p-bad"}">${ge.pass?"Gate rules met":"Gate rules failing"}</span></div><div class="v3-days"><b>${next.gateDays}</b> days to inspection</div></div></div>${legV(P)}`};
  const c3rows=()=>gaps.slice(0,3).map(o=>rowV(`<button class="linkish" data-obl="${o.id}">${o.code}</button>`,esc(o.text),`<span class="pill ${stateCls(o.state)}">${o.state}</span>`)).join("");
  const c4=()=>kpiV(openD.length,"decision"+(openD.length===1?"":"s")+" open",openD.length?"t-warn":"t-good")+openD.slice(0,3).map(d=>{const c=d.left<21?"bad":d.left<90?"warn":"good",w=Math.max(6,Math.min(100,Math.round(d.left/365*100)));
    return `<div class="drow"><div class="dday ${c}"><b>${Math.max(d.left,0)}</b><span>days</span></div><div class="dmain"><b>${d.id} · ${esc(d.title)}</b><span>Decide by ${fmtD(d.lrm)}</span><div class="mb-tr"><i class="p-${c}" style="width:${w}%"></i></div></div></div>`}).join("")+(undecided.length?`<div class="vs-note">${undecided.length} late venue${undecided.length>1?"s have":" has"} no decision raised yet</div>`:"");
  const vsCol=(lbl,x,hl)=>`<div class="vs-col ${hl?"hl":""}"><div class="vs-l">${lbl}</div><div class="vs-n">${pct(x.prob)}<small>%</small></div><div class="mb-tr big"><i class="${kc(x)}" style="width:${pct(x.prob)}%"></i></div><div class="vs-d">P80 ${fmtD(x.d80)}</div><span class="pill ${x.late80>0?"p-bad":"p-good"}">${x.late80>0?dd(x.late80)+" late":"inside milestone"}</span></div>`;
  let q5;
  if(worst&&worst.late80>0){
    if(scn.recovery.includes(worst.id)) q5={ans:`A recovery team is already deployed at ${esc(sn(worst.id))}. P80 is still ${dd(worst.late80)} after the milestone, so the next lever is scope or a re-baseline with FIFA.`,vis:`<div class="vs one">${vsCol("With recovery team",worst,true)}</div><div class="vs-note">${esc(sn(worst.id))} · milestone ${fmtD(worst.gateDate)}</div>`};
    else{const alt=forecast(worst.id,Object.assign({},scn,{recovery:scn.recovery.concat(worst.id)}));
      q5={ans:`A recovery team at ${esc(sn(worst.id))} moves P80 from ${fmtD(worst.d80)} to ${fmtD(alt.d80)}, ${alt.late80>0?`still ${dd(alt.late80)} late`:"inside the milestone"}.`,vis:`<div class="vs">${vsCol("Now",worst)}<div class="vs-ar" aria-hidden="true">→</div>${vsCol("With recovery",alt,true)}</div><div class="vs-note">${esc(sn(worst.id))} · milestone ${fmtD(worst.gateDate)}</div>`};}
  } else q5={ans:"No venue is late at P80 under this scenario. No recovery is needed yet.",vis:`<div class="okbig"><i>✓</i><span>No recovery needed</span></div>`};
  const c6=()=>{const ow=Object.entries(byOwner).sort((a,b)=>b[1].c-a[1].c||b[1].n-a[1].n).slice(0,4),mx=Math.max(1,...ow.map(([,k])=>k.n)),nc=ext.filter(o=>o.crit==="Critical").length;
    return kpiV(ext.length,"unproven, held by<br>outside parties","t-warn")+`<div class="hbs">${ow.map(([n,k])=>hbV(esc(n),[{n:k.c,k:"crit"},{n:k.n-k.c,k:"oth"}],k.n,mx)).join("")}</div><div class="leg"><span><i class="crit"></i>${nc} Critical</span><span><i class="oth"></i>${ext.length-nc} other</span></div>`};
  const c7=()=>`<div class="mini-grid">${[[escs,"escalations","bad"],[rej,"rejections","bad"],[ver,"validated or verified","good"],[decl,"new declarations","warn"]].map(([n,l,c])=>`<div class="mini ${c}"><b>${n}</b><span>${l}</span></div>`).join("")}</div>`;
  const c7rows=()=>{const g=[];recent.slice().reverse().forEach(a=>{const k=a.actor+"|"+a.action,l=g.find(x=>x.k===k);if(l)l.n++;else g.push({k,a,n:1});});
    return g.slice(0,3).map(x=>`<div class="tl-i"><span class="tl-d">${fmtD(x.a.t)}</span><span class="tl-t"><b>${esc(x.a.actor)}</b> ${esc(x.a.action)}${x.n>1?` (${x.n} items)`:""}</span></div>`).join("")};
  const c8=()=>{const rk=ownRank.slice(0,4),mx=Math.max(1,...rk.map(x=>x.r+x.o));
    if(!rk.length) return `<div class="okbig"><i>✓</i><span>No owner is behind</span></div>`;
    return kpiV(esc(rk[0].n),"carries the most slippage","t-bad tx")+`<div class="hbs">${rk.map(x=>hbV(esc(x.n),[{n:x.r,k:"crit"},{n:x.l,k:"late"},{n:x.o-x.l,k:"oth"}],x.r+x.o,mx)).join("")}</div><div class="leg"><span><i class="crit"></i>rejected</span><span><i class="late"></i>late or escalated</span><span><i class="oth"></i>open action</span></div>`};
  // Q6 external
  const ext=S.obligations.filter(o=>EXTERNAL.includes(o.owner)&&!(o.state==="Validated"||o.state==="Verified"));
  const byOwner={}; ext.forEach(o=>{const k=byOwner[o.owner]||(byOwner[o.owner]={n:0,c:0});k.n++;if(o.crit==="Critical")k.c++;});
  // Q7 last 7 days
  const since=addDays(S.today,-7);
  const recent=S.audit.filter(a=>a.t>since);
  const escs=S.issues.flatMap(i=>i.history.filter(h=>h.t>since&&/scalat/.test(h.a))).length;
  const rej=recent.filter(a=>/rejected|no longer meets/i.test(a.action)).length, decl=recent.filter(a=>/declared/i.test(a.action)).length, ver=recent.filter(a=>/Verified|validated/i.test(a.action)).length;
  // Q8 owners
  const own={}; S.obligations.forEach(o=>{const k=own[o.owner]||(own[o.owner]={r:0,o:0,l:0});if(o.state==="Rejected")k.r++;});
  S.issues.filter(i=>i.status==="Open").forEach(i=>{const o=S.obligations.find(x=>x.id===i.obl);const k=own[o.owner];k.o++;if(S.today>i.due||i.level>0)k.l++;});
  const ownRank=Object.entries(own).map(([n,k])=>({n,...k,s:k.r*2+k.l*2+k.o})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s);
  const recChips=scn.recovery.map(id=>`<span class="chipx">Recovery: ${esc(sn(id))}<button data-unrecover="${id}" aria-label="Remove recovery at ${esc(sn(id))}">×</button></span>`).join("");
  const sc=scores(S.obligations);
  const worstTxt=worst&&worst.late80>0?`<b>${esc(sn(worst.id))}</b> is the biggest risk: a ${pct(worst.prob)}% chance of meeting its milestone and a P80 ${dd(worst.late80)} late${pmcSaysOk?", while the PMC schedule shows it on time":""}.`:"No venue is late at P80 under this scenario.";
  return headV(
  `Readiness Room · ${f.length} venues · sample data`,
  "Three signals that decide whether we make the next FIFA gate.",
  "Answers come from validated evidence-based forecast."
) + aiExecSummary() + `
  
<!--
<section class="rr-hero"><div class="sig-grid">
    <article class="sig s1"><div class="sig-k"><i>1</i>GATE CONFIDENCE</div><div class="sig-v">${on80.length}<small>of ${f.length} venues</small></div><div class="sig-t">make their next FIFA gate at 80% confidence${on50.length>on80.length?` (${on50.length} at 50%)`:""}</div>
      ${f.map(x=>`<div class="mb"><span>${esc(sn(x.id))}</span><div class="mb-tr"><i class="${x.cls}" style="width:${pct(x.prob)}%"></i></div><b>${pct(x.prob)}%</b></div>`).join("")}</article>
    <article class="sig s2"><div class="sig-k"><i>2</i>ASSURANCE GAP</div><div class="sig-v">${pct(sc.declared-sc.assured)}<small>points</small></div><div class="sig-t">between what owners declare and what evidence proves</div>
      <div class="bar2"><div class="row"><span>Declared by owners</span><b>${pct(sc.declared)}%</b></div><div class="tr"><i class="d" style="width:${pct(sc.declared)}%"></i></div></div>
      <div class="bar2"><div class="row"><span>Proven by evidence</span><b>${pct(sc.assured)}%</b></div><div class="tr"><i class="a" style="width:${pct(sc.assured)}%"></i></div></div>
      <span class="pill ${claims.length?"p-warn":"p-good"}" style="align-self:flex-start;margin-top:6px">${claims.length} declared, not proven</span></article>
    <article class="sig s3"><div class="sig-k"><i>3</i>DECISIONS</div><div class="sig-v">${openD.length}<small>open</small></div><div class="sig-t">${openD[0]?`Next decision due ${fmtD(openD[0].lrm)}`:"Nothing is waiting on you"}</div>
      <ul class="dlist">${openD.slice(0,3).map(d=>`<li><b>${d.id} · ${esc(d.title)}</b><span>Decide by ${fmtD(d.lrm)}</span></li>`).join("")}</ul></article>
  </div>
  <div class="means"><b class="k">✧ What this means</b>${on80.length} of ${f.length} venues make their next gate with 80% confidence. ${worstTxt}</div></section>
-->
  
  <section class="panel" id="fcPanel"><div class="eyebrow">✧ AI forecast · 1,000 simulated runs</div><div class="qhead"><span class="qnum">1</span><h3>Will we make our next FIFA gates, and how confident are we?</h3></div>
    <p class="muted" style="margin:0 0 18px;max-width:84ch">Each bar runs from P50 to P80: the dates by which the gate rules are met in 50% and 80% of 1,000 simulated runs. The runs start from what evidence has proven, not from reported percent complete. The hollow circle is the PMC's deterministic finish.</p>
    <div class="scn" role="group" aria-label="Scenario"><b>Scenario</b>
      <label for="scProd">Delivery rate <select id="scProd">${[[0.8,"Faster (+20%)"],[1,"As planned"],[1.25,"Slower (−20%)"]].map(([v,l])=>`<option value="${v}" ${v===scn.prod?"selected":""}>${l}</option>`).join("")}</select></label>
      <label for="scFifa"><input type="checkbox" id="scFifa" ${scn.fifa?"checked":""}> FIFA changes requirements mid-programme</label>
      ${recChips}${scn.prod!==1||scn.fifa||scn.recovery.length?`<button class="ghost" id="scReset">Reset scenario</button>`:""}</div>
    ${fcChart(f)}
    <details class="fc-table"><summary>Show as table</summary><div class="tablewrap" style="margin-top:8px"><table><thead><tr><th>Venue</th><th>Gate</th><th>FIFA milestone</th><th>PMC finish</th><th>P50</th><th>P60</th><th>P80</th><th>On time</th></tr></thead><tbody>
      ${f.map(x=>`<tr><td>${esc(sn(x.id))}</td><td>${x.gate.id}</td><td class="mono">${fmtD(x.gateDate)}</td><td class="mono">${fmtD(x.pmc.finish)}</td><td class="mono">${fmtD(x.d50)}</td><td class="mono">${fmtD(x.d60)}</td><td class="mono">${fmtD(x.d80)}</td><td>${pct(x.prob)}%</td></tr>`).join("")}</tbody></table></div></details>
  </section>
  <div class="qgrid">
    ${qcard(2,"Which greens are false?",c2(),`${claims.length} items owners declared complete are not proven. ${overturned.length} ${overturned.length===1?"was":"were"} overturned by evidence.${designOnly.length?` ${designOnly.length} more are proven on drawings only, where the gate needs the built asset.`:""}`,c2rows(),"ev","owner declarations vs evidence",`<button class="linkish" data-goto="register">Register</button>`)}
    ${qcard(3,"Where will FIFA push back at the next inspection?",c3(),`${esc(venueMeta(next.id).name)} is next (${next.gate.id} on ${fmtD(next.gateDate)}). ${ge.pass?"It meets the gate rules, but":"It fails the gate rules, and"} FIFA would still question ${gaps.length} Critical or High item${gaps.length===1?"":"s"} not yet verified.`,c3rows(),"ev","whole-venue evidence check",`<button class="linkish" data-dossier="${next.id}">Dossier</button>`)}
    ${qcard(4,"What do I need to decide, and by when?",c4(),openD.length?`The first decision must be taken by ${fmtD(openD[0].lrm)}, ${openD[0].left<0?`${dd(openD[0].left)} ago`:`in ${dd(openD[0].left)}`}.`:"No decisions are waiting.","","dl","last responsible moment per decision",`<button class="linkish" data-goto="actions">Decisions</button>`)}
    ${qcard(5,"What would it take to recover the worst venue?",q5.vis,q5.ans,"","fc","recovery scenario re-run",worst&&worst.late80>0?`<button class="linkish" data-goto="actions">Decide</button>`:"")}
    ${qcard(6,"What depends on parties outside the programme?",c6(),`${ext.length} unproven obligations sit with external owners, ${ext.filter(o=>o.crit==="Critical").length} of them Critical.`,"","ev","owner register",`<button class="linkish" data-goto="register">Register</button>`)}
    ${qcard(7,"What changed in the last 7 days?",c7(),`${recent.length} recorded events since ${fmtD(since)}.`,c7rows(),"ev","audit trail",`<button class="linkish" data-goto="tower">Activity</button>`)}
    ${qcard(8,"Who is not delivering?",c8(),ownRank.length?`${ownRank.length} owner${ownRank.length===1?"":"s"} with rejections, open actions or late items.`:"No owner is behind.","","ev","rejections, actions and SLA history",`<button class="linkish" data-goto="actions">Escalations</button>`)}
  </div>`;
}
