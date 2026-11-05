// ---------- reference data & pure helpers (shared by every page) ----------
export const GATES=[
  {id:"G1",name:"Design freeze"},{id:"G2",name:"Structure complete"},{id:"G3",name:"Construction complete"},
  {id:"G4",name:"Test event ready"},{id:"G5",name:"FIFA handover"}];
export const LEVELS=["Delivery owner","Workstream lead","Authority executive","Ministerial steering"];
export const SLA={Critical:7,High:14,Medium:21};
export const WEIGHT={Critical:3,High:2,Medium:1};
export const STATES=["Assigned","Submitted","Validated","Verified"];

// Illustrative thresholds modelled on FIFA stadium requirement families. Verify against the authority's FIFA documents.
export const TEMPLATES=[
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
export const CAMP_TEMPLATES=[
 {code:"TBC-01",family:"Team base camp",clause:"Base Camp Req. §1.2",text:"Training site travel time from team hotel",op:"max",value:20,unit:"min",crit:"High",gate:"G3",owner:"Host city"},
 {code:"TBC-02",family:"Team base camp",clause:"Base Camp Req. §1.4",text:"Team hotel contracted with dedicated rooms",op:"min",value:50,unit:"rooms",crit:"Critical",gate:"G3",owner:"Hospitality operator"},
 {code:"TBC-03",family:"Team base camp",clause:"Base Camp Req. §1.6",text:"Private, screened training sessions possible",op:"bool",crit:"High",gate:"G4",owner:"Host city",dependsOn:"TBC-02"}
];
// Venue names from the public Saudi 2034 bid; capacities are approximate and for demonstration.
export const VENUES=[
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
export const MAT=["Design","Installed","Commissioned","Proven in operation"];
export const REQMAT=[0,1,1,2,3];
// Owners outside the programme's direct control.
export const EXTERNAL=["Telecom operator","Civil Defense liaison","Host city","Hospitality operator","Health cluster"];
export const DECISIONS=[
 {id:"DEC-01",venue:"JED",title:"Recover Jeddah's Construction complete gate",q:"Evidence-based P80 for G3 is later than FIFA's milestone while the PMC schedule shows 11 days float.",owner:"Authority executive",lrm:"2026-11-20",
  options:[{t:"Deploy a recovery team",fx:"recover"},{t:"Re-baseline G3 with FIFA",fx:"rebase"},{t:"Hold and monitor",fx:null}]},
 {id:"DEC-02",venue:"RUH",title:"Protect King Salman's Structure complete gate",q:"P50 meets the 30 Jun 2028 milestone, P80 does not. Roof steel procurement is the driver.",owner:"Ministerial steering",lrm:"2027-02-15",
  options:[{t:"Accelerate roof steel package",fx:"recover"},{t:"Accept P50 risk and review quarterly",fx:null}]},
 {id:"DEC-03",venue:"AHB",title:"Recover Abha's Structure complete gate",q:"Redevelopment is in early works. P80 for G2 falls after the milestone because bowl structure progress is the only driver.",owner:"Authority executive",lrm:"2027-04-30",
  options:[{t:"Add a second shift on the bowl structure",fx:"recover"},{t:"Re-sequence the roof works",fx:null}]},
 {id:"DEC-04",venue:"NEO",title:"Freeze NEOM Stadium design scope",q:"Late design changes keep critical obligations unverified ahead of Design freeze.",owner:"Authority executive",lrm:"2027-01-31",
  options:[{t:"Freeze scope now",fx:"recover"},{t:"Allow one more change window",fx:null}]}
];
export const ISSUERS=["Third-party test lab","Design consultant","Site engineer","Independent certifier","Contractor QA"];

// ---------- helpers ----------
export const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export const fmtN=n=>typeof n==="number"?n.toLocaleString("en-US",{maximumFractionDigits:2}):n;
export const addDays=(iso,d)=>{const t=new Date(iso+"T00:00:00Z");t.setUTCDate(t.getUTCDate()+d);return t.toISOString().slice(0,10)};
export const daysBetween=(a,b)=>Math.round((Date.parse(b)-Date.parse(a))/864e5);
export const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export const fmtD=iso=>iso?`${Number(iso.slice(8,10))} ${MONTHS[Number(iso.slice(5,7))-1]} ${iso.slice(0,4)}`:"";
export const pct=x=>Math.round(x*100);
export function critText(o){
  if(o.op==="bool") return "Required: yes (confirmed by evidence)";
  const sym={min:"≥",max:"≤",eq:"="}[o.op];
  return `${o.code}: measured ${sym} ${fmtN(o.value)} ${o.unit}`;
}
export function passes(o,v){
  if(o.op==="bool") return v===true||v==="yes";
  const n=Number(v); if(!isFinite(n)) return false;
  if(o.op==="min") return n>=o.value;
  if(o.op==="max") return n<=o.value;
  return Math.abs(n-o.value)<1e-9;
}
export function goodValue(o){
  if(o.op==="bool") return true;
  if(o.op==="eq") return o.value;
  if(o.op==="min") return o.unit==="ratio"?Math.round(o.value*1.1*100)/100:Math.ceil(o.value*1.06);
  return Math.round(o.value*0.85*10)/10;
}
export function badValue(o){
  if(o.op==="bool") return false;
  if(o.op==="min") return o.unit==="ratio"?Math.round(o.value*0.9*100)/100:Math.floor(o.value*0.92);
  if(o.op==="max") return Math.round(o.value*1.18*10)/10;
  return Math.round(o.value*0.95*10)/10;
}
export function showVal(o,v){ if(o.op==="bool") return v===true||v==="yes"?"Yes":"No"; return `${fmtN(Number(v))} ${o.unit}`; }
export const venueMeta=id=>VENUES.find(v=>v.id===id);
export const gateNum=g=>Number(g.slice(1));
export const SHORT={RUH:"King Salman, Riyadh",JED:"King Abdullah SC, Jeddah",KHO:"Aramco, Al Khobar",AHB:"King Khalid Univ., Abha",NEO:"NEOM Stadium","TBC-R3":"Base camp R-03, Riyadh","TBC-J1":"Base camp J-01, Jeddah"};
export const sn=id=>SHORT[id]||venueMeta(id).name;
export const dd=n=>`${Math.abs(n)} day${Math.abs(n)===1?"":"s"}`;
export const decMeta=id=>DECISIONS.find(d=>d.id===id);
export const stateCls=s=>({Verified:"p-good",Validated:"p-info",Submitted:"p-warn",Assigned:"p-mute",Rejected:"p-bad"}[s]);

// Guideline updates used by the Change Impact simulation.
export const CHANGES=[
  {id:"lux",title:"Floodlighting: vertical illuminance minimum raised from 2,500 to 3,000 lux",code:"LGT-01",value:3000},
  {id:"media",title:"Media: tribune seat minimum for group-stage venues raised from 1,600 to 1,800",code:"MED-01",value:1800,skip:["RUH"]},
  {id:"heat",title:"Climate: bowl temperature maximum lowered from 26 to 24 °C",code:"CLM-01",value:24}
];

export const SAMPLE_CLAUSE=`4.1 Floodlighting. The stadium shall provide vertical illuminance of not less than 2,500 lux towards fixed cameras across the field of play. Uniformity (U2) of vertical illuminance shall be at least 0.7.
4.2 Power. Floodlighting shall be supported by an uninterruptible power supply with automatic changeover.
4.3 The emergency lighting system must restore at least 800 lux within 5 seconds of a mains failure.
4.4 Glare to players and spectators should be minimised in line with good practice.`;

// Evidence intake (frontend-only simulation)
export const EV_TYPES=[["Test report",1],["Certificate",1],["Commissioning record",2],["Drawing / design calculation",0],["Inspection photo set",1]];
export const EV_STEPS=["Document received","Reading document","Extracting metadata","Matching to selected requirement","Extracting evidence value","Checking acceptance criterion"];
