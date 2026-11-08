import {normalizeDecisionRecords} from "./decision-records.mjs";
// ---------- client-side state & store (localStorage persistence) ----------
import {VENUES,TEMPLATES,CAMP_TEMPLATES,DECISIONS,ISSUERS,SAMPLE_CLAUSE,goodValue,addDays,gateNum} from "./data";

export let S;
const KEY="cae-poc-v2";
export function seed(){
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
export function load(){try{const r=localStorage.getItem(KEY);if(r){S=JSON.parse(r);S.decisions=normalizeDecisionRecords(S.decisions,DECISIONS);return}}catch(e){} S=seed();}
export function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
export function resetS(){S=seed();save();}
export function log(actor,action,obl){S.audit.push({t:S.today,actor,action,obl});}

// ---------- ephemeral UI state shared across pages ----------
export const ui={
  filters:{venue:"all",family:"all",state:"all",q:""},
  selChange:"lux",
  dossierVenue:"KHO",
  compliance:{
    authority:"all",
    family:null,
    venue:null
  },
  decoInput:SAMPLE_CLAUSE,
  decoOut:null,
  decoVenue:"RUH",
  intake:{venue:"JED",target:"",etype:0,fileName:"",step:-1,running:false,result:null,added:false},
  drawerId:null,
  lastResult:null,
};
export function resetFilters(){ui.filters={venue:"all",family:"all",state:"all",q:""};}

// Guided demo runtime state (logic lives in components/views/tour.js).
export const tour={active:false,i:0,playing:false,voice:true,voiceName:"",sel:null,timers:[],sent:0,gen:0,nav:false,text:""};
// AI assistant runtime state (logic lives in components/views/ai.js).
export const ai={open:false,msgs:[]};

// ---------- render & navigation bridge (set by lib/engine.js) ----------
// Views and actions call rerender()/goView() instead of touching the router
// directly, which keeps these modules free of framework dependencies.
export const bridge={render:null,navigate:null};
export function rerender(){if(bridge.render)bridge.render();}
// goView accepts the legacy hash keys ("tower", "register", "venue-RUH", ...)
export function goView(h){if(bridge.navigate)bridge.navigate(h);}
