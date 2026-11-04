
(function(){
"use strict";
// ---------- reference data ----------
const GATES=[
  {id:"G1",name:"Design freeze"},{id:"G2",name:"Structure complete"},{id:"G3",name:"Construction complete"},
  {id:"G4",name:"Test event ready"},{id:"G5",name:"FIFA handover"}];
const LEVELS=["Delivery owner","Workstream lead","Authority executive","Ministerial steering"];
const SLA={Critical:7,High:14,Medium:21};
const WEIGHT={Critical:3,High:2,Medium:1};
const STATES=["Assigned","Submitted","Validated","Verified"];

// Illustrative thresholds modelled on FIFA stadium requirement families. Verify against the authority's FIFA documents.
const TEMPLATES=[
 {code:"CAP-01",family:"Capacity",clause:"Stadium Req. §2.1",text:"Gross seating capacity meets the match allocation for this venue",op:"min",unit:"seats",crit:"Critical",gate:"G2",owner:"Stadium developer"},
 {code:"FOP-01",family:"Field of play",clause:"Stadium Req. §3.2",text:"Field of play measures 105 m in length",op:"eq",value:105,unit:"m",crit:"Critical",gate:"G2",owner:"Stadium developer"},
 {code:"FOP-02",family:"Field of play",clause:"Stadium Req. §3.4",text:"Natural or hybrid grass surface installed and certified",op:"bool",crit:"High",gate:"G4",owner:"Pitch contractor"},
 {code:"LGT-01",family:"Floodlighting",clause:"Lighting Guide §4.1",text:"Vertical illuminance towards fixed cameras",op:"min",value:2500,unit:"lux",crit:"Critical",gate:"G4",owner:"MEP contractor"},
 {code:"LGT-02",family:"Floodlighting",clause:"Lighting Guide §4.3",text:"Vertical illuminance uniformity (U2)",op:"min",value:0.7,unit:"ratio",crit:"High",gate:"G4",owner:"MEP contractor"},
 {code:"MED-01",family:"Media",clause:"Media Req. §5.2",text:"Media tribune seats on the main stand",op:"min",value:1600,unit:"seats",crit:"High",gate:"G3",owner:"Stadium developer"},
 {code:"TEA-01",family:"Team facilities",clause:"Stadium Req. §6.1",text:"Each team dressing room floor area",op:"min",value:150,unit:"m²",crit:"High",gate:"G3",owner:"Stadium developer"},
 {code:"ACC-01",family:"Accessibility",clause:"Accessibility Guide §2.4",text:"Wheelchair user spaces with companion seats (1% of capacity)",op:"min",unit:"spaces",crit:"High",gate:"G3",owner:"Stadium developer"},
 {code:"SAF-01",family:"Safety & security",clause:"Safety Req. §7.3",text:"Full evacuation time to a place of safety",op:"max",value:8,unit:"min",crit:"Critical",gate:"G4",owner:"Civil Defense liaison"},
 {code:"ITT-01",family:"IT&T",clause:"IT&T Req. §8.1",text:"Dual-diverse fibre routes from stadium to the IBC",op:"bool",crit:"Critical",gate:"G3",owner:"Telecom operator"},
 {code:"CLM-01",family:"Climate",clause:"Host commitment §9.2",text:"Bowl temperature at spectator level during matches",op:"max",value:26,unit:"°C",crit:"High",gate:"G4",owner:"MEP contractor"},
 {code:"SUS-01",family:"Sustainability",clause:"Host commitment §10.1",text:"Green building certification achieved",op:"bool",crit:"Medium",gate:"G3",owner:"Sustainability office"},
 {code:"MDC-01",family:"Medical",clause:"Medical Req. §11.2",text:"Pitch-side medical room floor area",op:"min",value:25,unit:"m²",crit:"Medium",gate:"G3",owner:"Health cluster"}
];
const CAMP_TEMPLATES=[
 {code:"TBC-01",family:"Team base camp",clause:"Base Camp Req. §1.2",text:"Training site travel time from team hotel",op:"max",value:20,unit:"min",crit:"High",gate:"G3",owner:"Host city"},
 {code:"TBC-02",family:"Team base camp",clause:"Base Camp Req. §1.4",text:"Team hotel contracted with dedicated rooms",op:"min",value:50,unit:"rooms",crit:"Critical",gate:"G3",owner:"Hospitality operator"},
 {code:"TBC-03",family:"Team base camp",clause:"Base Camp Req. §1.6",text:"Private, screened training sessions possible",op:"bool",crit:"High",gate:"G4",owner:"Host city",dependsOn:"TBC-02"}
];
// Venue names from the public Saudi 2034 bid; capacities are approximate and for demonstration.
const VENUES=[
 {id:"RUH",name:"King Salman International Stadium",city:"Riyadh",type:"Stadium",capacity:92760,minCap:80000,mediaMin:2000,role:"Opening match and final",gateIdx:1,gateDate:"2028-06-30",velocity:4,mat:0,
  pmc:{finish:"2028-06-12",pct:9,note:"Bowl structure on programme"},build:[420,560,800],
  seed:"V V N A N A V A A N N A N",bad:{}},
 {id:"JED",name:"King Abdullah Sports City Stadium",city:"Jeddah",type:"Stadium",capacity:58000,minCap:40000,role:"Group stage to quarter-final",gateIdx:2,gateDate:"2027-03-31",velocity:3,mat:1,
  pmc:{finish:"2027-03-20",pct:71,note:"Upgrade works on programme, 11 days float"},build:[90,140,220],
  seed:"V A N S A S N A N N N A V",bad:{"MED-01":1450,"LGT-01":1850}},
 {id:"KHO",name:"Aramco Stadium",city:"Al Khobar",type:"Stadium",capacity:47000,minCap:40000,role:"Group stage to round of 16",gateIdx:2,gateDate:"2027-01-31",velocity:6,mat:1,
  pmc:{finish:"2027-01-15",pct:88,note:"Fit-out and commissioning"},build:[20,35,60],
  seed:"V V V A V V V V A V A V V",bad:{}},
 {id:"AHB",name:"King Khalid University Stadium",city:"Abha",type:"Stadium",capacity:45000,minCap:40000,role:"Group stage",gateIdx:1,gateDate:"2028-09-30",velocity:3,mat:0,
  pmc:{finish:"2028-09-01",pct:14,note:"Redevelopment, early works"},build:[480,610,820],
  seed:"V A A R A A A S N A N A A",bad:{"LGT-01":2200}},
 {id:"NEO",name:"NEOM Stadium",city:"NEOM",type:"Stadium",capacity:46000,minCap:40000,role:"Group stage to round of 16",gateIdx:0,gateDate:"2027-06-30",velocity:3,mat:0,
  pmc:{finish:"2027-06-10",pct:42,note:"Design development, stage 3"},build:[0,0,0],
  seed:"A A N N N S A N N S N A N",bad:{}},
 {id:"TBC-R3",name:"Team base camp R-03",city:"Riyadh",type:"Team base camp",gateIdx:2,gateDate:"2027-06-30",velocity:6,mat:1,
  pmc:{finish:"2027-05-30",pct:60,note:"Training pitch works"},build:[30,60,110],
  seed:"A S N",bad:{"TBC-02":38}},
 {id:"TBC-J1",name:"Team base camp J-01",city:"Jeddah",type:"Team base camp",gateIdx:2,gateDate:"2027-09-30",velocity:6,mat:1,
  pmc:{finish:"2027-08-31",pct:55,note:"Hotel refurbishment"},build:[40,80,140],
  seed:"V V A",bad:{}}
];
// Evidence maturity: a gate needs evidence at least this mature (G1 design ... G5 proven in operation).
const MAT=["Design","Installed","Commissioned","Proven in operation"];
const REQMAT=[0,1,1,2,3];
// Owners outside the programme's direct control.
const EXTERNAL=["Telecom operator","Civil Defense liaison","Host city","Hospitality operator","Health cluster"];
const DECISIONS=[
 {id:"DEC-01",venue:"JED",title:"Recover Jeddah's Construction complete gate",q:"Evidence-based P80 for G3 is later than FIFA's milestone while the PMC schedule shows 11 days float.",owner:"Authority executive",lrm:"2026-11-20",
  options:[{t:"Deploy a recovery team",fx:"recover"},{t:"Re-baseline G3 with FIFA",fx:"rebase"},{t:"Hold and monitor",fx:null}]},
 {id:"DEC-02",venue:"RUH",title:"Protect King Salman's Structure complete gate",q:"P50 meets the 30 Jun 2028 milestone, P80 does not. Roof steel procurement is the driver.",owner:"Ministerial steering",lrm:"2027-02-15",
  options:[{t:"Accelerate roof steel package",fx:"recover"},{t:"Accept P50 risk and review quarterly",fx:null}]},
 {id:"DEC-03",venue:"AHB",title:"Recover Abha's Structure complete gate",q:"Redevelopment is in early works. P80 for G2 falls after the milestone because bowl structure progress is the only driver.",owner:"Authority executive",lrm:"2027-04-30",
  options:[{t:"Add a second shift on the bowl structure",fx:"recover"},{t:"Re-sequence the roof works",fx:null}]},
 {id:"DEC-04",venue:"NEO",title:"Freeze NEOM Stadium design scope",q:"Late design changes keep critical obligations unverified ahead of Design freeze.",owner:"Authority executive",lrm:"2027-01-31",
  options:[{t:"Freeze scope now",fx:"recover"},{t:"Allow one more change window",fx:null}]}
];
const ISSUERS=["Third-party test lab","Design consultant","Site engineer","Independent certifier","Contractor QA"];

// ---------- helpers ----------
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmtN=n=>typeof n==="number"?n.toLocaleString("en-US",{maximumFractionDigits:2}):n;
const addDays=(iso,d)=>{const t=new Date(iso+"T00:00:00Z");t.setUTCDate(t.getUTCDate()+d);return t.toISOString().slice(0,10)};
const daysBetween=(a,b)=>Math.round((Date.parse(b)-Date.parse(a))/864e5);
const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtD=iso=>iso?`${Number(iso.slice(8,10))} ${MONTHS[Number(iso.slice(5,7))-1]} ${iso.slice(0,4)}`:"";
const pct=x=>Math.round(x*100);
function critText(o){
  if(o.op==="bool") return "Required: yes (confirmed by evidence)";
  const sym={min:"≥",max:"≤",eq:"="}[o.op];
  return `${o.code}: measured ${sym} ${fmtN(o.value)} ${o.unit}`;
}
function passes(o,v){
  if(o.op==="bool") return v===true||v==="yes";
  const n=Number(v); if(!isFinite(n)) return false;
  if(o.op==="min") return n>=o.value;
  if(o.op==="max") return n<=o.value;
  return Math.abs(n-o.value)<1e-9;
}
function goodValue(o){
  if(o.op==="bool") return true;
  if(o.op==="eq") return o.value;
  if(o.op==="min") return o.unit==="ratio"?Math.round(o.value*1.1*100)/100:Math.ceil(o.value*1.06);
  return Math.round(o.value*0.85*10)/10;
}
function showVal(o,v){ if(o.op==="bool") return v===true||v==="yes"?"Yes":"No"; return `${fmtN(Number(v))} ${o.unit}`; }

// ---------- state ----------
let S;
const KEY="cae-poc-v2";
function seed(){
  const st={today:"2026-10-30",obligations:[],issues:[],audit:[],venues:VENUES.map(v=>({id:v.id,gateIdx:v.gateIdx,gateDate:v.gateDate,passed:[]})),seq:1,
    scn:{prod:1,fifa:false,recovery:[]},decisions:DECISIONS.map(d=>({id:d.id,status:"Open"}))};
  const log=(t,actor,action,obl)=>st.audit.push({t,actor,action,obl});
  VENUES.forEach(v=>{
    const tpl=v.type==="Stadium"?TEMPLATES:CAMP_TEMPLATES;
    const codes=v.seed.split(" ");
    tpl.forEach((t,i)=>{
      const o=Object.assign({},t);
      o.id=`${v.id}-${t.code}`; o.venue=v.id;
      if(t.code==="CAP-01") o.value=v.minCap;
      if(t.code==="ACC-01") o.value=Math.ceil(v.capacity*0.01);
      if(t.code==="MED-01"&&v.mediaMin) o.value=v.mediaMin;
      if(o.dependsOn) o.dependsOn=`${v.id}-${o.dependsOn}`;
      o.evidence=[]; o.state="Assigned"; o.claim=false;
      const c=codes[i]; const base="2026-0"+(3+(i%6))+"-1"+(i%9);
      const badV=v.bad[t.code];
      const mat=v.mat===0?0:(gateNum(t.gate)>=4?2:1);
      const ev=(val,res,reviewer)=>({file:`${o.code}_${v.id}_${mat===0?["design_calc","drawing","model_extract","design_report"][i%4]:["report","certificate","test","drawing"][i%4]}.pdf`,issuer:mat===0?"Design consultant":ISSUERS[i%ISSUERS.length],value:val,date:base,result:res,reviewer,maturity:mat});
      if(c==="V"){o.evidence.push(ev(goodValue(o),"pass","Rule engine"));o.state="Verified";o.verifiedBy="Compliance office";log(base,"Rule engine","Evidence validated",o.id);log(addDays(base,6),"Compliance office","Verified by second line",o.id);}
      if(c==="A"){o.evidence.push(ev(goodValue(o),"pass","Rule engine"));o.state="Validated";log(base,"Rule engine","Evidence validated",o.id);}
      if(c==="S"){const val=badV!==undefined?badV:goodValue(o);o.evidence.push(ev(val,"pending",null));o.state="Submitted";o.claim=true;log(base,o.owner,"Owner declared complete and submitted evidence",o.id);}
      if(c==="R"){const val=badV!==undefined?badV:(o.op==="bool"?false:o.value*0.8);o.evidence.push(ev(val,"fail","Rule engine"));o.state="Rejected";o.claim=true;log(base,"Rule engine","Evidence rejected against criterion",o.id);
        st.issues.push({id:"ISS-"+String(st.seq++).padStart(3,"0"),obl:o.id,title:`${o.text}: evidence below criterion`,crit:o.crit,level:1,opened:"2026-10-09",due:"2026-10-23",status:"Open",history:[{t:"2026-10-09",a:"Opened at Delivery owner"},{t:"2026-10-16",a:"SLA missed, escalated to Workstream lead"}]});}
      st.obligations.push(o);
    });
  });
  // one open issue still inside SLA, to show the clock running
  const jed=st.obligations.find(o=>o.id==="JED-TEA-01");
  st.issues.push({id:"ISS-"+String(st.seq++).padStart(3,"0"),obl:jed.id,title:"Dressing room drawings not submitted",crit:jed.crit,level:0,opened:"2026-10-24",due:"2026-11-07",status:"Open",history:[{t:"2026-10-24",a:"Opened at Delivery owner"}]});
  log("2026-10-24","Rule engine","Corrective action opened: dressing room drawings not submitted","JED-TEA-01");
  log("2026-10-26","PMC","Schedule update: Jeddah G3 finish held at 20 Mar 2027 (deterministic, 11 days float)",null);
  log("2026-10-27","Compliance office","Verified by second line","KHO-CAP-01");
  log("2026-10-28","Hospitality operator","Owner declared team hotel contract complete and submitted evidence","TBC-R3-TBC-02");
  st.audit.sort((a,b)=>a.t<b.t?-1:1);
  return st;
}
function load(){try{const r=localStorage.getItem(KEY);if(r){S=JSON.parse(r);return}}catch(e){} S=seed();}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
function log(actor,action,obl){S.audit.push({t:S.today,actor,action,obl});}

// ---------- scoring ----------
const venueMeta=id=>VENUES.find(v=>v.id===id);
const venueState=id=>S.venues.find(v=>v.id===id);
const oblsOf=id=>S.obligations.filter(o=>o.venue===id);
const gateNum=g=>Number(g.slice(1));
function assuredScore(o){return o.state==="Verified"?1:o.state==="Validated"?0.8:0}
function declaredScore(o){return (o.state==="Assigned")?0:1}
function scores(list){
  let w=0,a=0,d=0; list.forEach(o=>{const k=WEIGHT[o.crit];w+=k;a+=k*assuredScore(o);d+=k*declaredScore(o)});
  return {assured:w?a/w:0,declared:w?d/w:0};
}
function projection(id){const f=forecasts().find(x=>x.id===id);return f?{status:f.status,cls:f.cls,f}:{status:"All gates passed",cls:"p-good"};}
function depBlocked(o){ if(!o.dependsOn) return null; const d=S.obligations.find(x=>x.id===o.dependsOn); return d&&!(d.state==="Validated"||d.state==="Verified")?d:null; }
function gateEval(id){
  const v=venueState(id); if(v.gateIdx>=GATES.length) return null;
  const g=GATES[v.gateIdx], gn=v.gateIdx+1;
  const scope=gateScope(id,gn), req=REQMAT[gn-1];
  const immature=scope.filter(o=>(o.state==="Validated"||o.state==="Verified")&&matOf(o)<req);
  const crit=scope.filter(o=>o.crit==="Critical"&&o.state!=="Verified");
  const sc=scores(scope);
  const openCrit=S.issues.filter(i=>i.status==="Open"&&i.crit==="Critical"&&S.obligations.find(o=>o.id===i.obl&&o.venue===id));
  const notValid=scope.filter(o=>!(o.state==="Validated"||o.state==="Verified"));
  const rules=[
    {ok:crit.length===0,text:`All Critical obligations in scope are verified by the second line`,blockers:crit},
    {ok:immature.length===0,text:`Evidence comes from the ${MAT[req].toLowerCase()} stage or later, not only from drawings`,blockers:immature},
    {ok:sc.assured>=0.9,text:`Assured readiness for gate scope is at least 90% (now ${pct(sc.assured)}%)`,blockers:sc.assured>=0.9?[]:notValid},
    {ok:openCrit.length===0,text:`No open Critical issues`,blockers:openCrit.map(i=>S.obligations.find(o=>o.id===i.obl))}
  ];
  return {gate:g,scope,rules,pass:rules.every(r=>r.ok),sc};
}
function gateScope(id,gn){const all=oblsOf(id);return gn===1?all.filter(o=>o.crit!=="Medium"):all.filter(o=>gateNum(o.gate)<=gn);}
function matOf(o){const e=o.evidence.filter(x=>x.result==="pass").pop();return e&&e.maturity!=null?e.maturity:(e?1:-1);}

// ---------- forecast: Monte Carlo on evidence, not on reported progress ----------
// Each run samples how long every obligation in the gate scope needs to reach the state and evidence
// maturity the gate requires. The gate is ready when every Critical item is verified and 90% of the
// weighted scope is assured. Durations are illustrative and will be calibrated on the PMC's real data.
function rng(seed){let a=seed>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function tri(r,a,m,b){if(b<=a)return a;const u=r(),f=(m-a)/(b-a);return u<f?a+Math.sqrt(u*(b-a)*(m-a)):b-Math.sqrt((1-u)*(b-a)*(b-m))}
const DUR={Assigned:[40,80,180],Submitted:[5,20,60],Rejected:[25,55,130],Validated:[4,10,25]};
function forecast(id,scn,runs){
  scn=scn||S.scn; runs=runs||1000;
  const v=venueState(id),m=venueMeta(id); if(v.gateIdx>=GATES.length) return null;
  const gn=v.gateIdx+1,req=REQMAT[gn-1],scope=gateScope(id,gn),gateDays=daysBetween(S.today,v.gateDate);
  const rec=scn.recovery.includes(id),vel=1+(5-m.velocity)*0.12,b=m.build||[0,0,0];
  const r=rng([...id].reduce((h,c)=>h*31+c.charCodeAt(0),7)+(rec?17:0)+(scn.fifa?29:0)+Math.round(scn.prod*100));
  const W=scope.reduce((s,o)=>s+WEIGHT[o.crit],0), out=[];
  for(let k=0;k<runs;k++){
    const build=tri(r,b[0],b[1],b[2])*(1+(scn.prod-1)*0.5)*(rec?0.85:1);
    const fin={};
    const t=scope.map(o=>{
      let d=0; const need=o.crit==="Critical"?"Verified":"Validated";
      if(!(o.state==="Verified"||(o.state==="Validated"&&need==="Validated"))){const p=DUR[o.state]||[0,0,0];d=tri(r,p[0],p[1],p[2])*vel*scn.prod*(rec?0.65:1);}
      if(matOf(o)<req||o.state==="Assigned"||o.state==="Rejected") d=Math.max(d,build+(o.state==="Verified"?tri(r,4,10,25):0));
      const iss=issueFor(o); if(iss&&iss.level>=2) d+=tri(r,10,20,45);
      if(scn.fifa&&r()<0.12) d+=tri(r,20,45,100);
      return {o,d};
    });
    t.forEach(x=>fin[x.o.id]=x.d);
    t.forEach(x=>{const dep=x.o.dependsOn&&fin[x.o.dependsOn];if(dep)x.d=Math.max(x.d,dep+x.d*0.6);});
    let crit=0; t.forEach(x=>{if(x.o.crit==="Critical")crit=Math.max(crit,x.d)});
    t.sort((a,c)=>a.d-c.d); let acc=0,p90=0; for(const x of t){acc+=WEIGHT[x.o.crit];p90=x.d;if(acc>=0.9*W)break;}
    out.push(Math.max(0,crit,p90));
  }
  out.sort((a,c)=>a-c);
  const q=p=>Math.round(out[Math.min(out.length-1,Math.floor(p*out.length))]);
  const prob=out.filter(x=>x<=gateDays).length/out.length;
  const pmcLate=daysBetween(v.gateDate,m.pmc.finish);
  const res={id,gate:GATES[v.gateIdx],gateDate:v.gateDate,gateDays,p50:q(.5),p60:q(.6),p80:q(.8),prob,pmc:m.pmc,pmcLate};
  res.d50=addDays(S.today,res.p50);res.d60=addDays(S.today,res.p60);res.d80=addDays(S.today,res.p80);
  res.late80=res.p80-gateDays;res.late50=res.p50-gateDays;
  res.status=res.late50>0?"Late at P50":res.late80>0?"At risk at P80":"On track at P80";
  res.cls=res.late50>0?"p-bad":res.late80>0?"p-warn":"p-good";
  return res;
}
let FC=null;
function forecasts(){if(!FC)FC=VENUES.map(m=>forecast(m.id)).filter(Boolean);return FC;}
function stateCls(s){return {Verified:"p-good",Validated:"p-info",Submitted:"p-warn",Assigned:"p-mute",Rejected:"p-bad"}[s]}
function issueFor(o){return S.issues.find(i=>i.obl===o.id&&i.status==="Open")}

// ---------- actions ----------
function toast(msg){const r=$("#toastRoot");r.innerHTML=`<div class="toast" role="status">${esc(msg)}</div>`;clearTimeout(toast.t);toast.t=setTimeout(()=>r.innerHTML="",3200);}
function openIssue(o,title,level){
  let i=issueFor(o);
  if(i){ if(level!==undefined&&level>i.level){i.level=level;i.history.push({t:S.today,a:`Escalated to ${LEVELS[level]}`});} return i; }
  const lv=level||0;
  i={id:"ISS-"+String(S.seq++).padStart(3,"0"),obl:o.id,title,crit:o.crit,level:lv,opened:S.today,due:addDays(S.today,SLA[o.crit]),status:"Open",history:[{t:S.today,a:`Opened at ${LEVELS[lv]}`}]};
  S.issues.push(i); log("Rule engine",`Corrective action ${i.id} opened (${LEVELS[lv]})`,o.id); return i;
}
function validate(o){
  const e=o.evidence[o.evidence.length-1]; if(!e) return;
  const ok=passes(o,e.value); e.result=ok?"pass":"fail"; e.reviewer="Rule engine";
  if(ok){o.state="Validated";log("Rule engine","Evidence validated against criterion",o.id);
    const i=issueFor(o); if(i){i.status="Closed";i.closed=S.today;i.history.push({t:S.today,a:"Closed: closure verified by validated evidence"});log("Rule engine",`${i.id} closed by evidence`,o.id);}
  } else {o.state="Rejected";log("Rule engine",`Evidence rejected: ${showVal(o,e.value)} against ${critText(o)}`,o.id);
    openIssue(o,`${o.text}: evidence fails criterion`);
  }
  return ok;
}
function verify(o){ if(o.state!=="Validated") return; o.state="Verified"; o.verifiedBy="Compliance office"; log("Compliance office","Verified by second line",o.id); }
function advance(){
  S.today=addDays(S.today,7); let n=0;
  S.issues.filter(i=>i.status==="Open").forEach(i=>{
    if(S.today>i.due && i.level<LEVELS.length-1){i.level++;i.due=addDays(S.today,Math.ceil(SLA[i.crit]/2));i.history.push({t:S.today,a:`SLA missed, escalated to ${LEVELS[i.level]}`});log("Rule engine",`${i.id} escalated to ${LEVELS[i.level]}`,i.obl);n++;}
  });
  S.decisions.forEach(r=>{const d=DECISIONS.find(x=>x.id===r.id);if(r.status==="Open"&&!r.missed&&S.today>d.lrm){r.missed=true;log("Rule engine",`${d.id} passed its last responsible moment without a decision`,null);}});
  save(); render(); toast(n?`Clock moved to ${fmtD(S.today)}. ${n} issue${n>1?"s":""} escalated for missed SLA.`:`Clock moved to ${fmtD(S.today)}. No SLAs missed.`);
}

// ---------- views ----------
const VIEWS=[["readiness","Readiness Room"],["tower","Control tower"],["twin","Design intake 3D"],["register","Obligations"],["gates","Gates"],["issues","Escalations"],["decisions","Decisions"],["change","Change impact"],["dossier","FIFA dossier"],["decompose","Decompose requirements"]];
let filters={venue:"all",family:"all",state:"all",q:""};
function route(){const h=location.hash.replace("#","");return VIEWS.some(v=>v[0]===h)?h:"readiness";}
function renderTabs(cur){
  const P=["readiness","tower","twin","register","gates"], lab=Object.fromEntries(VIEWS);
  const more=VIEWS.filter(([k])=>!P.includes(k));
  $("#tabs").innerHTML=P.map(k=>`<a href="#${k}" ${k===cur?'aria-current="page"':""}>${lab[k]}</a>`).join("")+
   `<details class="menu" id="moreMenu"><summary class="${P.includes(cur)?"":"cur"}" style="display:inline-flex;align-items:center;gap:6px"><span class="lbl">More</span> <span aria-hidden="true">▾</span></summary><div class="pop">${more.map(([k,l])=>`<a href="#${k}" ${k===cur?'aria-current="page"':""}>${l}</a>`).join("")}</div></details>`;
}

// ---------- visual helpers (shared by all views) ----------
const legV=P=>`<div class="leg">${P.filter(p=>p.n>0).map(p=>`<span><i style="background:${p.c}"></i>${p.n} ${p.l}</span>`).join("")}</div>`;
const segV=P=>{const t=P.reduce((a,p)=>a+p.n,0)||1;return `<div class="segbar">${P.filter(p=>p.n>0).map(p=>`<i style="width:${p.n/t*100}%;background:${p.c}" title="${p.n} ${p.l}"></i>`).join("")}</div>`};
const ringV=(P,c,s,cls)=>{const t=P.reduce((a,p)=>a+p.n,0)||1;let a=0;const st=P.filter(p=>p.n>0).map(p=>{const s0=a/t*100;a+=p.n;return `${p.c} ${s0}% ${a/t*100}%`}).join(",");return `<div class="ring ${cls||""}" style="background:conic-gradient(${st||"var(--sunk) 0 100%"})"><div class="ring-in"><b>${c}</b><span>${s}</span></div></div>`};
const rowV=(l,m,r)=>`<div class="qrow"><span class="qr-id">${l}</span><span class="qr-t">${m}</span>${r}</div>`;
const kpiV=(n,l,c)=>`<div class="kpi"><b class="${c||""}">${n}</b><span>${l}</span></div>`;
const hbV=(name,segs,total,mx)=>`<div class="hb"><span class="hb-l" title="${name}">${name}</span><div class="hb-tr">${segs.filter(s=>s.n>0).map(s=>`<i class="${s.k}" style="width:${s.n/mx*100}%"></i>`).join("")}</div><b>${total}</b></div>`;
const barV=(p,c)=>`<div class="mb-tr"><i class="${c||""}" style="width:${Math.max(0,Math.min(100,p))}%"></i></div>`;
const STC={Verified:"var(--brand-deep)",Validated:"var(--mint)",Submitted:"var(--warn)",Assigned:"color-mix(in srgb,var(--muted) 30%,var(--sunk))",Rejected:"var(--bad)"};
const stP=list=>["Verified","Validated","Submitted","Assigned","Rejected"].map(s=>({n:list.filter(o=>o.state===s).length,c:STC[s],l:s.toLowerCase()}));
const isProven=o=>o.state==="Verified"||o.state==="Validated";
const gtrackV=idx=>`<ol class="gtk">${GATES.map((g,i)=>`<li class="${i<idx?"done":i===idx?"cur":""}"><i>${i<idx?"✓":i+1}</i><b>${g.id}</b><span>${esc(g.name)}</span></li>`).join("")}</ol>`;
const gdotsV=idx=>`<span class="gdots" role="img" aria-label="Gate ${Math.min(idx+1,GATES.length)} of ${GATES.length}">${GATES.map((g,i)=>`<i class="${i<idx?"done":i===idx?"cur":""}" title="${g.id} ${esc(g.name)}"></i>`).join("")}</span>`;
const headV=(chip,title,lead)=>`<div class="page-head"><span class="eyebrow-chip">${chip}</span><h2>${title}</h2><p class="lead">${lead}</p></div>`;
const critV=c=>`<span class="crit c-${c}"><i></i>${c}</span>`;
const probCls=p=>p>=0.8?"p-good":p>=0.5?"p-warn":"p-bad";
const vsV=(l,prob,d80,late,hl)=>`<div class="vs-col ${hl?"hl":""}"><div class="vs-l">${l}</div><div class="vs-n">${pct(prob)}<small>%</small></div>${barV(pct(prob),probCls(prob))}<div class="vs-d">P80 ${fmtD(d80)}</div><span class="pill ${late>0?"p-bad":"p-good"}">${late>0?dd(late)+" late":"inside milestone"}</span></div>`;

function viewTower(){
  const all=S.obligations, sc=scores(all);
  const open=S.issues.filter(i=>i.status==="Open"), overdue=open.filter(i=>S.today>i.due);
  const rej=all.filter(o=>o.state==="Rejected").length, pend=all.filter(o=>o.state==="Submitted").length, ver=all.filter(o=>o.state==="Verified").length;
  const lvC=LEVELS.map((_,l)=>open.filter(i=>i.level===l).length), lvCols=["var(--mint)","var(--warn)","var(--bad)","var(--brand-deep)"];
  const dual=(a,d)=>`<div class="dual"><i class="d" style="width:${pct(d)}%"></i><i class="a" style="width:${pct(a)}%"></i></div>`;
  const tile=(k,v,body,n,c)=>`<div class="tile ${c||""}"><div class="k">${k}</div><div class="v">${v}</div>${body||""}<div class="n">${n}</div></div>`;
  const tiles=[
    tile("Assured readiness",pct(sc.assured)+"%",barV(pct(sc.assured),"p-good"),"weighted by criticality"),
    tile("Declared by owners",pct(sc.declared)+"%",dual(sc.assured,sc.declared),`assurance gap <b>${pct(sc.declared-sc.assured)} pts</b>`,"warn"),
    tile("Obligations",all.length,segV(stP(all)),`${ver} verified · ${pend} awaiting validation`),
    tile("Evidence rejected",rej,barV(rej/Math.max(1,all.length)*100,"p-bad"),"failed the acceptance criterion",rej?"alert":""),
    tile("Open issues",open.length,segV(lvC.map((n,i)=>({n,c:lvCols[i],l:LEVELS[i].toLowerCase()}))),`${overdue.length} past SLA`,overdue.length?"alert":"")
  ].join("");
  const cards=VENUES.map(m=>{
    const list=oblsOf(m.id), s=scores(list), p=projection(m.id), v=venueState(m.id);
    const g=v.gateIdx<GATES.length?GATES[v.gateIdx]:null;
    const iss=open.filter(i=>list.some(o=>o.id===i.obl)).length;
    const gap=pct(s.declared-s.assured), days=g?daysBetween(S.today,v.gateDate):0;
    const ring=ringV([{n:s.assured,c:"var(--brand-deep)"},{n:Math.max(s.declared-s.assured,0),c:"color-mix(in srgb,var(--warn) 55%,var(--surface))"},{n:Math.max(1-Math.max(s.declared,s.assured),0),c:"var(--sunk)"}],pct(s.assured)+"%","assured","sm");
    return `<article class="venue">
      <div class="head"><div style="min-width:0"><div class="name">${esc(m.name)}</div><div class="meta">${esc(m.city)} · ${esc(m.type)}${m.role?" · "+esc(m.role):""}</div></div><span class="pill ${p.cls}">${p.status}</span></div>
      <div class="vbody">${ring}<div class="vside">
        <div class="vline"><span>Declared by owners</span><b>${pct(s.declared)}%</b></div>
        <div class="vline"><span>Assurance gap</span><span class="pill ${gap>=15?"p-bad":gap>=5?"p-warn":"p-good"}">${gap} pts</span></div>
        <div class="vline"><span>Obligations proven</span><b>${list.filter(isProven).length}/${list.length}</b></div></div></div>
      <div class="vgate">${gdotsV(v.gateIdx)}<div class="vg-t">${g?`<b>${g.id} ${esc(g.name)}</b><span>${fmtD(v.gateDate)} · ${days<0?dd(days)+" overdue":dd(days)+" to go"}${p.f?` · P80 ${fmtD(p.f.d80)}`:""}</span>`:`<b>All gates passed</b>`}</div></div>
      <div class="flex"><span class="pill ${iss?"p-bad":"p-mute"}">${iss} open issue${iss===1?"":"s"}</span><span class="spacer"></span><button class="linkish" data-goto="register" data-venue="${m.id}">Obligations</button><button class="linkish" data-goto="gates" data-venue="${m.id}">Gate check</button></div>
    </article>`}).join("");
  const SCN=[["green","Evidence","The green that was red","Jeddah's new floodlighting is declared complete. Run validation and watch the status change.",""],["gate","Gate","The gate holds","Jeddah asks to pass Construction complete. See every blocker listed.","t2"],["camp","Dependency","Base camp at risk","A hotel shortfall blocks private training. Trace the dependency.","t3"],["change","Change","FIFA changes the rules","Simulate a floodlight update and see which venues flip from compliant to failing.","t4"],["dossier","Inspection","Inspection tomorrow","Generate Al Khobar's inspection dossier in one step.",""]];
  const scn=SCN.map(([d,tag,t,x,c],i)=>`<article class="scn-card ${c}"><div class="scn-top"><span class="n">0${i+1}</span><span class="pill p-mute">${tag}</span></div><b>${t}</b><p>${x}</p><button data-demo="${d}">Open scenario</button></article>`).join("")
    +`<article class="scn-card t4"><div class="scn-top"><span class="n">06</span><span class="pill p-mute">3D design</span></div><b>Design check in 3D</b><p>King Salman International Stadium's design is checked before it is built.</p><button data-goto="twin">Open 3D twin</button></article>`;
  const act=S.audit.slice(-6).reverse().map(a=>{const c=/rejected|refused|no longer|escalat/i.test(a.action)?"bad":/Verified|validated|passed/i.test(a.action)?"good":"mid";
    return `<div class="tli ${c}"><i></i><div><span class="mono muted">${fmtD(a.t)}</span><div><b>${esc(a.actor)}</b> ${esc(a.action)}${a.obl?` · <button class="linkish" data-obl="${a.obl}">${esc(a.obl)}</button>`:""}</div></div></div>`}).join("");
  return headV(`Control tower · ${VENUES.length} venues and base camps · ${all.length} obligations`,"Programme readiness","Assured readiness counts only obligations backed by validated evidence. The gap to what owners declare is the risk a status report would hide.")+`
  <div class="grid tiles">${tiles}</div>
  <section class="block"><div class="block-head"><div><div class="eyebrow">Where we stand</div><h3>Venues and base camps</h3></div><div class="legend"><span><i style="background:var(--brand-deep)"></i>Assured</span><span><i style="background:color-mix(in srgb,var(--warn) 55%,var(--surface))"></i>Declared, not yet proven</span></div></div>
    <div class="grid venues">${cards}</div></section>
  <div class="split">${intakeCard()}<div class="panel"><div class="eyebrow">Audit trail</div><h3>Latest activity</h3><div class="tl">${act}</div></div></div>
  <section class="block"><div class="block-head"><div><div class="eyebrow">✧ Guided scenarios</div><h3>See the engine work</h3></div></div><div class="scenarios">${scn}</div></section>`;
}


// ---------- Readiness Room ----------
const SHORT={RUH:"King Salman, Riyadh",JED:"King Abdullah SC, Jeddah",KHO:"Aramco, Al Khobar",AHB:"King Khalid Univ., Abha",NEO:"NEOM Stadium","TBC-R3":"Base camp R-03, Riyadh","TBC-J1":"Base camp J-01, Jeddah"};
const sn=id=>SHORT[id]||venueMeta(id).name;
const dd=n=>`${Math.abs(n)} day${Math.abs(n)===1?"":"s"}`;
const decMeta=id=>DECISIONS.find(d=>d.id===id);
const decRec=id=>S.decisions.find(d=>d.id===id);
function decide(id,idx){
  const d=decMeta(id),r=decRec(id); if(!d||!r||r.status!=="Open") return;
  const before=forecast(d.venue), opt=d.options[idx];
  if(opt.fx==="recover"&&!S.scn.recovery.includes(d.venue)) S.scn.recovery.push(d.venue);
  if(opt.fx==="rebase"){const v=venueState(d.venue);v.gateDate=addDays(v.gateDate,90);}
  const after=forecast(d.venue);
  Object.assign(r,{status:"Taken",choice:idx,t:S.today,before:before.d80,after:after.d80,beforeLate:before.late80,afterLate:after.late80,beforeProb:before.prob,afterProb:after.prob});
  log(d.owner,`${d.id} decided: ${opt.t}`,null); save(); render();
  if(!tour.active) toast(`${d.id}: ${opt.t}. P80 moved from ${fmtD(before.d80)} to ${fmtD(after.d80)}.`);
}
function fcChart(f){
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
function qcard(n,q,vis,ans,rows,conf,basis,btn){
  const cc=conf==="ev"?"Evidence-based":conf==="fc"?"Forecast · 1,000 runs":"Decision log";
  return `<article class="qcard" id="q${n}"><div class="qhead"><span class="qnum">${n}</span><h3>${esc(q)}</h3></div>
    <div class="qvis">${vis}</div><p class="ans">${ans}</p>${rows?`<div class="qrows">${rows}</div>`:""}
    <div class="qfoot"><span class="conf ${conf}">${cc}</span><span>${basis}</span><span class="spacer"></span>${btn||""}</div></article>`;
}
function viewReadiness(){
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
  return headV(`Readiness Room · ${f.length} venues · sample data`,"Three signals that decide whether we make the next FIFA gate.","Answers come from validated evidence and an evidence-based forecast. Owner reports and the PMC schedule are inputs, not answers. Forecast durations are illustrative until calibrated on the PMC's schedule data.")+`
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
    ${qcard(4,"What do I need to decide, and by when?",c4(),openD.length?`The first decision must be taken by ${fmtD(openD[0].lrm)}, ${openD[0].left<0?`${dd(openD[0].left)} ago`:`in ${dd(openD[0].left)}`}.`:"No decisions are waiting.","","dl","last responsible moment per decision",`<button class="linkish" data-goto="decisions">Decisions</button>`)}
    ${qcard(5,"What would it take to recover the worst venue?",q5.vis,q5.ans,"","fc","recovery scenario re-run",worst&&worst.late80>0?`<button class="linkish" data-goto="decisions">Decide</button>`:"")}
    ${qcard(6,"What depends on parties outside the programme?",c6(),`${ext.length} unproven obligations sit with external owners, ${ext.filter(o=>o.crit==="Critical").length} of them Critical.`,"","ev","owner register",`<button class="linkish" data-goto="register">Register</button>`)}
    ${qcard(7,"What changed in the last 7 days?",c7(),`${recent.length} recorded events since ${fmtD(since)}.`,c7rows(),"ev","audit trail",`<button class="linkish" data-goto="tower">Activity</button>`)}
    ${qcard(8,"Who is not delivering?",c8(),ownRank.length?`${ownRank.length} owner${ownRank.length===1?"":"s"} with rejections, open actions or late items.`:"No owner is behind.","","ev","rejections, actions and SLA history",`<button class="linkish" data-goto="issues">Escalations</button>`)}
  </div>`;
}
function viewDecisions(){
  const f=forecasts();
  const nOpen=DECISIONS.filter(d=>decRec(d.id).status==="Open").length;
  const HINT={recover:"Deploys a recovery team",rebase:"Re-baselines the milestone by 90 days"};
  const cards=DECISIONS.map(d=>{const r=decRec(d.id),x=f.find(y=>y.id===d.venue),left=daysBetween(S.today,d.lrm),open=r.status==="Open";
    const c=!open?"mute":left<21?"bad":left<90?"warn":"good";
    const badge=open?`<div class="dday lg ${c}"><b>${Math.abs(left)}</b><span>${left<0?"days over":"days left"}</span></div>`:`<div class="dday lg mute"><b>✓</b><span>decided</span></div>`;
    const stat=open?(left<0?`Last responsible moment passed ${dd(left)} ago`:`Decide by ${fmtD(d.lrm)}`):`Decided ${fmtD(r.t)}`;
    const vis=open?(x?`<div class="dvis"><div class="dv-l"><span>Chance of meeting the ${fmtD(x.gateDate)} milestone</span><b>${pct(x.prob)}%</b></div>${barV(pct(x.prob),probCls(x.prob))}<div class="flex"><span class="pill ${x.cls}">P80 ${fmtD(x.d80)}</span><span class="pill ${x.late80>0?"p-bad":"p-good"}">${x.late80>0?dd(x.late80)+" late":"inside milestone"}</span></div></div>`:""):
      `<div class="vs">${vsV("Before",r.beforeProb,r.before,r.beforeLate)}<div class="vs-ar" aria-hidden="true">→</div>${vsV("After",r.afterProb,r.after,r.afterLate,true)}</div>`;
    const opts=open?`<div class="opts">${d.options.map((o,i)=>`<button class="opt ${i===0?"primary":""}" data-decide="${d.id}" data-opt="${i}"><b>${esc(o.t)}</b>${HINT[o.fx]&&!/recover/i.test(o.t)?`<small>${HINT[o.fx]}</small>`:""}</button>`).join("")}</div>`:`<div class="done"><span class="eyebrow">Option taken</span><b>${esc(d.options[r.choice].t)}</b></div>`;
    return `<article class="dec ${open?"":"isdone"}" id="dec-${d.id}">
      <div class="dec-top">${badge}<div class="dec-main"><div class="mono muted" style="font-size:12px">${d.id} · ${esc(sn(d.venue))} · owner ${esc(d.owner)}</div><h3>${esc(d.title)}</h3><p>${esc(d.q)}</p><div class="flex"><span class="pill ${open?(left<21?"p-bad":left<90?"p-warn":"p-info"):"p-mute"}">${stat}</span></div></div></div>
      ${vis?`<div class="dec-vis">${vis}</div>`:""}${opts}</article>`}).join("");
  return headV(`Decision log · ${nOpen} open · ${DECISIONS.length-nOpen} decided`,"Decisions","Each decision carries its last responsible moment: the latest date it can be taken before options start to close. Taking one re-runs the forecast at once, so the effect on P80 is visible in the room.")+`<div class="grid decs">${cards}</div>`;
}
function intakeCard(){const s=WNSTwin.summary();
  const steps=Array.from({length:7},(_,i)=>`<i class="${i<s.step?"done":i===s.step?"cur":""}"></i>`).join("");
  const pass=Math.max(0,s.checked-s.open);
  const checks=s.checked?`${segV([{n:pass,c:"var(--good)",l:"pass"},{n:s.open,c:"var(--bad)",l:"open"}])}${legV([{n:pass,c:"var(--good)",l:"pass"},{n:s.open,c:"var(--bad)",l:"open"}])}`:`<div class="muted" style="font-size:13px">Checks not run yet</div>`;
  return `<div class="panel intake-card" id="intakeCard"><div class="eyebrow">3D design review</div><h3>Design intake</h3><p class="muted" style="margin:0 0 18px;font-size:13px">King Salman International Stadium, Riyadh · simulated</p>
  <div class="ik-top"><div class="ik-rev"><span>Model</span><b>Rev ${s.rev}</b></div><div class="ik-rev"><span>G1 Design freeze</span><span class="pill ${s.gate.cls}">${esc(s.gate.t)}</span></div></div>
  <div class="ik-steps"><div class="ik-l"><span>Step ${s.step+1} of 7</span><b>${esc(s.stepName)}</b></div><div class="ik-dots">${steps}</div></div>
  <div class="ik-checks"><div class="ik-l"><span>Design checks</span><b>${s.checked?`${pass} of 9 pass`:"–"}</b></div>${checks}</div>
  <div class="flex" style="margin-top:22px"><button class="primary" data-goto="twin">Open 3D twin</button><button class="linkish" data-goto="register" data-venue="RUH">Venue obligations</button></div></div>`;}
function viewRegister(){
  const fams=[...new Set(S.obligations.map(o=>o.family))];
  let list=S.obligations.filter(o=>(filters.venue==="all"||o.venue===filters.venue)&&(filters.family==="all"||o.family===filters.family)&&(filters.state==="all"||o.state===filters.state)&&(!filters.q||(o.text+o.id+o.owner).toLowerCase().includes(filters.q.toLowerCase())));
  const opt=(arr,cur)=>arr.map(([v,l])=>`<option value="${esc(v)}" ${v===cur?"selected":""}>${esc(l)}</option>`).join("");
  const proven=list.filter(isProven).length, P=stP(list);
  const cr=["Critical","High","Medium"].map(c=>{const L=list.filter(o=>o.crit===c);return {c,n:L.length,p:L.filter(isProven).length}}), mx=Math.max(1,...cr.map(x=>x.n));
  const summary=`<div class="sumrow">
    <div class="sumcard"><div class="eyebrow">In view</div><div class="v3">${ringV([{n:proven,c:"var(--brand-deep)"},{n:Math.max(list.length-proven,0),c:"var(--sunk)"}],`${proven}/${list.length}`,"proven","sm")}<div class="v3-side"><div class="kpi"><b>${list.length}</b><span>of ${S.obligations.length}<br>obligations</span></div><div class="muted" style="font-size:12.5px">${list.length?pct(proven/list.length)+"% backed by validated evidence":"Nothing matches these filters"}</div></div></div></div>
    <div class="sumcard"><div class="eyebrow">By state</div>${segV(P)}${legV(P)}</div>
    <div class="sumcard"><div class="eyebrow">By criticality</div><div class="hbs">${cr.map(x=>hbV(x.c,[{n:x.p,k:"good"},{n:x.n-x.p,k:"oth"}],`${x.p}/${x.n}`,mx)).join("")}</div><div class="leg"><span><i class="good"></i>proven</span><span><i class="oth"></i>not yet</span></div></div></div>`;
  return headV(`Obligation register · ${S.obligations.length} obligations`,"Obligation register","Each FIFA clause becomes an owned, testable obligation with a measurable acceptance criterion. Status changes only when evidence passes the rule.")+summary+`
  <div class="filters">
    <select id="fVenue" aria-label="Venue">${opt([["all","All venues"],...VENUES.map(v=>[v.id,v.name])],filters.venue)}</select>
    <select id="fFamily" aria-label="Requirement family">${opt([["all","All families"],...fams.map(f=>[f,f])],filters.family)}</select>
    <select id="fState" aria-label="State">${opt([["all","All states"],...["Assigned","Submitted","Validated","Verified","Rejected"].map(s=>[s,s])],filters.state)}</select>
    <input id="fQ" type="search" placeholder="Search obligations" value="${esc(filters.q)}" aria-label="Search">
    <span class="muted">${list.length} shown</span>
  </div>
  <div class="tablewrap"><table><thead><tr><th>ID</th><th>Obligation</th><th>Criterion (illustrative)</th><th>Criticality</th><th>Owner</th><th>Gate</th><th>State</th></tr></thead><tbody>
  ${list.map(o=>{const d=depBlocked(o);return `<tr class="click" data-obl="${o.id}" tabindex="0"><td class="mono">${o.id}</td><td>${esc(o.text)}<div class="muted" style="font-size:12px">${esc(venueMeta(o.venue).name)} · ${esc(o.clause)}</div>${d?`<div style="font-size:12px;color:var(--warn)">Blocked by ${d.id}</div>`:""}</td><td class="mono">${esc(o.op==="bool"?"yes":({min:"≥ ",max:"≤ ",eq:"= "}[o.op]+fmtN(o.value)+" "+o.unit))}</td><td>${critV(o.crit)}</td><td>${esc(o.owner)}</td><td><span class="gchip">${o.gate}</span></td><td><span class="pill ${stateCls(o.state)}">${o.state}</span>${o.claim&&o.state!=="Validated"&&o.state!=="Verified"?`<div class="muted" style="font-size:11.5px;margin-top:3px">Owner says done</div>`:""}</td></tr>`}).join("")||`<tr><td colspan="7" class="muted">No obligations match these filters.</td></tr>`}
  </tbody></table></div>`;
}

function viewGates(){
  const evs=VENUES.map(m=>({m,v:venueState(m.id),e:gateEval(m.id)}));
  const ready=evs.filter(x=>x.e&&x.e.pass).length, blocked=evs.filter(x=>x.e&&!x.e.pass).length, done=evs.filter(x=>!x.e).length;
  const failing=evs.reduce((a,x)=>a+(x.e?x.e.rules.filter(r=>!r.ok).length:0),0);
  const GP=[{n:ready,c:"var(--good)",l:"ready to pass"},{n:blocked,c:"var(--bad)",l:"blocked"},{n:done,c:"var(--brand-deep)",l:"all gates passed"}];
  const sum=`<div class="sumrow"><div class="sumcard"><div class="eyebrow">Gate status</div>${kpiV(blocked,"venue"+(blocked===1?"":"s")+" blocked at their next gate",blocked?"t-bad":"t-good")}${segV(GP)}${legV(GP)}</div>
    <div class="sumcard"><div class="eyebrow">Failing rules</div>${kpiV(failing,"rule"+(failing===1?"":"s")+" failing across all venues",failing?"t-warn":"t-good")}<div class="muted" style="font-size:13px">Each blocked gate lists the obligations holding it back.</div></div></div>`;
  const cards=evs.map(({m,v,e})=>{
    const track=gtrackV(v.gateIdx);
    if(!e) return `<div class="panel gcard" id="gate-${m.id}"><div class="gc-head"><div><h3>${esc(m.name)}</h3><div class="muted" style="font-size:13px">${esc(m.city)}</div></div><span class="pill p-good">All gates passed</span></div>${track}<div class="okbig"><i>✓</i><span>All gates passed</span></div></div>`;
    const okN=e.rules.filter(r=>r.ok).length, ring=ringV([{n:okN,c:"var(--good)"},{n:e.rules.length-okN,c:"var(--bad)"}],`${okN}/${e.rules.length}`,"rules pass","sm");
    return `<div class="panel gcard" id="gate-${m.id}">
      <div class="gc-head"><div style="min-width:0"><h3>${esc(m.name)}</h3><div class="muted" style="font-size:13px">${esc(m.city)} · gate <b>${e.gate.id} ${esc(e.gate.name)}</b> due ${fmtD(v.gateDate)} · ${e.scope.length} obligations in scope</div></div><span class="pill ${e.pass?"p-good":"p-bad"}">${e.pass?"Ready to pass":"Gate blocked"}</span></div>
      ${track}
      <div class="gc-body"><ul class="rules">${e.rules.map(r=>`<li class="${r.ok?"ok":"no"}"><span class="ic ${r.ok?"ok":"no"}" aria-hidden="true">${r.ok?"✓":"✕"}</span><div style="min-width:0"><div class="rt">${esc(r.text)}</div>${r.ok?"":`<div class="bch">${r.blockers.slice(0,6).map(o=>`<button class="bchip" data-obl="${o.id}">${o.code}<small>${o.state}</small></button>`).join("")}${r.blockers.length>6?`<span class="muted" style="font-size:12px">and ${r.blockers.length-6} more</span>`:""}</div>`}</div></li>`).join("")}</ul>
        <div class="gc-side">${ring}<button class="${e.pass?"gold":""}" data-gate="${m.id}">Request gate pass</button>${e.pass?"":`<button class="danger" data-escalate-gate="${m.id}">Escalate blockers</button>`}</div></div></div>`}).join("");
  return headV(`Readiness gates · ${ready} ready · ${blocked} blocked`,"Readiness gates","A gate cannot pass while its rules fail. The engine lists every blocker and can escalate them in one step.")+sum+`<div class="grid">${cards}</div>`;
}

function viewIssues(){
  const open=S.issues.filter(i=>i.status==="Open"), closed=S.issues.filter(i=>i.status!=="Open");
  const counts=LEVELS.map((_,l)=>open.filter(i=>i.level===l).length), mx=Math.max(1,...counts), late=open.filter(i=>S.today>i.due).length;
  const lvCols=["var(--mint)","var(--warn)","var(--bad)","var(--brand-deep)"];
  const card=i=>{const o=S.obligations.find(x=>x.id===i.obl), isOpen=i.status==="Open", start=i.opened||(i.history[0]&&i.history[0].t)||S.today;
    const left=daysBetween(S.today,i.due), tot=Math.max(1,daysBetween(start,i.due)), el=daysBetween(start,S.today), p=isOpen?Math.max(2,Math.min(100,el/tot*100)):100, lt=isOpen&&left<0;
    const cls=!isOpen?"p-good":lt?"p-bad":p>70?"p-warn":"p-good";
    return `<article class="issue ${lt?"late":""} ${isOpen?"":"closed"}"><div class="is-top"><span class="mono muted">${i.id}</span>${critV(i.crit)}<span class="spacer"></span>${isOpen?`<span class="pill ${lt?"p-bad":"p-mute"}">${lt?"Past SLA":"Within SLA"}</span>`:`<span class="pill p-good">Closed by evidence</span>`}</div>
      <h3>${esc(i.title)}</h3><div class="muted" style="font-size:13px"><button class="linkish" data-obl="${o.id}">${o.id}</button> · ${esc(venueMeta(o.venue).name)}</div>
      <div class="lvl"><div class="lvl-dots">${LEVELS.map((l,k)=>`<i class="${k<=i.level?"on":""}" style="${k<=i.level?"background:"+lvCols[k]:""}" title="${esc(l)}"></i>`).join("")}</div><span>${esc(LEVELS[i.level])}</span></div>
      <div class="sla"><div class="sla-l"><span>${isOpen?(lt?`${dd(left)} late`:`${dd(left)} left`):`Closed ${fmtD(i.closed)}`}</span><b>${isOpen?"Due "+fmtD(i.due):"SLA met"}</b></div>${barV(p,cls)}</div>
      <details class="hist"><summary>History · ${i.history.length} event${i.history.length===1?"":"s"}</summary><div class="tl">${i.history.map(h=>`<div class="tli mid"><i></i><div><span class="mono muted">${fmtD(h.t)}</span><div>${esc(h.a)}</div></div></div>`).join("")}</div></details>
      ${isOpen&&i.level<LEVELS.length-1?`<div class="flex"><button data-esc="${i.id}">Escalate to ${esc(LEVELS[i.level+1])}</button></div>`:""}</article>`};
  return headV(`Escalations · ${open.length} open · ${late} past SLA`,"Escalations and corrective actions",`Every failed check opens a corrective action with an SLA set by criticality (Critical ${SLA.Critical} days, High ${SLA.High}, Medium ${SLA.Medium}). A missed SLA climbs the ladder. An issue closes only when new evidence passes validation.`)+`
  <div class="ladder">${LEVELS.map((l,i)=>`<div class="rung"><div class="lv">Level ${i+1}</div><div class="ct">${counts[i]}</div><div style="font-size:13px;font-weight:500">${esc(l)}</div><div class="mb-tr"><i style="width:${counts[i]/mx*100}%;background:${lvCols[i]}"></i></div></div>`).join("")}</div>
  <section class="block"><div class="block-head"><div><div class="eyebrow">Corrective actions</div><h3>Open issues</h3></div></div>${open.length?`<div class="grid issues">${open.map(card).join("")}</div>`:`<div class="panel"><div class="okbig"><i>✓</i><span>No open issues</span></div></div>`}</section>
  ${closed.length?`<section class="block"><div class="block-head"><div><div class="eyebrow">Resolved</div><h3>Closed by evidence</h3></div></div><div class="grid issues">${closed.map(card).join("")}</div></section>`:""}`;
}

const CHANGES=[
  {id:"lux",title:"Floodlighting: vertical illuminance minimum raised from 2,500 to 3,000 lux",code:"LGT-01",value:3000},
  {id:"media",title:"Media: tribune seat minimum for group-stage venues raised from 1,600 to 1,800",code:"MED-01",value:1800,skip:["RUH"]},
  {id:"heat",title:"Climate: bowl temperature maximum lowered from 26 to 24 °C",code:"CLM-01",value:24}
];
let selChange="lux";
function changeImpact(c){
  const aff=S.obligations.filter(o=>o.code===c.code&&!(c.skip||[]).includes(o.venue));
  return aff.map(o=>{const e=o.evidence[o.evidence.length-1];const old=e?passes(o,e.value):null;const nw=e?passes(Object.assign({},o,{value:c.value}),e.value):null;
    return {o,e,old,nw,flip:e&&e.result!=="fail"&&old&&!nw}});
}
function viewChange(){
  const c=CHANGES.find(x=>x.id===selChange), rows=changeImpact(c), flips=rows.filter(r=>r.flip);
  const applied=S.applied&&S.applied.includes(c.id);
  const cat=r=>r.flip?"flip":!r.e?"none":r.nw?"ok":"fail";
  const nOf=k=>rows.filter(r=>cat(r)===k).length, nV=new Set(rows.map(r=>r.o.venue)).size;
  const P=[{n:nOf("flip"),c:"var(--bad)",l:"newly failing"},{n:nOf("ok"),c:"var(--good)",l:"still compliant"},{n:nOf("fail"),c:"var(--warn)",l:"already failing"},{n:nOf("none"),c:"color-mix(in srgb,var(--muted) 30%,var(--sunk))",l:"no evidence yet"}];
  const MXI={flip:["bad","✕","flips to fail"],ok:["good","✓","stays compliant"],fail:["warn","!","already failing"],none:["mute","–","criterion updated"]};
  const mx=rows.map(r=>{const m=MXI[cat(r)];return `<button class="mx ${m[0]}" data-obl="${r.o.id}"><i>${m[1]}</i><span>${esc(sn(r.o.venue))}</span><small>${m[2]}</small></button>`}).join("");
  return headV(`Change impact · ${rows.length} obligations · ${nV} venues`,"Change impact","When FIFA updates a guideline or a design changes, the engine re-tests existing evidence against the new rule and shows what silently stops complying. The updates below are simulated.")+`
  <div class="filters"><select id="chSel" aria-label="Guideline update">${CHANGES.map(x=>`<option value="${x.id}" ${x.id===selChange?"selected":""}>${esc(x.title)}</option>`).join("")}</select></div>
  <div class="sumcard mxcard"><div class="eyebrow">Impact by venue</div><div class="mxs">${mx}</div></div>
  <div class="grid cols" style="margin-top:24px"><div class="tablewrap"><table><thead><tr><th>Obligation</th><th>Venue</th><th>Current evidence</th><th>Old rule</th><th>New rule</th></tr></thead><tbody>
  ${rows.map(r=>`<tr class="${r.flip?"flip":""}"><td class="mono"><button class="linkish" data-obl="${r.o.id}">${r.o.id}</button></td><td>${esc(venueMeta(r.o.venue).name)}</td><td class="mono">${r.e?showVal(r.o,r.e.value):"none yet"}</td><td>${r.e?`<span class="pill ${r.old?"p-good":"p-bad"}">${r.old?"Pass":"Fail"}</span>`:"–"}</td><td>${r.e?`<span class="pill ${r.nw?"p-good":"p-bad"}">${r.nw?"Pass":"Fail"}</span>`:`<span class="muted">criterion updated</span>`}</td></tr>`).join("")}
  </tbody></table></div>
  <div class="panel"><div class="eyebrow">Previously compliant, now failing</div><div class="v3" style="margin:6px 0 14px">${ringV(P,flips.length,"of "+rows.length,"sm")}<div class="v3-side"><div class="impact-num">${flips.length}</div><div class="muted" style="font-size:13px">${flips.length===1?"obligation flips":"obligations flip"} to Rejected</div></div></div>${legV(P)}
  <p style="margin:16px 0 14px;font-size:13.5px" class="muted">${rows.length} obligations across ${nV} venues carry this clause. Applying the update re-baselines the criterion, reverts failing evidence to Rejected and opens corrective actions.</p>
  <button class="primary" id="applyChange" ${applied?"disabled":""}>${applied?"Update applied":"Apply update"}</button></div></div>`;
}
function applyChange(){
  const c=CHANGES.find(x=>x.id===selChange); let n=0;
  S.obligations.filter(o=>o.code===c.code&&!(c.skip||[]).includes(o.venue)).forEach(o=>{o.value=c.value;o.clause+=" (rev. 2)";log("Compliance office",`Criterion re-baselined: ${c.title}`,o.id);
    const e=o.evidence[o.evidence.length-1];
    if(e&&e.result!=="pending"&&!passes(o,e.value)&&(o.state==="Validated"||o.state==="Verified")){o.state="Rejected";e.result="fail";n++;openIssue(o,`Re-test needed after guideline update`);log("Rule engine","Evidence no longer meets revised criterion",o.id);}
  });
  S.applied=(S.applied||[]).concat(c.id); save(); render(); toast(`${n} obligation${n===1?"":"s"} reverted to Rejected and corrective actions opened.`);
}

let dossierVenue="KHO";
function viewDossier(){
  const m=venueMeta(dossierVenue), list=oblsOf(m.id), sc=scores(list), v=venueState(m.id);
  const fams=[...new Set(list.map(o=>o.family))];
  const ready=list.filter(isProven).length, nIss=S.issues.filter(i=>i.status==="Open"&&list.some(o=>o.id===i.obl)).length;
  const fam=fams.map(f=>{const L=list.filter(o=>o.family===f);return {f,n:L.length,p:L.filter(isProven).length}}), fmx=Math.max(1,...fam.map(x=>x.n));
  const P=stP(list);
  const summary=`<div class="dsum"><div class="dsum-r">${ringV([{n:sc.assured,c:"var(--brand-deep)"},{n:Math.max(1-sc.assured,0),c:"var(--sunk)"}],pct(sc.assured)+"%","assured","lg")}</div>
    <div class="dsum-m"><div class="mini-grid"><div class="mini good"><b>${ready}/${list.length}</b><span>evidence-backed</span></div><div class="mini ${nIss?"bad":"good"}"><b>${nIss}</b><span>open issues</span></div></div>${segV(P)}${legV(P)}</div>
    <div class="dsum-f"><div class="eyebrow">By requirement family</div><div class="hbs">${fam.map(x=>hbV(esc(x.f),[{n:x.p,k:"good"},{n:x.n-x.p,k:"oth"}],`${x.p}/${x.n}`,x.n)).join("")}</div></div></div>`;
  return headV(`Inspection dossier · ${esc(m.name)}`,"FIFA inspection dossier","Generated from validated evidence and the audit trail, in requirement order. Nothing in it is self-declared.")+`
  <div class="filters"><select id="dvSel" aria-label="Venue">${VENUES.map(x=>`<option value="${x.id}" ${x.id===m.id?"selected":""}>${esc(x.name)}</option>`).join("")}</select><button id="copyDossier">Copy as text</button></div>
  <article class="dossier" id="dossierDoc">
    <div class="stamp">COMPLIANCE DOSSIER · GENERATED ${fmtD(S.today).toUpperCase()} · SAMPLE DATA</div>
    <h2 style="margin-top:6px">${esc(m.name)}, ${esc(m.city)}</h2>
    <p class="muted" style="margin:0">${esc(m.type)}${m.role?" · "+esc(m.role):""}${m.capacity?` · planned capacity about ${fmtN(m.capacity)}`:""} · next gate ${v.gateIdx<GATES.length?GATES[v.gateIdx].id+" "+GATES[v.gateIdx].name:"none"}</p>
    ${summary}
    ${fams.map(f=>`<h3>${esc(f)}</h3><div class="tablewrap"><table><thead><tr><th>Ref</th><th>Requirement</th><th>Criterion (illustrative)</th><th>Evidence</th><th>Result</th></tr></thead><tbody>${list.filter(o=>o.family===f).map(o=>{const e=o.evidence[o.evidence.length-1];return `<tr><td class="mono">${o.code}<div class="muted">${esc(o.clause)}</div></td><td>${esc(o.text)}</td><td class="mono">${esc(o.op==="bool"?"yes":({min:"≥ ",max:"≤ ",eq:"= "}[o.op]+fmtN(o.value)+" "+o.unit))}</td><td>${e?`${esc(e.file)}<div class="muted" style="font-size:12px">${esc(e.issuer)} · ${fmtD(e.date)} · ${showVal(o,e.value)}</div>`:`<span class="muted">No evidence</span>`}</td><td><span class="pill ${stateCls(o.state)}">${o.state}</span>${o.verifiedBy?`<div class="muted" style="font-size:11.5px">${esc(o.verifiedBy)}</div>`:""}</td></tr>`}).join("")}</tbody></table></div>`).join("")}
    <h3>Audit trail</h3><div class="tl">${S.audit.filter(a=>a.obl&&a.obl.startsWith(m.id+"-")).slice(-12).reverse().map(a=>`<div class="tli mid"><i></i><div><span class="mono muted">${fmtD(a.t)}</span><div>${esc(a.obl)}: <b>${esc(a.actor)}</b> ${esc(a.action)}</div></div></div>`).join("")}</div>
  </article>`;
}
function dossierText(){
  const m=venueMeta(dossierVenue),list=oblsOf(m.id),sc=scores(list);
  return [`COMPLIANCE DOSSIER: ${m.name}, ${m.city} (sample data)`,`Generated ${fmtD(S.today)} · assured readiness ${pct(sc.assured)}%`,""].concat(list.map(o=>{const e=o.evidence[o.evidence.length-1];return `${o.code} [${o.state}] ${o.text} | ${critText(o)} | ${e?e.file+" ("+showVal(o,e.value)+")":"no evidence"}`})).join("\n");
}

const SAMPLE_CLAUSE=`4.1 Floodlighting. The stadium shall provide vertical illuminance of not less than 2,500 lux towards fixed cameras across the field of play. Uniformity (U2) of vertical illuminance shall be at least 0.7.
4.2 Power. Floodlighting shall be supported by an uninterruptible power supply with automatic changeover.
4.3 The emergency lighting system must restore at least 800 lux within 5 seconds of a mains failure.
4.4 Glare to players and spectators should be minimised in line with good practice.`;
let decoInput=SAMPLE_CLAUSE, decoOut=null, decoVenue="RUH";
function decompose(text){
  const sents=text.replace(/\s+/g," ").split(/(?<=[.;])\s+(?=[A-Z0-9])/).map(s=>s.trim()).filter(Boolean);
  let ref="";
  return sents.map(s=>{
    const m=s.match(/^(\d+(?:\.\d+)*)\s+(.*)$/); if(m){ref=m[1];s=m[2];}
    const t=s.replace(/^[A-Z][a-z]+\.\s+/,"");
    const binding=/\b(shall|must|is required to)\b/i.test(t), advisory=/\bshould\b/i.test(t)&&!binding;
    if(!binding&&!advisory) return null;
    const num=t.match(/(?<![A-Za-z\d.])(\d[\d,]*\.?\d*)\s*(lux|seconds|second|minutes|min|m²|m2|m|seats|positions|rooms|°C|%|kV|kW)?/i);
    let op="bool",value=null,unit="";
    if(num){value=Number(num[1].replace(/,/g,""));unit=(num[2]||"").replace("m2","m²");
      if(/not less than|at least|minimum|no fewer than/i.test(t)) op="min"; else if(/not exceed|maximum|no more than|within|up to/i.test(t)) op="max"; else op="eq";}
    const fam=/lux|illumin|uniform|glare|floodlight/i.test(t)?"Floodlighting":/power|supply|ups/i.test(t)?"Power":/emergency/i.test(t)?"Safety & security":"General";
    const crit=binding&&op!=="bool"?"Critical":binding?"High":"Medium";
    return {ref:ref||"–",text:t.replace(/\.$/,""),binding,op,value,unit,fam,crit,keep:binding};
  }).filter(Boolean);
}
function viewDecompose(){
  const LG=[["Binding","“shall”, “must”","Become obligations with an owner and a gate.","p-info"],["Advisory","“should”","Stays advisory and optional to keep.","p-mute"],["Measurable","numbers with units","Become pass or fail criteria the evidence check can test.","p-good"],["Yes / no","no number","Become checks that need a certificate.","p-warn"]];
  const legend=`<div class="lgrid">${LG.map(([t,k,x,c])=>`<div class="lg-c"><span class="pill ${c}">${t}</span><b>${k}</b><span>${x}</span></div>`).join("")}</div>`;
  let sum="";
  if(decoOut){const nB=decoOut.filter(d=>d.binding).length,nA=decoOut.length-nB,nM=decoOut.filter(d=>d.op!=="bool").length,nY=decoOut.length-nM;
    sum=`<div class="mini-grid four" style="margin-top:24px">${[[nB,"binding","good"],[nA,"advisory","mid"],[nM,"measurable criteria","good"],[nY,"yes / no checks","warn"]].map(([n,l,c])=>`<div class="mini ${c}"><b>${n}</b><span>${l}</span></div>`).join("")}</div>`;}
  return headV("Decompose requirements · rule-based PoC","Decompose requirements","Paste FIFA clause text. The engine splits it into atomic obligations, flags binding language and extracts measurable criteria. In the full product a language model does this with a reviewer approving every line; this PoC uses rules.")+`
  <div class="grid cols"><div class="panel"><label class="f" for="decoIn">Clause text (sample written for the demo)</label><textarea id="decoIn" style="margin-top:6px">${esc(decoInput)}</textarea><div class="flex" style="margin-top:14px"><button class="primary" id="decoRun">Decompose</button><button class="ghost" id="decoSample">Load sample</button></div></div>
  <div class="panel"><div class="eyebrow">What to look for</div><h3>How clauses are read</h3>${legend}</div></div>
  ${decoOut?`${sum}<div style="margin-top:24px"><div class="flex" style="justify-content:space-between;margin-bottom:14px"><h3 style="margin:0">${decoOut.length} candidate obligations</h3><div class="flex"><label class="f" style="flex-direction:row;align-items:center;gap:8px" for="decoV">Add to</label><select id="decoV">${VENUES.map(v=>`<option value="${v.id}" ${v.id===decoVenue?"selected":""}>${esc(v.name)}</option>`).join("")}</select><button class="primary" id="decoAdd">Add selected to register</button></div></div>
  <div class="tablewrap"><table><thead><tr><th>Keep</th><th>Ref</th><th>Obligation</th><th>Type</th><th>Criterion</th><th>Family</th><th>Criticality</th></tr></thead><tbody>${decoOut.map((d,i)=>`<tr><td><input type="checkbox" data-keep="${i}" ${d.keep?"checked":""} aria-label="Keep obligation ${i+1}"></td><td class="mono">${esc(d.ref)}</td><td>${esc(d.text)}</td><td><span class="pill ${d.binding?"p-info":"p-mute"}">${d.binding?"Binding":"Advisory"}</span></td><td class="mono">${d.op==="bool"?"yes / no":({min:"≥ ",max:"≤ ",eq:"= "}[d.op]+fmtN(d.value)+" "+d.unit)}</td><td>${esc(d.fam)}</td><td>${critV(d.crit)}</td></tr>`).join("")}</tbody></table></div></div>`:""}`;
}
function decoAdd(){
  const v=venueMeta(decoVenue); let n=0;
  decoOut.forEach((d,i)=>{ if(!d.keep) return; n++;
    const code=`NEW-${String(S.seq++).padStart(2,"0")}`;
    const o={code,family:d.fam,clause:`Pasted clause §${d.ref}`,text:d.text,op:d.op,value:d.value,unit:d.unit,crit:d.crit,gate:"G4",owner:"To be assigned",id:`${v.id}-${code}`,venue:v.id,evidence:[],state:"Assigned",claim:false};
    S.obligations.push(o); log("Compliance office","Obligation created from decomposed clause",o.id);
  });
  save(); filters={venue:v.id,family:"all",state:"Assigned",q:""}; location.hash="register"; toast(`${n} obligations added to ${v.name}.`);
}

// ---------- drawer ----------
let drawerId=null, lastResult=null;
function openDrawer(id){drawerId=id;lastResult=null;renderDrawer();}
function closeDrawer(){drawerId=null;$("#drawerRoot").innerHTML="";}
function renderDrawer(){
  if(!drawerId){$("#drawerRoot").innerHTML="";return}
  setTimeout(()=>applyHL(false),0);
  const o=S.obligations.find(x=>x.id===drawerId); if(!o){closeDrawer();return}
  const m=venueMeta(o.venue), iss=issueFor(o), dep=depBlocked(o), e=o.evidence[o.evidence.length-1];
  const path=["Assigned","Submitted","Validated","Verified"];
  const reached=o.state==="Rejected"?1:path.indexOf(o.state);
  const audit=S.audit.filter(a=>a.obl===o.id).slice().reverse();
  const valInput=o.op==="bool"?`<select id="evVal"><option value="yes">Yes, confirmed</option><option value="no">No</option></select>`:`<input id="evVal" type="number" step="any" placeholder="e.g. ${fmtN(o.value)}" required>`;
  $("#drawerRoot").innerHTML=`<div class="drawer-bg" data-close></div><aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="dTitle">
    <button class="ghost close" data-close aria-label="Close">Close</button>
    <div><div class="mono muted">${o.id} · ${esc(o.clause)}</div><h2 id="dTitle" style="font-size:19px;margin-top:4px;padding-right:56px">${esc(o.text)}</h2><div class="muted">${esc(m.name)}, ${esc(m.city)}</div></div>
    <div class="stepper">${path.map((p,i)=>`<span class="${o.state==="Rejected"&&i===2?"rej":i<=reached?"on":""}">${o.state==="Rejected"&&i===2?"Rejected":p}</span>`).join("")}</div>
    <div class="criterion">${esc(critText(o))}</div><div class="muted" style="font-size:12px;margin-top:-6px">Illustrative threshold for the PoC. The live library loads values and clause references from the authority's FIFA documents.</div>
    <dl class="kv"><dt>Family</dt><dd>${esc(o.family)}</dd><dt>Criticality</dt><dd>${o.crit} (weight ${WEIGHT[o.crit]}, SLA ${SLA[o.crit]} days)</dd><dt>Owner</dt><dd>${esc(o.owner)}</dd><dt>Gate</dt><dd>${o.gate} ${GATES[gateNum(o.gate)-1].name}</dd>${o.verifiedBy?`<dt>Verified by</dt><dd>${esc(o.verifiedBy)}</dd>`:""}${o.claim?`<dt>Owner status</dt><dd>Declared complete</dd>`:""}</dl>
    ${dep?`<div class="result no">Blocked by dependency ${dep.id} (${esc(dep.text)}), currently ${dep.state}. This obligation cannot be ready before it.</div>`:""}
    ${iss?`<div class="result no"><b>${iss.id}</b> open at ${LEVELS[iss.level]}, SLA ${fmtD(iss.due)}${S.today>iss.due?" (late)":""}. Closes only when new evidence passes.</div>`:""}
    ${lastResult?`<div id="lastResult" class="result ${lastResult.ok?"ok":"no"}" role="status">${esc(lastResult.msg)}</div>`:""}
    <div class="flex">
      ${o.state==="Submitted"?`<button class="primary" data-validate>Run validation</button>`:""}
      ${o.state==="Validated"?`<button class="primary" data-verify>Verify as second line</button>`:""}
    </div>
    <section><h3>Evidence</h3>${o.evidence.length?`<div class="tablewrap"><table><thead><tr><th>File</th><th>Value</th><th>Result</th></tr></thead><tbody>${o.evidence.slice().reverse().map(x=>`<tr><td>${esc(x.file)}<div class="muted" style="font-size:12px">${esc(x.issuer)} · ${fmtD(x.date)} · ${MAT[x.maturity==null?1:x.maturity]} stage</div></td><td class="mono">${showVal(o,x.value)}</td><td><span class="pill ${x.result==="pass"?"p-good":x.result==="fail"?"p-bad":"p-warn"}">${x.result==="pass"?"Pass":x.result==="fail"?"Fail":"Pending"}</span></td></tr>`).join("")}</tbody></table></div>`:`<p class="muted">No evidence submitted yet.</p>`}</section>
    <section class="panel" style="background:var(--sunk);border:0"><h3>Submit new evidence</h3><form id="evForm" class="grid" style="gap:10px">
      <div class="formrow"><label class="f" for="evFile">Document<input id="evFile" value="${esc(o.code)}_${esc(o.venue)}_retest.pdf" required></label><label class="f" for="evIssuer">Issued by<select id="evIssuer">${ISSUERS.map(i=>`<option>${esc(i)}</option>`).join("")}</select></label><label class="f" for="evMat">Evidence stage<select id="evMat">${MAT.map((x,i)=>`<option value="${i}" ${i===Math.max(0,matOf(o))?"selected":""}>${x}</option>`).join("")}</select></label><label class="f" for="evVal">${o.op==="bool"?"Confirmed":"Measured value ("+esc(o.unit)+")"}${valInput}</label></div>
      <div><button class="primary" type="submit">Submit and validate</button></div></form></section>
    <section><h3>Audit trail</h3><div class="timeline">${audit.map(a=>`<div class="ev"><span class="mono muted">${fmtD(a.t)}</span><span><b>${esc(a.actor)}</b> ${esc(a.action)}</span></div>`).join("")||`<span class="muted">No activity yet.</span>`}</div></section>
  </aside>`;
  const f=$("#evForm"); f.addEventListener("submit",ev=>{ev.preventDefault();
    const raw=$("#evVal").value; if(o.op!=="bool"&&raw==="") return;
    const val=o.op==="bool"?raw:Number(raw);
    o.evidence.push({file:$("#evFile").value||"evidence.pdf",issuer:$("#evIssuer").value,value:val,date:S.today,result:"pending",reviewer:null,maturity:Number($("#evMat").value)});
    o.state="Submitted"; log(o.owner,"Submitted evidence",o.id);
    const ok=validate(o); lastResult={ok,msg:ok?`Pass: ${showVal(o,val)} meets ${critText(o)}. Ready for second-line verification.`:`Fail: ${showVal(o,val)} does not meet ${critText(o)}. Status set to Rejected and a corrective action opened.`};
    save(); render(); renderDrawer();
  });
  const btn=$("#drawerRoot .drawer .close"); if(btn&&!tour.active) btn.focus();
}


// ---------- guided demo ----------
const tour={active:false,i:0,playing:false,voice:true,voiceName:"",sel:null,timers:[],sent:0,gen:0};
const hasVoice=typeof window.speechSynthesis!=="undefined"&&typeof window.SpeechSynthesisUtterance!=="undefined";
function go(h){ if(location.hash!=="#"+h){ tour.nav=true; location.hash=h; } render(); }

const RR_STEPS=[
 {title:"Questions first",run:()=>{closeDrawer();go("readiness");return ".rr-hero"},
  say:()=>{const f=forecasts(),on=f.filter(x=>x.late80<=0).length;return `In 2034, forty-eight teams will play across fifteen stadiums in Saudi Arabia. An executive does not need another dashboard. They need answers. The Readiness Room opens on the questions that matter before every FIFA milestone, and answers each one from validated evidence. Right now, ${on} of ${f.length} venues make their next gate with eighty percent confidence.`}},
 {title:"PMC schedule versus evidence",run:()=>{go("readiness");return "#fcPanel"},
  say:()=>{const j=forecasts().find(x=>x.id==="JED");return `Take Jeddah. The PMC's schedule says Construction complete lands on ${fmtD(j.pmc.finish)}, with float to spare. The engine runs a thousand simulations on the evidence itself: what is still unproven, what was rejected, and how fast this venue really closes items. Its P50 is ${fmtD(j.d50)}. Its P80 is ${fmtD(j.d80)}. The chance of meeting FIFA's milestone is ${pct(j.prob)} percent.`}},
 {title:"Decide before options close",run:()=>{decide("DEC-01",0);go("decisions");return "#dec-DEC-01"},
  say:()=>{const r=decRec("DEC-01");return `So the tool raises a decision, with its last responsible moment, ${fmtD(decMeta("DEC-01").lrm)}. The executive deploys a recovery team, and the forecast re-runs at once. Jeddah's P80 moves from ${fmtD(r.before)} to ${fmtD(r.after)}. The chance of meeting the milestone rises from ${pct(r.beforeProb)} to ${pct(r.afterProb)} percent. ${r.afterLate>0?"It is still late, so the next lever is already in view.":"It is now inside FIFA's milestone."}`}}
];
const TOUR=[...RR_STEPS,
 {title:"Control tower",run:()=>{closeDrawer();go("tower");return ".tiles"},
  say:()=>{const s=scores(S.obligations);return `This is the control tower for the 2034 World Cup programme. Every FIFA requirement is tracked here as an owned obligation with a measurable criterion. Look at the first two numbers. Owners declare ${pct(s.declared)} percent readiness. Only ${pct(s.assured)} percent is backed by validated evidence. That gap of ${pct(s.declared-s.assured)} points is the risk a status report never shows.`}},
 {title:"Proven versus declared",run:()=>{go("tower");return ".venue"},
  say:"Every venue shows the same split. The solid bar is readiness proven by evidence. The hatched part is what owners say is done but nobody has proven yet. Each card also projects readiness at the venue's next gate."},
 {title:"The green that was red",run:()=>{go("tower");openDrawer("JED-LGT-01");return ".drawer .criterion"},
  say:"Here is King Abdullah Sports City in Jeddah, an existing stadium being upgraded for 2034. The lighting contractor has declared the new floodlighting complete. The acceptance criterion is precise: at least 2,500 lux towards the fixed cameras."},
 {title:"Evidence decides",run:()=>{if(drawerId!=="JED-LGT-01")openDrawer("JED-LGT-01");const b=$("[data-validate]");if(b)b.click();return "#lastResult"},
  say:"The engine checks the submitted commissioning test against the rule. It shows 1,850 lux. So the owner's complete is overturned. The obligation is rejected, and a corrective action opens with a seven day deadline. In a status report, this would have been green."},
 {title:"Escalation ladder",run:()=>{closeDrawer();go("issues");return ".ladder"},
  say:"Every failed check becomes a corrective action, with a deadline set by criticality. Critical items get seven days, high items fourteen."},
 {title:"Time moves on",run:()=>{go("issues");advance();return ".ladder"},
  say:"Let's move the programme clock forward one week. Actions that missed their deadline climb the ladder automatically: from the delivery owner, to the workstream lead, to the authority executive, and finally to ministerial steering. Nothing sits quietly in a spreadsheet."},
 {title:"The gate holds",run:()=>{go("gates");return "#gate-JED"},
  say:"Now the readiness gates. King Abdullah Sports City in Jeddah is due to pass Construction complete. The engine tests four rules. Every critical obligation verified. Evidence from the built stadium, not just drawings. At least ninety percent assured readiness. And no open critical issues."},
 {title:"Gate refused",run:()=>{go("gates");const b=$('[data-gate="JED"]');if(b)b.click();return "#gate-JED"},
  say:"The contractor requests the gate pass. The engine refuses it, and names every blocker. The tool does not just inform the decision. It enforces the standard."},
 {title:"Blockers escalated",run:()=>{go("gates");const b=$('[data-escalate-gate="JED"]');if(b)b.click();return "#gate-JED"},
  say:"With one click, every blocker is escalated straight to the authority executive, each with its own deadline and owner."},
 {title:"Base camp at risk",run:()=>{go("gates");openDrawer("TBC-R3-TBC-03");return ".drawer .result"},
  say:"Dependencies are tracked too. At team base camp R-03 in Riyadh, private training cannot be ready, because the team hotel evidence shows only 38 of the 50 rooms required. The risk surfaces weeks before a monthly pack would catch it."},
 {title:"FIFA changes the rules",run:()=>{closeDrawer();selChange="lux";go("change");return "#view .cols > .panel"},
  say:()=>{const f=changeImpact(CHANGES[0]).filter(r=>r.flip);const names=f.map(r=>venueMeta(r.o.venue).name).join(" and ");return `Requirements change over eight years. Here FIFA raises the floodlighting minimum from 2,500 to 3,000 lux. The engine re-tests every piece of existing evidence against the new rule. ${f.length===0?"No venue is affected this time.":f.length===1?"Floodlighting at "+names+" was compliant yesterday. Today it fails.":f.length+" obligations that were compliant yesterday fail today."}`}},
 {title:"Impact applied",run:()=>{selChange="lux";go("change");const b=$("#applyChange");if(b&&!b.disabled)b.click();return ".tablewrap"},
  say:"Applying the update re-baselines the criterion everywhere it appears, reverts the failing evidence, and opens corrective actions. Past compliance cannot silently decay."},
 {title:"Inspection tomorrow",run:()=>{dossierVenue="KHO";go("dossier");return "#dossierDoc"},
  say:"FIFA announces an inspection of Aramco Stadium in Al Khobar. The dossier is generated in one click, from validated evidence and the full audit trail. Nothing in it is self-declared."},
 {title:"From clause to obligation",run:()=>{decoInput=SAMPLE_CLAUSE;decoOut=decompose(SAMPLE_CLAUSE);go("decompose");return "#view .tablewrap"},
  say:"And this is where it all starts. Paste a FIFA clause, and the engine splits it into atomic obligations. It separates binding shall language from advisory should language, and pulls out the measurable criteria. In the full product, a language model does this, with a reviewer approving every line."},
 {title:"A design arrives",run:()=>{closeDrawer();go("twin");WNSTwin.play([0,1,2]);return ".tw-main"},
  say:"Now the front of the pipeline, before anything is built. This is King Salman International Stadium in Riyadh, the planned venue for the opening match and the final, with 92,760 seats. Its circular form rises from King Abdulaziz Park like a seed cracking the earth, wrapped in green walls and a green roof. The design team submits its model for the design freeze gate. The engine reads the model and pulls out the facts the requirements care about, noting where each one came from. Then it turns the requirements into nine checks, each with a threshold, a criticality and the gate it blocks. The submission you are about to see is simulated."},
 {title:"Failures shown in place",run:()=>{go("twin");WNSTwin.play([3]);return ".tw-main"},
  say:"The checks run against the model. Three fail, and each one lights up where the problem is. The north stand is short of seats, because its upper tier was deferred, which leaves the bowl below the eighty thousand needed for a final. The media tribune is too small. And the east stand has no wheelchair positions. Two more checks need evidence. The lighting calculation leaves out the south third of the pitch, and the green roof has no build-up data. The engine asks, rather than guesses."},
 {title:"Findings routed",run:()=>{go("twin");WNSTwin.play([4]);return ".tw-panel"},
  say:"Each fail becomes a non-conformance, and each gap becomes a clarification. All five go to named owners in the design team, with due dates set by criticality. From here they follow the same escalation ladder as everything else in the control tower."},
 {title:"Resubmission re-checked",run:()=>{go("twin");WNSTwin.play([5]);return ".tw-main"},
  say:"Six days later the design team sends revision D. The engine compares it with revision C, and re-runs only the four checks touched by the changes. The north upper tier is in, bringing the bowl to 92,760 seats. The tribune is wider, the east stand has wheelchair positions, and the full lighting grid is in. All four now pass."},
 {title:"Design freeze passed",run:()=>{go("twin");WNSTwin.play([6]);return ".tw-panel"},
  say:"The design freeze gate passes, because every critical and high check is backed by evidence. The open green roof question rides along as a tracked condition. If it lapses, it escalates and blocks the next gate."},
 {title:"Assurance, not reporting",run:()=>{go("readiness");return ".rr-hero"},
  say:"That is the difference. Readiness questions answered with a confidence level. Designs checked before they are built. Status earned by evidence. Gates that hold. Escalation that runs itself. And proof for FIFA at any moment. This is the compliance backbone of the programme control tower."}
];
let tourList=null;
const TL=()=>tourList||TOUR;
const tourName=()=>tourList===EXEC?"Executive demo":"Guided demo";
const EXEC=[...RR_STEPS,
 {title:"The gate holds",run:()=>{go("gates");const b=$('[data-gate="JED"]');if(b)b.click();return "#gate-JED"},
  say:"Jeddah asks to pass construction complete. The engine checks every critical obligation and the evidence behind it. It refuses the pass, and names each blocker. The standard is enforced, not just reported."},
 {title:"Escalation runs itself",run:()=>{go("issues");advance();return ".ladder"},
  say:"Every failure becomes an action with an owner and a deadline. Miss the deadline, and it climbs automatically, all the way to ministerial steering."},
 {title:"Designs checked before they are built",run:()=>{go("twin");WNSTwin.play([3]);return ".tw-main"},
  say:"The same discipline starts at design. This is King Salman International Stadium, home of the opening match and the final. The engine reads the design model, generates the checks, and shows each failure in place. Seats short in the north stand. A media tribune that is too small. No wheelchair positions in the east stand."},
 {title:"Fixed, re-checked, passed",run:()=>{go("twin");WNSTwin.play([5,6]);return ".tw-main"},
  say:"Six days later the design team resubmits. The engine re-runs only the four affected checks. All of them pass, and the design freeze gate clears, with one tracked condition."},
 {title:"When FIFA changes the rules",run:()=>{selChange="lux";go("change");const b=$("#applyChange");if(b&&!b.disabled)b.click();return ".tablewrap"},
  say:"When FIFA changes a requirement, the engine re-tests all past evidence at once, and reopens anything that no longer complies."},
 {title:"Proof on demand",run:()=>{dossierVenue="KHO";go("dossier");return "#dossierDoc"},
  say:"And when FIFA inspects, the dossier is ready in one click, built from validated evidence and a full audit trail."},
 {title:"One control tower",run:()=>{go("readiness");return ".rr-hero"},
  say:"One control tower. Every readiness question answered with a confidence level. Every requirement owned, proven and enforced, from the first drawing to the final whistle. We propose a twelve-week proof of concept to deliver it."}
];
function sentences(t){return t.match(/[^.!?]+[.!?]+/g)||[t]}
function clearTimers(){tour.timers.forEach(clearTimeout);tour.timers=[];}
function stopVoice(){clearTimers();tour.gen++;if(hasVoice)try{speechSynthesis.cancel()}catch(e){}}
// Narrator voice: prefer Saudi or Gulf English where the browser has one, then the presenter's own choice, then British English.
const GULF_EN=/^en[-_](SA|AE|QA|KW|BH|OM)/i, ARAB_NAME=/saudi|arab|hamed|naayf|zariyah|fatima|hamdan|shakir|maged|tarik|laila/i;
function voiceList(){if(!hasVoice)return [];try{return speechSynthesis.getVoices().filter(x=>/^(en|ar)/i.test(x.lang))}catch(e){return []}}
function pickVoice(){if(!hasVoice)return null;const v=voiceList();
  if(tour.voiceName){const c=v.find(x=>x.name===tour.voiceName);if(c)return c}
  return v.find(x=>GULF_EN.test(x.lang))||v.find(x=>/^en/i.test(x.lang)&&ARAB_NAME.test(x.name))||v.find(x=>/en-GB/i.test(x.lang)&&/natural|google|daniel|serena|libby|ryan/i.test(x.name))||v.find(x=>/en-GB/i.test(x.lang))||v.find(x=>/^en/i.test(x.lang))||null}
function voiceLabel(x){const ar=/^ar/i.test(x.lang),gulf=GULF_EN.test(x.lang)||(/^en/i.test(x.lang)&&ARAB_NAME.test(x.name));return `${x.name.replace(/^Microsoft |^Google /,"")} · ${x.lang}${gulf?" · Saudi/Gulf English":ar?" · Arabic voice reading English":""}`}
function voiceOptions(){const v=voiceList(),cur=pickVoice();if(!v.length)return "";
  const rank=x=>GULF_EN.test(x.lang)||(/^en/i.test(x.lang)&&ARAB_NAME.test(x.name))?0:/^ar-SA/i.test(x.lang)?1:/^ar/i.test(x.lang)?2:3;
  return v.slice().sort((a,b)=>rank(a)-rank(b)||a.name.localeCompare(b.name)).map(x=>`<option value="${esc(x.name)}" ${cur&&cur.name===x.name?"selected":""}>${esc(voiceLabel(x))}</option>`).join("")}
function applyHL(scroll){
  document.querySelectorAll(".tour-hl").forEach(e=>e.classList.remove("tour-hl"));
  if(!tour.active||!tour.sel) return;
  const el=document.querySelector(tour.sel); if(!el) return;
  el.classList.add("tour-hl");
  if(scroll) try{el.scrollIntoView({block:"center",behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"})}catch(e){el.scrollIntoView()}
}
function renderTour(){
  const r=$("#tourRoot"); document.body.classList.toggle("touring",tour.active); if(!tour.active){r.innerHTML="";return}
  const st=TL()[tour.i], txt=typeof st.say==="function"?st.say():st.say; tour.text=txt;
  const ss=sentences(txt);
  r.innerHTML=`<section class="tour dock" role="region" aria-label="${tourName()}" aria-live="polite">
   <div class="tour-head"><span class="chip">${tourName()} · ${tour.i+1} of ${TL().length}</span><h3>${esc(st.title)}</h3></div>
   <p class="cap">${ss.map((x,k)=>`<span class="${k<tour.sent?"done":k===tour.sent&&tour.playing?"now":""}">${esc(x)}</span>`).join("")}</p>
   <div class="tour-prog"><i style="width:${((tour.i+1)/TL().length*100).toFixed(1)}%"></i></div>
   <div class="tour-ctl"><button data-tour="back" ${tour.i===0?"disabled":""}>Back</button><button class="primary" data-tour="play">${tour.playing?"Pause":"Play"}</button><button data-tour="next">${tour.i===TL().length-1?"Finish":"Next"}</button>
   <label for="tourVoice"><input type="checkbox" id="tourVoice" ${tour.voice&&hasVoice?"checked":""} ${hasVoice?"":"disabled"}> Voice</label>
   ${hasVoice&&voiceList().length?`<select id="tourVoiceSel" aria-label="Narrator voice">${voiceOptions()}</select>`:""}
   <button class="ghost" data-tour="exit">Exit</button></div>
   ${hasVoice?"":`<div class="tour-note">This browser has no speech voice, so the demo plays with captions only.</div>`}
  </section>`;
}
function markSentence(k){tour.sent=k;const sp=document.querySelectorAll("#tourRoot .cap span");const cap=document.querySelector("#tourRoot .cap");if(cap&&sp[Math.min(k,sp.length-1)])cap.scrollTop=sp[Math.min(k,sp.length-1)].offsetTop-cap.offsetTop;sp.forEach((e,j)=>{e.className=j<k?"done":j===k&&tour.playing?"now":""});}
function narrate(){
  stopVoice(); const gen=tour.gen; const ss=sentences(tour.text); tour.sent=0;
  const done=()=>{if(gen!==tour.gen)return;markSentence(ss.length);tour.timers.push(setTimeout(()=>{if(gen===tour.gen&&tour.playing)step(1)},1100))};
  const say=k=>{
    if(gen!==tour.gen||!tour.playing) return;
    if(k>=ss.length){done();return}
    markSentence(k);
    const words=ss[k].split(/\s+/).length, est=words*390+700;
    if(tour.voice&&hasVoice){
      let fired=false; const next=()=>{if(fired)return;fired=true;say(k+1)};
      const u=new SpeechSynthesisUtterance(ss[k].trim()); const v=pickVoice(); if(v)u.voice=v; u.lang=v?v.lang:"en-GB"; u.rate=/^ar/i.test(u.lang)?.92:.97;
      u.onend=next; u.onerror=next;
      tour.timers.push(setTimeout(next,est*2+3000));
      try{speechSynthesis.speak(u)}catch(e){next()}
    } else tour.timers.push(setTimeout(()=>say(k+1),est));
  };
  say(0);
}
function runStep(){
  const st=TL()[tour.i]; tour.sel=st.run()||null; tour.sent=0;
  renderTour(); setTimeout(()=>applyHL(true),120);
  if(tour.playing) narrate();
}
function step(d){
  stopVoice();
  const n=tour.i+d;
  if(n>=TL().length){endTour(true);return}
  if(n<0) return;
  tour.i=n; runStep();
}
function startTour(list){
  tourList=list||null; stopVoice(); S=seed(); save(); closeDrawer(); WNSTwin.reset(); filters={venue:"all",family:"all",state:"all",q:""}; decoOut=null;
  tour.active=true; tour.i=0; tour.playing=true;
  if(hasVoice) try{speechSynthesis.getVoices()}catch(e){}
  runStep();
}
function endTour(finished){stopVoice();WNSTwin.stop();tour.active=false;tour.playing=false;tour.sel=null;applyHL(false);renderTour();if(finished)toast("Demo finished. The app stays in the state the demo left it; use Reset demo to start fresh.");}
if(hasVoice&&speechSynthesis.addEventListener) speechSynthesis.addEventListener("voiceschanged",()=>{if(tour.active){const sel=document.getElementById("tourVoiceSel");if(sel)sel.innerHTML=voiceOptions();else renderTour();}});

// ---------- render & events ----------
function render(){
  FC=null;
  $("#today").textContent=fmtD(S.today);
  const r=route(); renderTabs(r);
  if(r==="twin"){const v=$("#view");v.innerHTML=`<h2>Design intake · King Salman International Stadium</h2><p class="lead">Before anything is built, the design team's model goes in and compliance checks come out. This is the Riyadh venue for the 2034 opening match and final, beside King Abdulaziz Park in north Riyadh. The 3D massing follows Populous's published concept: a circular, segmented form like a seed cracking the earth, green walls and roof, and a ring of hospitality boxes between two tiers. Proportions are approximate. The submissions and findings are simulated, and thresholds are illustrative.</p>`;WNSTwin.mount(v);applyHL(false);return;}
  const fn={readiness:viewReadiness,decisions:viewDecisions,tower:viewTower,register:viewRegister,gates:viewGates,issues:viewIssues,change:viewChange,dossier:viewDossier,decompose:viewDecompose}[r];
  $("#view").innerHTML=fn();
  applyHL(false);
}
document.addEventListener("click",ev=>{
  const t=ev.target.closest("button,[data-obl],[data-close]"); if(!t) return;
  if(t.dataset.tour){const a=t.dataset.tour;
    if(a==="exit"){endTour(false);return}
    if(a==="next"){step(1);return}
    if(a==="back"){step(-1);return}
    if(a==="play"){if(tour.playing){tour.playing=false;stopVoice();renderTour()}else{tour.playing=true;renderTour();narrate()}return}
    return}
  if(t.id==="tourStart"){startTour();return}
  if(t.id==="execStart"){startTour(EXEC);return}
  if(t.hasAttribute("data-close")){closeDrawer();return}
  const o=drawerId&&S.obligations.find(x=>x.id===drawerId);
  if(t.hasAttribute("data-validate")&&o){const ok=validate(o);const e=o.evidence[o.evidence.length-1];lastResult={ok,msg:ok?`Pass: ${showVal(o,e.value)} meets the criterion.`:`Fail: ${showVal(o,e.value)} does not meet ${critText(o)}. The owner's "complete" is overturned, status set to Rejected, corrective action opened with a ${SLA[o.crit]}-day SLA.`};save();render();renderDrawer();return}
  if(t.hasAttribute("data-verify")&&o){verify(o);lastResult={ok:true,msg:"Verified by the compliance office. This obligation now counts fully toward assured readiness."};save();render();renderDrawer();return}
  if(t.dataset.obl){openDrawer(t.dataset.obl);return}
  if(t.dataset.goto){filters.venue=t.dataset.venue||"all";filters.family="all";filters.state="all";filters.q="";location.hash=t.dataset.goto;if(t.dataset.goto==="gates")setTimeout(()=>{const el=document.getElementById("gate-"+t.dataset.venue);if(el)el.scrollIntoView({block:"start"})},30);return}
  if(t.dataset.gate){const id=t.dataset.gate,e=gateEval(id),v=venueState(id);
    if(e.pass){v.passed.push({gate:e.gate.id,t:S.today});v.gateIdx++;if(v.gateIdx<GATES.length)v.gateDate=addDays(v.gateDate,240);log("Compliance office",`Gate ${e.gate.id} ${e.gate.name} passed`,null);toast(`${venueMeta(id).name} passed ${e.gate.id} ${e.gate.name}.`);}
    else{const n=e.rules.filter(r=>!r.ok).length;log("Rule engine",`Gate ${e.gate.id} request refused for ${venueMeta(id).name}: ${n} rule${n>1?"s":""} failing`,null);toast(`Gate refused: ${n} rule${n>1?"s":""} failing. Escalate the blockers or fix the evidence.`);}
    save();render();return}
  if(t.dataset.escalateGate){const e=gateEval(t.dataset.escalateGate);const seen=new Set();let n=0;
    e.rules.forEach(r=>r.blockers.forEach(o=>{if(seen.has(o.id)||o.crit==="Medium")return;seen.add(o.id);openIssue(o,`Gate ${e.gate.id} blocker: ${o.text}`,2);n++;}));
    save();render();toast(`${n} blockers escalated to ${LEVELS[2]}.`);return}
  if(t.dataset.esc){const i=S.issues.find(x=>x.id===t.dataset.esc);i.level++;i.due=addDays(S.today,Math.ceil(SLA[i.crit]/2));i.history.push({t:S.today,a:`Escalated manually to ${LEVELS[i.level]}`});log("Compliance office",`${i.id} escalated to ${LEVELS[i.level]}`,i.obl);save();render();return}
  if(t.dataset.decide){decide(t.dataset.decide,Number(t.dataset.opt));return}
  if(t.dataset.unrecover){S.scn.recovery=S.scn.recovery.filter(x=>x!==t.dataset.unrecover);save();render();return}
  if(t.id==="scReset"){S.scn={prod:1,fifa:false,recovery:[]};save();render();return}
  if(t.dataset.dossier){dossierVenue=t.dataset.dossier;location.hash="dossier";return}
  if(t.dataset.demo){const d=t.dataset.demo;
    if(d==="green"){openDrawer("JED-LGT-01")}
    if(d==="gate"){location.hash="gates";setTimeout(()=>{const el=document.getElementById("gate-JED");if(el)el.scrollIntoView({block:"start"})},30)}
    if(d==="camp"){openDrawer("TBC-R3-TBC-03")}
    if(d==="change"){selChange="lux";location.hash="change"}
    if(d==="dossier"){dossierVenue="KHO";location.hash="dossier"}
    return}
  if(t.id==="advance"){advance();return}
  if(t.id==="reset"){if(t.dataset.confirm){S=seed();save();closeDrawer();WNSTwin.reset();filters={venue:"all",family:"all",state:"all",q:""};render();toast("Sample data restored.");}else{t.dataset.confirm="1";t.textContent="Click again to reset";t.classList.add("danger");setTimeout(()=>{delete t.dataset.confirm;t.textContent="Reset demo";t.classList.remove("danger")},3000)}return}
  if(t.id==="applyChange"){applyChange();return}
  if(t.id==="copyDossier"){const txt=dossierText();(navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>toast("Dossier copied.")).catch(()=>{const r=document.createRange();r.selectNodeContents($("#dossierDoc"));const s=getSelection();s.removeAllRanges();s.addRange(r);toast("Dossier selected. Copy it with your keyboard.")});return}
  if(t.id==="decoRun"){decoInput=$("#decoIn").value;decoOut=decompose(decoInput);render();return}
  if(t.id==="decoSample"){decoInput=SAMPLE_CLAUSE;decoOut=null;render();return}
  if(t.id==="decoAdd"){decoAdd();return}
});
document.addEventListener("mousemove",ev=>{
  const tip=document.querySelector(".fc-tip"); if(!tip) return;
  const h=ev.target.closest&&ev.target.closest(".fc-chart [data-tip]");
  if(!h){tip.hidden=true;return}
  const w=tip.parentElement.getBoundingClientRect();
  tip.innerHTML=h.dataset.tip; tip.hidden=false;
  const x=Math.min(ev.clientX-w.left+14,w.width-290), y=ev.clientY-w.top+14;
  tip.style.left=Math.max(0,x)+"px"; tip.style.top=y+"px";
});
document.addEventListener("keydown",ev=>{
  if(ev.key==="Escape"&&drawerId) closeDrawer();
  if(ev.key==="Enter"&&ev.target.matches("tr[data-obl]")) openDrawer(ev.target.dataset.obl);
});
document.addEventListener("change",ev=>{
  const t=ev.target;
  if(t.id==="fVenue"){filters.venue=t.value;render()}
  if(t.id==="fFamily"){filters.family=t.value;render()}
  if(t.id==="fState"){filters.state=t.value;render()}
  if(t.id==="chSel"){selChange=t.value;render()}
  if(t.id==="scProd"){S.scn.prod=Number(t.value);save();render()}
  if(t.id==="scFifa"){S.scn.fifa=t.checked;save();render()}
  if(t.id==="dvSel"){dossierVenue=t.value;render()}
  if(t.id==="decoV"){decoVenue=t.value}
  if(t.id==="tourVoice"){tour.voice=t.checked;if(tour.playing)narrate();return}
  if(t.id==="tourVoiceSel"){tour.voiceName=t.value;if(tour.playing)narrate();return}
  if(t.dataset.keep!==undefined&&decoOut){decoOut[Number(t.dataset.keep)].keep=t.checked}
});
document.addEventListener("input",ev=>{
  if(ev.target.id==="fQ"){filters.q=ev.target.value;const pos=ev.target.selectionStart;render();const el=$("#fQ");el.focus();el.setSelectionRange(pos,pos)}
  if(ev.target.id==="decoIn"){decoInput=ev.target.value}
});
window.addEventListener("hashchange",()=>{if(tour.nav){tour.nav=false;render();applyHL(false);return}window.scrollTo(0,0);render()});
load();
WNSTwin.hooks({onEvent:txt=>{log("Rule engine",txt,null);save();},onChange:()=>{const el=document.getElementById("intakeCard");if(el)el.outerHTML=intakeCard();}});
render();
})();
