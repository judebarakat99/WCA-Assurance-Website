import {VENUES,DECISIONS} from './data';
import {S} from './state';
import {scores,oblsOf,gateEval} from './scoring';
import {forecasts} from './forecast';

// Send a bounded snapshot of the currently displayed demo, never credentials or DOM HTML.
export function buildAssistantContext(){
 const score=scores(S.obligations);
 return {
  source:'browser-demo',as_of:S.today,
  summary:{assured:score.assured,declared:score.declared,scenario:S.scn},
  venues:VENUES.map(v=>({id:v.id,name:v.name,city:v.city,type:v.type,readiness:scores(oblsOf(v.id)),gate:gateSummary(v.id)})),
  obligations:S.obligations.map(o=>({id:o.id,venue:o.venue,text:o.text,owner:o.owner,criticality:o.crit,state:o.state,declared_complete:o.claim,gate:o.gate,criterion:{operator:o.op,value:o.value,unit:o.unit,clause:o.clause},depends_on:o.dependsOn||null,evidence:o.evidence.slice(-1)})),
  issues:S.issues.map(i=>({id:i.id,obligation:i.obl,title:i.title,status:i.status,criticality:i.crit,level:i.level,due:i.due})),
  decisions:S.decisions.map(record=>({...DECISIONS.find(d=>d.id===record.id),...record})),
  forecasts:forecasts().map(({id,gate,gateDate,d50,d80,prob,late80,pmc})=>({id,gate,gateDate,p50:d50,p80:d80,on_time_probability:prob,days_beyond_milestone:late80,pmc})),
 };
}

function gateSummary(id){const gate=gateEval(id);return gate?{id:gate.gate.id,name:gate.gate.name,pass:gate.pass,assured_readiness:gate.sc.assured,required_assured_readiness:0.9,scope_size:gate.scope.length,rules:gate.rules.map(rule=>({met:rule.ok,text:rule.text,blockers:rule.blockers.map(o=>o.id)}))}:null;}
