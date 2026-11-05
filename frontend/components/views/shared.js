import {decisionOptionLabel,hasDecisionForecast} from "../../lib/decision-records.mjs";
// ---------- visual helpers & shared cards (used by several pages) ----------
import {GATES,LEVELS,esc,fmtN,fmtD,pct,sn,dd,daysBetween,stateCls,venueMeta} from "../../lib/data";
import {S} from "../../lib/state";
import {depBlocked,isProven} from "../../lib/scoring";
import {forecasts} from "../../lib/forecast";
import {decRec} from "../../lib/actions";

export const legV=P=>`<div class="leg">${P.filter(p=>p.n>0).map(p=>`<span><i style="background:${p.c}"></i>${p.n} ${p.l}</span>`).join("")}</div>`;
export const segV=P=>{const t=P.reduce((a,p)=>a+p.n,0)||1;return `<div class="segbar">${P.filter(p=>p.n>0).map(p=>`<i style="width:${p.n/t*100}%;background:${p.c}" title="${p.n} ${p.l}"></i>`).join("")}</div>`};
export const ringV=(P,c,s,cls)=>{const t=P.reduce((a,p)=>a+p.n,0)||1;let a=0;const st=P.filter(p=>p.n>0).map(p=>{const s0=a/t*100;a+=p.n;return `${p.c} ${s0}% ${a/t*100}%`}).join(",");return `<div class="ring ${cls||""}" style="background:conic-gradient(${st||"var(--sunk) 0 100%"})"><div class="ring-in"><b>${c}</b><span>${s}</span></div></div>`};
export const rowV=(l,m,r)=>`<div class="qrow"><span class="qr-id">${l}</span><span class="qr-t">${m}</span>${r}</div>`;
export const kpiV=(n,l,c)=>`<div class="kpi"><b class="${c||""}">${n}</b><span>${l}</span></div>`;
export const hbV=(name,segs,total,mx)=>`<div class="hb"><span class="hb-l" title="${name}">${name}</span><div class="hb-tr">${segs.filter(s=>s.n>0).map(s=>`<i class="${s.k}" style="width:${s.n/mx*100}%"></i>`).join("")}</div><b>${total}</b></div>`;
export const barV=(p,c)=>`<div class="mb-tr"><i class="${c||""}" style="width:${Math.max(0,Math.min(100,p))}%"></i></div>`;
export const STC={Verified:"var(--brand-deep)",Validated:"var(--mint)",Submitted:"var(--warn)",Assigned:"color-mix(in srgb,var(--muted) 30%,var(--sunk))",Rejected:"var(--bad)"};
export const stP=list=>["Verified","Validated","Submitted","Assigned","Rejected"].map(s=>({n:list.filter(o=>o.state===s).length,c:STC[s],l:s.toLowerCase()}));
export const gtrackV=idx=>`<ol class="gtk">${GATES.map((g,i)=>`<li class="${i<idx?"done":i===idx?"cur":""}"><i>${i<idx?"✓":i+1}</i><b>${g.id}</b><span>${esc(g.name)}</span></li>`).join("")}</ol>`;
export const gdotsV=idx=>`<span class="gdots" role="img" aria-label="Gate ${Math.min(idx+1,GATES.length)} of ${GATES.length}">${GATES.map((g,i)=>`<i class="${i<idx?"done":i===idx?"cur":""}" title="${g.id} ${esc(g.name)}"></i>`).join("")}</span>`;
export const headV=(chip,title,lead)=>`<div class="page-head"><span class="eyebrow-chip">${chip}</span><h2>${title}</h2><p class="lead">${lead}</p></div>`;
export const critV=c=>`<span class="crit c-${c}"><i></i>${c}</span>`;
export const probCls=p=>p>=0.8?"p-good":p>=0.5?"p-warn":"p-bad";
export const vsV=(l,prob,d80,late,hl)=>`<div class="vs-col ${hl?"hl":""}"><div class="vs-l">${l}</div><div class="vs-n">${pct(prob)}<small>%</small></div>${barV(pct(prob),probCls(prob))}<div class="vs-d">P80 ${fmtD(d80)}</div><span class="pill ${late>0?"p-bad":"p-good"}">${late>0?dd(late)+" late":"inside milestone"}</span></div>`;
export const crumbV=label=>`<nav class="crumbs" aria-label="Breadcrumb"><a href="#tower">← Control Tower</a><span aria-hidden="true">/</span><b>${label}</b></nav>`;

