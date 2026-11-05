// ---------- AI assistant (frontend-only PoC, answers computed from live state) ----------
import {VENUES,EXTERNAL,LEVELS,esc,fmtD,pct,sn,dd,daysBetween,venueMeta,decMeta,stateCls} from "../../lib/data";
import {S,ai} from "../../lib/state";
import {scores,oblsOf,gateEval,isProven} from "../../lib/scoring";
import {forecasts} from "../../lib/forecast";

const AI_CHIPS=["Which venue is highest risk?","Why is Jeddah at risk?","What are the false greens?","Which critical obligations are unverified?","What is blocking Jeddah's gate?","What decisions are open?","Which actions are overdue?","What external dependencies exist?","What evidence was uploaded?","What is the P80 outlook?"];
const aiUl=items=>`<ul class="ai-ul">${items.map(x=>`<li>${x}</li>`).join("")}</ul>`;
export function aiVenue(t){return VENUES.find(v=>t.includes(v.city.toLowerCase())||t.includes(v.name.toLowerCase())||t.includes(v.id.toLowerCase())||t.includes(sn(v.id).toLowerCase()));}
export function aiAnswer(q){
  const t=q.toLowerCase(), f=forecasts(), vm=aiVenue(t);
  const worst=f.slice().sort((a,b)=>a.prob-b.prob||b.late80-a.late80)[0];
  if(/false green|overturn|declared.*(not|un).*(proven|verified)/.test(t)){
    const claims=S.obligations.filter(o=>o.claim&&!isProven(o)), ov=claims.filter(o=>o.state==="Rejected");
    if(!claims.length) return `No false greens right now: every owner declaration is backed by validated evidence.`;
    return `${claims.length} obligation${claims.length===1?" is":"s are"} declared complete by owners but not proven; ${ov.length} ${ov.length===1?"was":"were"} overturned by evidence.`+aiUl(claims.slice(0,6).map(o=>`<b>${o.id}</b> · ${esc(o.text)} · ${esc(sn(o.venue))} · <span class="pill ${o.state==="Rejected"?"p-bad":"p-warn"}">${o.state==="Rejected"?"overturned":"unproven"}</span>`))+(claims.length>6?`…and ${claims.length-6} more in the <a href="#register">register</a>.`:"");
  }
  if(/critical/.test(t)&&/unverified|not verified|unproven|open|outstanding/.test(t)){
    const L=S.obligations.filter(o=>o.crit==="Critical"&&o.state!=="Verified"&&(!vm||o.venue===vm.id));
    if(!L.length) return `Every Critical obligation${vm?` at ${esc(vm.name)}`:""} is verified by the second line.`;
    return `${L.length} Critical obligation${L.length===1?" is":"s are"} not yet verified${vm?` at ${esc(vm.name)}`:""}:`+aiUl(L.slice(0,8).map(o=>`<b>${o.id}</b> · ${esc(o.text)} · <span class="pill ${stateCls(o.state)}">${o.state}</span>`))+(L.length>8?`…and ${L.length-8} more.`:"");
  }
  if(/block|gate.*(fail|hold|stuck)|pass.*gate|gate.*pass/.test(t)){
    const id=vm?vm.id:(worst?worst.id:null), e=id&&gateEval(id);
    if(!e) return `${vm?esc(vm.name):"That venue"} has passed all its gates.`;
    const bad=e.rules.filter(r=>!r.ok);
    if(!bad.length) return `${esc(venueMeta(id).name)} currently meets all four rules for ${e.gate.id} ${esc(e.gate.name)} — it is ready to request the gate pass.`;
    return `${esc(venueMeta(id).name)} is blocked at ${e.gate.id} ${esc(e.gate.name)} by ${bad.length} failing rule${bad.length===1?"":"s"}:`+aiUl(bad.map(r=>`${esc(r.text)}${r.blockers.length?` — blockers: ${r.blockers.slice(0,4).map(o=>`<b>${o.code}</b> (${o.state})`).join(", ")}${r.blockers.length>4?" …":""}`:""}`))+`See the <a href="#venue-${id}">venue detail page</a>.`;
  }
  if(/why.*(risk|late|behind)|what.*wrong/.test(t)){
    const id=vm?vm.id:(worst&&worst.late80>0?worst.id:null);
    if(!id) return `No venue is late at P80 under the current scenario, so nothing needs a recovery story right now.`;
    const x=f.find(y=>y.id===id), e=gateEval(id), list=oblsOf(id), rej=list.filter(o=>o.state==="Rejected"), open=S.issues.filter(i=>i.status==="Open"&&list.some(o=>o.id===i.obl)), bad=e?e.rules.filter(r=>!r.ok):[];
    return `${esc(venueMeta(id).name)}: ${x?`the evidence-based forecast gives a ${pct(x.prob)}% chance of meeting ${x.gate.id} on ${fmtD(x.gateDate)}; P80 lands ${fmtD(x.d80)}${x.late80>0?` (${dd(x.late80)} late)`:""}${x.pmcLate<=0?", while the PMC schedule still shows it on time":""}.`:"all gates are passed."} Drivers: ${rej.length} rejected evidence item${rej.length===1?"":"s"}${rej.length?` (${rej.slice(0,3).map(o=>o.code).join(", ")})`:""}, ${open.length} open corrective action${open.length===1?"":"s"}, ${bad.length} failing gate rule${bad.length===1?"":"s"}.${S.scn.recovery.includes(id)?" A recovery team is already deployed.":""} See the <a href="#venue-${id}">venue detail page</a>.`;
  }
  if(/highest risk|biggest risk|worst|most at risk|riskiest/.test(t)){
    if(!worst) return `All venues have passed their gates.`;
    const second=f.slice().sort((a,b)=>a.prob-b.prob)[1];
    return `<b>${esc(sn(worst.id))}</b> is the highest-risk venue: a ${pct(worst.prob)}% chance of meeting its ${worst.gate.id} milestone on ${fmtD(worst.gateDate)}, with P80 ${worst.late80>0?dd(worst.late80)+" late":"inside the milestone"}.${second?` Next is ${esc(sn(second.id))} at ${pct(second.prob)}%.`:""} See the <a href="#venue-${worst.id}">venue detail page</a>.`;
  }
  if(/decision/.test(t)){
    const openD=S.decisions.filter(d=>d.status==="Open").map(d=>Object.assign({},decMeta(d.id),{left:daysBetween(S.today,decMeta(d.id).lrm)})).sort((a,b)=>a.left-b.left);
    if(!openD.length) return `No executive decisions are open. ${S.decisions.length} have been taken — see <a href="#actions">Decisions & Actions</a>.`;
    return `${openD.length} executive decision${openD.length===1?" is":"s are"} open:`+aiUl(openD.map(d=>`<b>${d.id}</b> · ${esc(d.title)} · decide by ${fmtD(d.lrm)} (${d.left<0?dd(d.left)+" over":dd(d.left)+" left"})`))+`Take them in <a href="#actions">Decisions & Actions</a>.`;
  }
  if(/overdue|past sla|late action|missed.*(sla|deadline)/.test(t)){
    const od=S.issues.filter(i=>i.status==="Open"&&S.today>i.due);
    if(!od.length) return `No open corrective action is past its SLA as of ${fmtD(S.today)}.`;
    return `${od.length} corrective action${od.length===1?" is":"s are"} past SLA:`+aiUl(od.map(i=>`<b>${i.id}</b> · ${esc(i.title)} · at ${esc(LEVELS[i.level])} · due ${fmtD(i.due)}`))+`See <a href="#actions">Decisions & Actions</a>.`;
  }
  if(/external|outside|third.?part|dependenc/.test(t)){
    const ext=S.obligations.filter(o=>EXTERNAL.includes(o.owner)&&!isProven(o)&&(!vm||o.venue===vm.id));
    if(!ext.length) return `No unproven obligations sit with parties outside the programme${vm?` at ${esc(vm.name)}`:""}.`;
    const by={}; ext.forEach(o=>{(by[o.owner]=by[o.owner]||[]).push(o)});
    return `${ext.length} unproven obligation${ext.length===1?" sits":"s sit"} with external owners (${ext.filter(o=>o.crit==="Critical").length} Critical):`+aiUl(Object.entries(by).map(([k,L])=>`<b>${esc(k)}</b> · ${L.length} item${L.length===1?"":"s"} (${L.slice(0,3).map(o=>o.code).join(", ")}${L.length>3?" …":""})`));
  }
  if(/evidence.*(upload|submit|recent|new)|uploaded|submitted/.test(t)){
    const ev=S.audit.filter(a=>/submitted evidence|declared complete/i.test(a.action)).slice(-6).reverse();
    if(!ev.length) return `No evidence submissions are recorded in the audit trail yet.`;
    return `Most recent evidence submissions:`+aiUl(ev.map(a=>`${fmtD(a.t)} · <b>${esc(a.actor)}</b> ${esc(a.action)}${a.obl?` (${esc(a.obl)})`:""}`));
  }
  if(/p80|p50|outlook|forecast|on (time|track)|confiden/.test(t)){
    const on80=f.filter(x=>x.late80<=0);
    return `${on80.length} of ${f.length} venues make their next FIFA gate at 80% confidence (scenario: delivery ${S.scn.prod===1?"as planned":S.scn.prod<1?"faster":"slower"}${S.scn.fifa?", FIFA mid-programme changes on":""}${S.scn.recovery.length?`, recovery at ${S.scn.recovery.map(sn).join(", ")}`:""}).`+aiUl(f.map(x=>`<b>${esc(sn(x.id))}</b> · ${x.gate.id} · ${pct(x.prob)}% on time · P80 ${fmtD(x.d80)} <span class="pill ${x.cls}">${x.status}</span>`));
  }
  if(/assurance gap|declared|gap/.test(t)){
    const sc=scores(S.obligations);
    return `Owners declare ${pct(sc.declared)}% readiness; validated evidence proves ${pct(sc.assured)}%. The assurance gap is <b>${pct(sc.declared-sc.assured)} points</b> — the risk a status report would hide.`;
  }
  if(vm){
    const list=oblsOf(vm.id), sc=scores(list), x=f.find(y=>y.id===vm.id), e=gateEval(vm.id), open=S.issues.filter(i=>i.status==="Open"&&list.some(o=>o.id===i.obl));
    return `<b>${esc(vm.name)}</b> (${esc(vm.city)}): assured readiness ${pct(sc.assured)}%, declared ${pct(sc.declared)}%, ${list.filter(isProven).length}/${list.length} obligations proven, ${open.length} open issue${open.length===1?"":"s"}. ${x?`Next gate ${x.gate.id} due ${fmtD(x.gateDate)}: ${pct(x.prob)}% on time, P80 ${fmtD(x.d80)}.`:"All gates passed."} ${e&&!e.pass?`The gate is currently blocked (${e.rules.filter(r=>!r.ok).length} rule${e.rules.filter(r=>!r.ok).length===1?"":"s"} failing).`:""} See the <a href="#venue-${vm.id}">venue detail page</a>.`;
  }
  return `I answer deterministic questions from the live demo state (no model behind me yet). Try one of the suggested questions below, or ask about a venue by name, false greens, gate blockers, decisions, overdue actions, external dependencies, evidence or the P80 outlook.`;
}
export function renderAIMsgs(){
  const box=document.getElementById("aiMsgs"); if(!box) return;
  box.innerHTML=ai.msgs.map(m=>`<div class="ai-msg ${m.who}">${m.who==="u"?esc(m.html):m.html}</div>`).join("");
  box.scrollTop=box.scrollHeight;
}
export function aiAsk(q){
  if(!q) return;
  ai.msgs.push({who:"u",html:q});
  ai.msgs.push({who:"a",html:aiAnswer(q)});
  renderAIMsgs();
}
export function mountAI(){
  const r=document.getElementById("aiRoot"); if(!r||r.dataset.mounted) return;
  r.dataset.mounted="1";
  r.innerHTML=`<button class="ai-fab" id="aiFab" type="button" aria-haspopup="dialog" aria-expanded="false">✦ Ask AI</button>
  <section class="ai-panel" id="aiPanel" hidden role="dialog" aria-label="AI Assistant, PoC simulation">
    <header class="ai-head"><div><b>AI Assistant</b><span>PoC simulation · answers computed from the live demo state</span></div><button type="button" class="ghost ai-close" id="aiClose" data-ai-close aria-label="Close AI Assistant">✕</button></header>
    <div class="ai-msgs" id="aiMsgs"></div>
    <div class="ai-chips">${AI_CHIPS.map(c=>`<button type="button" class="ai-chipq" data-aiq="${esc(c)}">${esc(c)}</button>`).join("")}</div>
    <form id="aiForm" class="ai-form"><input id="aiInput" type="text" placeholder="Ask about readiness, risks, gates, evidence…" autocomplete="off" aria-label="Question"><button class="primary" type="submit">Ask</button></form>
  </section>`;
  document.getElementById("aiForm").addEventListener("submit",ev=>{ev.preventDefault();const i=document.getElementById("aiInput");const q=i.value.trim();if(!q)return;i.value="";aiAsk(q);});
}
