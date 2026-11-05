import test from 'node:test';
import assert from 'node:assert/strict';
import {validateHeaderValue} from 'node:http';
import {publicAssetUrl} from '../lib/assets.mjs';
import {normalizeDecisionRecords,decisionOptionLabel,hasDecisionForecast} from '../lib/decision-records.mjs';
import {DECISIONS} from '../lib/data.js';
import {load,S,seed} from '../lib/state.js';
import {viewActions} from '../components/views/actionsView.js';
import {invalidateForecasts} from '../lib/forecast.js';
import {decide} from '../lib/actions.js';

function loadSnapshot(snapshot){
 const serialized=JSON.stringify(snapshot);
 globalThis.localStorage={getItem:()=>serialized,setItem:()=>{}};
 load();invalidateForecasts();
}
test('public image URLs are safe for HTTP preload headers, including a Pages base path',()=>{
 const raw='/Assets/شعار_الهيئة.png';
 assert.throws(()=>validateHeaderValue('Link',`<${raw}>; rel=preload`));
 for(const base of ['', '/WCA-Assurance-Website']){
  const url=publicAssetUrl(raw,base);
  assert.doesNotThrow(()=>validateHeaderValue('Link',`<${url}>; rel=preload`));
  assert.equal(decodeURI(url),base+raw);
 }
});
test('older decisions retain their recorded option without reapplying recovery effects',()=>{
 const snapshot=seed();snapshot.decisions[0]={id:'DEC-01',status:'Decided',option:DECISIONS[0].options[0].t};
 snapshot.scn.recovery=['JED'];loadSnapshot(snapshot);
 assert.equal(S.decisions[0].status,'Taken');assert.equal(S.decisions[0].choice,0);
 assert.deepEqual(S.scn.recovery,['JED']);
 const html=viewActions();assert.ok(html.includes(DECISIONS[0].options[0].t));
 assert.ok(html.includes('Historical forecast comparison was not stored'));
 assert.ok(!html.includes('NaN'));assert.ok(!html.includes('undefined'));
});
test('unknown or missing historical options do not crash the Actions page',()=>{
 for(const record of [{status:'Taken'},{status:'Taken',choice:99},{status:'Decided',option:'An earlier option <archived>'}]){
  const snapshot=seed();snapshot.decisions[0]={id:'DEC-01',...record};loadSnapshot(snapshot);
  const html=viewActions();assert.ok(!html.includes('NaN'));
  if(record.option)assert.ok(html.includes('&lt;archived&gt;'));
  else assert.ok(html.includes('Recorded option unavailable'));
 }
});
test('current decision records retain their option and stored forecast',()=>{
 const record={id:'DEC-01',status:'Taken',choice:1,t:'2026-10-30',before:'2027-05-06',after:'2027-06-29',beforeProb:0.31,afterProb:0.8,beforeLate:36,afterLate:0};
 const result=normalizeDecisionRecords([record],DECISIONS);
 assert.deepEqual(result[0],record);assert.equal(result.length,DECISIONS.length);
 assert.equal(decisionOptionLabel(DECISIONS[0],result[0]),DECISIONS[0].options[1].t);
 assert.equal(hasDecisionForecast(result[0]),true);
 const snapshot=seed();snapshot.decisions=result;loadSnapshot(snapshot);assert.ok(!viewActions().includes('NaN'));
});
test('invalid decision indices are ignored without changing demo state',()=>{
 loadSnapshot(seed());const before=JSON.stringify(S);decide('DEC-01',99);assert.equal(JSON.stringify(S),before);
});
