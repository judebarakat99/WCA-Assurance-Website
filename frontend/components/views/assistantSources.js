import {esc} from '../../lib/data';
const labels={forecasts:'Milestone forecast',venues:'Venue & gate assessment',obligations:'Obligation',issues:'Corrective action',decisions:'Executive decision',summary:'Programme snapshot'};
function displayDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return '';return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T00:00:00Z'));}
export function sourceHtml(source){
 const document=source.kind==='document';const category=document?'Document passage':labels[source.category]||'Programme record';
 const page=document&&source.page?` · page ${source.page}`:'';
 const facts=(source.facts||[]).filter(f=>f.value&&f.value!=='Not supplied');
 return `<details class="ai-source-card"><summary><span class="ai-source-type">${esc(category)}</span><strong>${esc(source.title)}${esc(page)}</strong><span class="ai-source-expand" aria-hidden="true">＋</span></summary><div class="ai-source-body">${source.as_of?`<p class="ai-source-date">Demo snapshot · ${esc(displayDate(source.as_of))}</p>`:''}${facts.length?`<dl class="ai-source-facts">${facts.map(f=>`<div><dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd></div>`).join('')}</dl>`:''}${(source.checks||[]).map(check=>`<div class="ai-source-check"><span class="pill ${check.met?'p-good':'p-bad'}">${check.met?'Met':'Unmet'}</span><div><p>${esc(check.label)}</p>${check.blockers?.length?`<small>Blocking obligations: ${check.blockers.map(esc).join(', ')}</small>`:''}</div></div>`).join('')}${document&&source.excerpt?`<blockquote>${esc(source.excerpt)}</blockquote>`:''}${!document&&!facts.length&&!source.checks?.length?'<p>Supporting programme record. Refresh the page to load its readable details.</p>':''}</div></details>`;
}
