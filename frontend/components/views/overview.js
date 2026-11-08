// ---------- Overview: national readiness map -> stadium -> venue detail ----------
import {VENUES,esc,pct,daysBetween,decMeta} from "../../lib/data";
import {S} from "../../lib/state";
import {scores,oblsOf,gateEval} from "../../lib/scoring";
import {forecasts} from "../../lib/forecast";
import {publicAssetUrl} from "../../lib/assets.mjs";

// Approximate stadium coordinates [lon, lat]
const GEO={RUH:[46.72,24.71],JED:[39.17,21.54],KHO:[50.21,26.28],AHB:[42.50,18.22],NEO:[35.20,28.00],"TBC-R3":[47.70,23.55],"TBC-J1":[40.35,20.55]};
const AREA=(()=>{const n={};return Object.fromEntries(VENUES.filter(v=>GEO[v.id]).map(v=>{n[v.city]=(n[v.city]||0)+1;return [v.id,n[v.city]>1?v.city+n[v.city]:v.city];}));})();
const pinLabel=v=>AREA[v.id]||v.city;

// Simplified Saudi Arabia outline [lon, lat] for an illustrative map
const BORDER=[[35.0,29.35],[36.0,29.2],[37.5,30.0],[38.0,31.5],[39.2,32.2],[40.4,31.9],[42.1,31.1],[44.7,29.2],[46.5,29.1],[47.4,29.0],[48.4,28.5],[48.8,27.7],[49.6,26.9],[50.1,26.2],[50.2,25.6],[50.8,24.75],[51.6,24.25],[52.6,22.9],[55.2,22.7],[55.7,22.0],[55.0,20.0],[52.0,19.0],[49.1,18.6],[48.2,17.9],[47.5,17.1],[46.7,17.3],[44.6,17.4],[43.4,17.5],[43.0,16.7],[42.6,16.4],[41.9,17.8],[41.2,19.0],[40.2,20.2],[39.6,21.4],[39.1,22.4],[38.4,23.6],[37.5,24.5],[36.6,25.7],[35.6,27.0],[34.8,28.1],[34.6,28.9]];

const W=1000,H=800;
const px=([lon,lat])=>[(lon-33.5)*44,(33-lat)*46];
const MARK=publicAssetUrl("/Assets/wca-mark.jpg",process.env.NEXT_PUBLIC_BASE_PATH||"");

let sel=null;
export function ovSelect(id){sel=id&&GEO[id]?id:null;}

function venueStats(id){
  const list=oblsOf(id), sc=scores(list), f=forecasts().find(x=>x.id===id);
  const open=S.issues.filter(i=>i.status==="Open"&&list.some(o=>o.id===i.obl));
  const crit=open.filter(i=>i.crit==="Critical").length;
  const cu=list.filter(o=>o.crit==="Critical"&&o.state!=="Verified").length;
  const ge=gateEval(id);
  const tone=!f?"good":f.cls==="p-good"?"good":f.cls==="p-warn"?"warn":"bad";
  return {list,sc,f,open,crit,cu,ge,tone};
}