export const oblRowsV=list=>list.map(o=>{const d=depBlocked(o);return `<tr class="click" data-obl="${o.id}" tabindex="0"><td class="mono">${o.id}</td><td>${esc(o.text)}<div class="muted" style="font-size:12px">${esc(venueMeta(o.venue).name)} · ${esc(o.clause)}</div>${d?`<div style="font-size:12px;color:var(--warn)">Blocked by ${d.id}</div>`:""}</td><td class="mono">${esc(o.op==="bool"?"yes":({min:"≥ ",max:"≤ ",eq:"= "}[o.op]+fmtN(o.value)+" "+o.unit))}</td><td>${critV(o.crit)}</td><td>${esc(o.owner)}</td><td><span class="gchip">${o.gate}</span></td><td><span class="pill ${stateCls(o.state)}">${o.state}</span>${o.claim&&o.state!=="Validated"&&o.state!=="Verified"?`<div class="muted" style="font-size:11.5px;margin-top:3px">Owner says done</div>`:""}</td></tr>`}).join("");

export function gateCardV(m,v,e){
  const track=gtrackV(v.gateIdx);
  if(!e) return `<div class="panel gcard" id="gate-${m.id}"><div class="gc-head"><div><h3>${esc(m.name)}</h3><div class="muted" style="font-size:13px">${esc(m.city)}</div></div><span class="pill p-good">All gates passed</span></div>${track}<div class="okbig"><i>✓</i><span>All gates passed</span></div></div>`;
  const okN=e.rules.filter(r=>r.ok).length, ring=ringV([{n:okN,c:"var(--good)"},{n:e.rules.length-okN,c:"var(--bad)"}],`${okN}/${e.rules.length}`,"rules pass","sm");
  return `<div class="panel gcard" id="gate-${m.id}">
      <div class="gc-head"><div style="min-width:0"><h3>${esc(m.name)}</h3><div class="muted" style="font-size:13px">${esc(m.city)} · gate <b>${e.gate.id} ${esc(e.gate.name)}</b> due ${fmtD(v.gateDate)} · ${e.scope.length} obligations in scope</div></div><span class="pill ${e.pass?"p-good":"p-bad"}">${e.pass?"Ready to pass":"Gate blocked"}</span></div>
      ${track}
      <div class="gc-body"><ul class="rules">${e.rules.map(r=>`<li class="${r.ok?"ok":"no"}"><span class="ic ${r.ok?"ok":"no"}" aria-hidden="true">${r.ok?"✓":"✕"}</span><div style="min-width:0"><div class="rt">${esc(r.text)}</div>${r.ok?"":`<div class="bch">${r.blockers.slice(0,6).map(o=>`<button class="bchip" data-obl="${o.id}">${o.code}<small>${o.state}</small></button>`).join("")}${r.blockers.length>6?`<span class="muted" style="font-size:12px">and ${r.blockers.length-6} more</span>`:""}</div>`}</div></li>`).join("")}</ul>
        <div class="gc-side">${ring}<button class="${e.pass?"gold":""}" data-gate="${m.id}">Request gate pass</button>${e.pass?"":`<button class="danger" data-escalate-gate="${m.id}">Escalate blockers</button>`}</div></div></div>`;
}

