// ---------- scoring: readiness, gate evaluation ----------
import {GATES,WEIGHT,MAT,REQMAT,gateNum,pct} from "./data";
import {S} from "./state";

export const venueState=id=>S.venues.find(v=>v.id===id);
export const oblsOf=id=>S.obligations.filter(o=>o.venue===id);
export function assuredScore(o){return o.state==="Verified"?1:o.state==="Validated"?0.8:0}
export function declaredScore(o){return (o.state==="Assigned")?0:1}
export function scores(list){
  let w=0,a=0,d=0; list.forEach(o=>{const k=WEIGHT[o.crit];w+=k;a+=k*assuredScore(o);d+=k*declaredScore(o)});
  return {assured:w?a/w:0,declared:w?d/w:0};
}
export function depBlocked(o){ if(!o.dependsOn) return null; const d=S.obligations.find(x=>x.id===o.dependsOn); return d&&!(d.state==="Validated"||d.state==="Verified")?d:null; }
export function gateEval(id){
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
export function gateScope(id,gn){const all=oblsOf(id);return gn===1?all.filter(o=>o.crit!=="Medium"):all.filter(o=>gateNum(o.gate)<=gn);}
export function matOf(o){const e=o.evidence.filter(x=>x.result==="pass").pop();return e&&e.maturity!=null?e.maturity:(e?1:-1);}
export const isProven=o=>o.state==="Verified"||o.state==="Validated";
export function issueFor(o){return S.issues.find(i=>i.obl===o.id&&i.status==="Open")}
