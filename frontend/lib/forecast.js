// ---------- forecast: Monte Carlo on evidence, not on reported progress ----------
// Each run samples how long every obligation in the gate scope needs to reach the state and evidence
// maturity the gate requires. The gate is ready when every Critical item is verified and 90% of the
// weighted scope is assured. Durations are illustrative and will be calibrated on the PMC's real data.
import {GATES,VENUES,WEIGHT,REQMAT,venueMeta,addDays,daysBetween} from "./data";
import {S} from "./state";
import {venueState,gateScope,matOf,issueFor} from "./scoring";

export function rng(seed){let a=seed>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
export function tri(r,a,m,b){if(b<=a)return a;const u=r(),f=(m-a)/(b-a);return u<f?a+Math.sqrt(u*(b-a)*(m-a)):b-Math.sqrt((1-u)*(b-a)*(b-m))}
const DUR={Assigned:[40,80,180],Submitted:[5,20,60],Rejected:[25,55,130],Validated:[4,10,25]};
export function forecast(id,scn,runs){
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
export function invalidateForecasts(){FC=null;}
export function forecasts(){if(!FC)FC=VENUES.map(m=>forecast(m.id)).filter(Boolean);return FC;}
export function projection(id){const f=forecasts().find(x=>x.id===id);return f?{status:f.status,cls:f.cls,f}:{status:"All gates passed",cls:"p-good"};}