export const LV_COLS=["var(--mint)","var(--warn)","var(--bad)","var(--brand-deep)"];
export function issueCardV(i){
  const o=S.obligations.find(x=>x.id===i.obl), isOpen=i.status==="Open", start=i.opened||(i.history[0]&&i.history[0].t)||S.today;
    const left=daysBetween(S.today,i.due), tot=Math.max(1,daysBetween(start,i.due)), el=daysBetween(start,S.today), p=isOpen?Math.max(2,Math.min(100,el/tot*100)):100, lt=isOpen&&left<0;
    const cls=!isOpen?"p-good":lt?"p-bad":p>70?"p-warn":"p-good";
    return `<article class="issue ${lt?"late":""} ${isOpen?"":"closed"}"><div class="is-top"><span class="mono muted">${i.id}</span>${critV(i.crit)}<span class="spacer"></span>${isOpen?`<span class="pill ${lt?"p-bad":"p-mute"}">${lt?"Past SLA":"Within SLA"}</span>`:`<span class="pill p-good">Closed by evidence</span>`}</div>
      <h3>${esc(i.title)}</h3><div class="muted" style="font-size:13px"><button class="linkish" data-obl="${o.id}">${o.id}</button> · ${esc(venueMeta(o.venue).name)}</div>
      <div class="lvl"><div class="lvl-dots">${LEVELS.map((l,k)=>`<i class="${k<=i.level?"on":""}" style="${k<=i.level?"background:"+LV_COLS[k]:""}" title="${esc(l)}"></i>`).join("")}</div><span>${esc(LEVELS[i.level])}</span></div>
      <div class="sla"><div class="sla-l"><span>${isOpen?(lt?`${dd(left)} late`:`${dd(left)} left`):`Closed ${fmtD(i.closed)}`}</span><b>${isOpen?"Due "+fmtD(i.due):"SLA met"}</b></div>${barV(p,cls)}</div>
      <details class="hist"><summary>History · ${i.history.length} event${i.history.length===1?"":"s"}</summary><div class="tl">${i.history.map(h=>`<div class="tli mid"><i></i><div><span class="mono muted">${fmtD(h.t)}</span><div>${esc(h.a)}</div></div></div>`).join("")}</div></details>
      ${isOpen&&i.level<LEVELS.length-1?`<div class="flex"><button data-esc="${i.id}">Escalate to ${esc(LEVELS[i.level+1])}</button></div>`:""}</article>`;
}
export function ladderV(open){
  const counts=LEVELS.map((_,l)=>open.filter(i=>i.level===l).length), mx=Math.max(1,...counts);
  return `<div class="ladder">${LEVELS.map((l,i)=>`<div class="rung"><div class="lv">Level ${i+1}</div><div class="ct">${counts[i]}</div><div style="font-size:13px;font-weight:500">${esc(l)}</div><div class="mb-tr"><i style="width:${counts[i]/mx*100}%;background:${LV_COLS[i]}"></i></div></div>`).join("")}</div>`;
}

export const DEC_HINT={recover:"Deploys a recovery team",rebase:"Re-baselines the milestone by 90 days"};
export function decisionCardV(d,f){
  f=f||forecasts();
  const r=decRec(d.id),x=f.find(y=>y.id===d.venue),left=daysBetween(S.today,d.lrm),open=r.status==="Open";
    const c=!open?"mute":left<21?"bad":left<90?"warn":"good";
    const badge=open?`<div class="dday lg ${c}"><b>${Math.abs(left)}</b><span>${left<0?"days over":"days left"}</span></div>`:`<div class="dday lg mute"><b>✓</b><span>decided</span></div>`;
    const stat=open?(left<0?`Last responsible moment passed ${dd(left)} ago`:`Decide by ${fmtD(d.lrm)}`):(r.t?`Decided ${fmtD(r.t)}`:"Decision recorded · date unavailable");
    const vis=open?(x?`<div class="dvis"><div class="dv-l"><span>Chance of meeting the ${fmtD(x.gateDate)} milestone</span><b>${pct(x.prob)}%</b></div>${barV(pct(x.prob),probCls(x.prob))}<div class="flex"><span class="pill ${x.cls}">P80 ${fmtD(x.d80)}</span><span class="pill ${x.late80>0?"p-bad":"p-good"}">${x.late80>0?dd(x.late80)+" late":"inside milestone"}</span></div></div>`:""):
      (hasDecisionForecast(r)?`<div class="vs">${vsV("Before",r.beforeProb,r.before,r.beforeLate)}<div class="vs-ar" aria-hidden="true">→</div>${vsV("After",r.afterProb,r.after,r.afterLate,true)}</div>`:`<p class="muted">Historical forecast comparison was not stored with this decision.</p>`);
    const opts=open?`<div class="opts">${d.options.map((o,i)=>`<button class="opt ${i===0?"primary":""}" data-decide="${d.id}" data-opt="${i}"><b>${esc(o.t)}</b>${DEC_HINT[o.fx]&&!/recover/i.test(o.t)?`<small>${DEC_HINT[o.fx]}</small>`:""}</button>`).join("")}</div>`:`<div class="done"><span class="eyebrow">Option taken</span><b>${esc(decisionOptionLabel(d,r))}</b></div>`;
    return `<article class="dec ${open?"":"isdone"}" id="dec-${d.id}">
      <div class="dec-top">${badge}<div class="dec-main"><div class="mono muted" style="font-size:12px">${d.id} · ${esc(sn(d.venue))} · owner ${esc(d.owner)}</div><h3>${esc(d.title)}</h3><p>${esc(d.q)}</p><div class="flex"><span class="pill ${open?(left<21?"p-bad":left<90?"p-warn":"p-info"):"p-mute"}">${stat}</span></div></div></div>
      ${vis?`<div class="dec-vis">${vis}</div>`:""}${opts}</article>`;
}
export {isProven};