export function viewOverview(){
  const f=forecasts(), sc=scores(S.obligations);
  const stadiums=VENUES.filter(v=>GEO[v.id]);
  const stats=Object.fromEntries(stadiums.map(v=>[v.id,venueStats(v.id)]));
  const onTrack=f.filter(x=>x.late80<=0).length;
  const critU=S.obligations.filter(o=>o.crit==="Critical"&&o.state!=="Verified").length;
  const openD=S.decisions.filter(d=>d.status==="Open").map(d=>decMeta(d.id)).filter(Boolean).sort((a,b)=>a.lrm<b.lrm?-1:1);
  const openI=S.issues.filter(i=>i.status==="Open");
  const overdue=openI.filter(i=>S.today>i.due).length;
  const worst=stadiums.map(v=>({v,x:stats[v.id].f})).filter(o=>o.x).sort((a,b)=>a.x.prob-b.x.prob)[0];

  // ----- map -----
  const path="M"+BORDER.map(p=>px(p).map(n=>n.toFixed(1)).join(" ")).join(" L")+" Z";
  const label=(t,ll)=>{const [x,y]=px(ll);return `<text class="ov-sea" x="${x.toFixed(0)}" y="${y.toFixed(0)}" text-anchor="middle">${t}</text>`;};
  const svg=`<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">
    <path class="ov-land" d="${path}"/>
    ${label("RED SEA",[37.2,21.6])}${label("ARABIAN GULF",[52.6,27.6])}${label("JORDAN",[36.6,31.9])}${label("IRAQ",[43.8,31.7])}${label("YEMEN",[46.5,16.3])}
    <text class="ov-country" x="${px([45,23])[0].toFixed(0)}" y="${px([45,23])[1].toFixed(0)}" text-anchor="middle">SAUDI ARABIA</text>
  </svg>`;

  const pins=stadiums.map(v=>{
    const [x,y]=px(GEO[v.id]), s=stats[v.id];
    return `<button class="ov-pin ${sel===v.id?"sel":""}" style="left:${(x/W*100).toFixed(2)}%;top:${(y/H*100).toFixed(2)}%" data-ov-venue="${v.id}" aria-label="${esc(v.name)}, ${pct(s.sc.assured)}% assured readiness">
      <img src="${MARK}" alt=""><small>${esc(pinLabel(v))}</small><i class="${s.tone}"></i></button>`;
  }).join("");

  let pop="";
  if(sel){
    const v=VENUES.find(z=>z.id===sel), s=stats[sel], [x,y]=px(GEO[sel]), left=x/W>0.55;
    pop=`<div class="ov-pop ${left?"l":"r"}" style="left:${(x/W*100).toFixed(2)}%;top:${(y/H*100).toFixed(2)}%" role="dialog" aria-label="${esc(v.name)} readiness">
      <div class="ov-pop-h"><div><b>${esc(pinLabel(v))}</b><span>${esc(v.name)}</span></div><button class="ov-x" type="button" data-ov-clear aria-label="Close">✕</button></div>
      <div class="ov-pop-m">
        <div><b>${pct(s.sc.assured)}%</b><span>assured readiness</span></div>
        <div><b>${s.f?pct(s.f.prob)+"%":"n/a"}</b><span>on-time probability</span></div>
      </div>
      <dl class="ov-pop-d">
        <div><dt>Next gate</dt><dd>${s.f?`${s.f.gate.id} ${esc(s.f.gate.name)}`:"All gates passed"}</dd></div>
        <div><dt>Open issues</dt><dd>${s.open.length}${s.crit?` · ${s.crit} Critical`:""}</dd></div>
        <div><dt>Forecast</dt><dd><span class="pill ${s.f?s.f.cls:"p-good"}">${s.f?esc(s.f.status):"Complete"}</span></dd></div>
      </dl>
      <button class="ov-go" type="button" data-venue-detail="${v.id}">View stadium →</button>
    </div>`;
  }

  // ----- Nabd brief: programme or selected stadium -----
  let brief;
  if(sel){
    const v=VENUES.find(z=>z.id===sel), s=stats[sel], bad=s.ge?s.ge.rules.filter(r=>!r.ok):[];
    brief=`<div class="ov-nabd-k">✦ Nabd · ${esc(pinLabel(v))} brief</div>
      <h3>${esc(v.name)}</h3>
      <p class="ov-sub">${esc(v.role||v.type)} · simulated insight from live demo data</p>
      <ul class="ov-points">
        <li><b>${pct(s.sc.assured)}%</b> of readiness is backed by validated evidence, against ${pct(s.sc.declared)}% declared by owners.</li>
        <li>${s.f?`<b>${pct(s.f.prob)}%</b> chance of meeting ${s.f.gate.id} ${esc(s.f.gate.name)} on time.`:"All FIFA gates are passed."}</li>
        <li><b>${s.cu}</b> Critical obligation${s.cu===1?"":"s"} not yet verified and <b>${s.open.length}</b> open corrective action${s.open.length===1?"":"s"}.</li>
      </ul>
      <div class="ov-focus"><span>Recommended focus</span><p>${bad.length?esc(bad[0].text)+(bad[0].blockers.length?` (${bad[0].blockers.slice(0,3).map(o=>esc(o.code)).join(", ")})`:""):"Gate rules are met. The venue can request the gate pass."}</p></div>
      <button class="ov-ask" type="button" data-aiq="${esc(`Why is ${v.name} at risk?`)}">✦ Ask Nabd about ${esc(pinLabel(v))}</button>
      <button class="ov-link" type="button" data-ov-clear>← Back to programme view</button>`;
  } else {
    brief=`<div class="ov-nabd-k">✦ Nabd readiness brief</div>
      <h3>What leadership needs to know</h3>
      <p class="ov-sub">Simulated insight from live demo data</p>
      <ul class="ov-points">
        <li><b>${onTrack} of ${f.length}</b> venues and base camps make their next FIFA gate at P80.</li>
        <li><b>${critU}</b> Critical obligations remain unverified by the second line.</li>
        <li><b>${openD.length}</b> executive decision${openD.length===1?" is":"s are"} open.</li>
        <li><b>${openI.length}</b> corrective actions are open${overdue?`, ${overdue} past SLA`:""}.</li>
      </ul>
      ${worst?`<button class="ov-priority" type="button" data-ov-venue="${worst.v.id}"><span>Priority</span><b>${esc(worst.v.name)}</b><small>${pct(worst.x.prob)}% on-time probability · ${esc(worst.x.status)}</small></button>`:""}
      <button class="ov-ask" type="button" data-aiq="Which venue is highest risk?">✦ Ask Nabd a question</button>`;
  }

  // ----- KPI row -----
  const kpi=(n,l,s,goto)=>`<button class="ov-kpi" type="button" data-goto="${goto}"><b>${n}</b><span>${l}</span><small>${s}</small></button>`;
  const kpis=[
    kpi(`${onTrack}/${f.length}`,"Gates on track","at 80% confidence","readiness"),
    kpi(`${pct(sc.assured)}%`,"Assured readiness",`vs ${pct(sc.declared)}% owner-declared`,"readiness"),
    kpi(critU,"Critical unverified","awaiting second-line review","register"),
    kpi(openD.length,"Decisions open",openD.length?"awaiting leadership":"none outstanding","actions"),
  ].join("");

  // ----- venue strip -----
  const chips=stadiums.map(v=>{const s=stats[v.id];return `<button class="ov-chip ${sel===v.id?"sel":""}" type="button" data-ov-venue="${v.id}">
    <img src="${MARK}" alt=""><span><b>${esc(pinLabel(v))}</b><small>${esc(v.name)}</small></span><i class="${s.tone}"></i><em>${pct(s.sc.assured)}%</em></button>`;}).join("");

  return `<section class="ov">
    <div class="ov-hero">
      <div><span class="ov-tag">Saudi Arabia 2034 · Programme overview</span><h2>A ready Saudi Arabia</h2>
      <p>Start with the whole programme, select a stadium on the map, then open its full readiness record in the Control Tower.</p></div>
    </div>
    <div class="ov-grid">
      <div class="ov-map">${svg}${pins}${pop}<div class="ov-legend"><span><i class="good"></i>On track</span><span><i class="warn"></i>At risk at P80</span><span><i class="bad"></i>Late at P50</span></div></div>
      <aside class="ov-card ov-nabd">${brief}</aside>
    </div>
    <div class="ov-kpis">${kpis}</div>
    <section class="ov-strip"><div class="ov-strip-h"><div><h3>Venue status</h3><span>Select a venue to see its readiness and Nabd brief</span></div><button class="linkish" type="button" data-goto="tower">View all venues →</button></div>
      <div class="ov-chips">${chips}</div></section>
  </section>`;
}