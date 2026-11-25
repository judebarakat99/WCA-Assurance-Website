/* ---------- FIFA-critical areas, chapter layers and site conditions (Venue Compliance Hub) ---------- */
// The model's critical areas (design.zones) are drawn as heat: each is coloured by the worst mitigation exposure among
// the register requirements that belong to it, so the colours match the stadium page, the Overview and the reports.
// Its outline is the colour of its FIFA chapter; the chapter buttons show or hide every area and check of a chapter.
// The Critical areas tab lists them, shows the requirements behind one, and lets a person log a site condition,
// which raises the exposure of the requirements it touches everywhere on the site.
const ZD=(design&&design.zones)||[],CHAPS=(design&&design.chapters)||[];
const LVL={critical:{l:'Critical',c:0xf05d4e,o:.5},material:{l:'Material',c:0xf2a73b,o:.42},manageable:{l:'Manageable',c:0x8f9bff,o:.34},controlled:{l:'Controlled',c:0x46c389,o:.24}};
const LVL_ORDER=['critical','material','manageable','controlled'];
const chOf=id=>CHAPS.find(c=>c.id===id)||null;
const chColor=id=>{const c=chOf(id);return c?c.color:'#c7c7d9';};
const hx=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
S.mode='review';S.zone=null;S.chapters=new Set(CHAPS.map(c=>c.id));S.layers.areas=false;
let zstat={},zobj={},roofWas=true;
const zel={};
function chapterOn(c){return !c.chapter||S.chapters.has(c.chapter);}
function escBadge(c){const e=design&&design.escalation&&design.escalation(c.id);return e?`<span class="tw-esc" title="${hx(e.reasons.map(r=>r.because).join('; '))}">Raised from ${e.from}</span>`:'';}
function critWhy(c){const e=design&&design.escalation&&design.escalation(c.id);return e?` <span class="tw-esc">raised from ${e.from}</span><small class="tw-escwhy">Because ${hx(e.reasons.map(r=>r.because).join('; '))}. Source: ${hx(e.reasons.map(r=>r.source).join(', '))}.</small>`:'';}
(function setupAreasUi(){
  const modes=q('.tw-modes');if(modes&&!ZD.length)modes.hidden=true;
  const btn=q('[data-l="areas"]');if(btn)btn.setAttribute('aria-pressed','false');
  ZD.forEach(z=>{const b=document.createElement('button');b.type='button';b.className='tw-zone hide lvl-controlled';b.dataset.twzone=z.id;b.setAttribute('aria-label',z.name);b.style.setProperty('--zc',chColor(z.chapter));
    b.innerHTML=`<span class="tag"><i></i>${hx(z.tag)}</span><span class="stem"></span><span class="dot"></span>`;pinLayer.appendChild(b);zel[z.id]=b;});
  const box=q('.tw-chapters');
  if(box)box.innerHTML=`<button type="button" class="tw-chh" data-twch="toggle" aria-label="Show or hide the chapter buttons">FIFA chapters</button><div class="tw-chl">${CHAPS.map(c=>`<button type="button" class="tw-ch" data-twch="${c.id}" aria-pressed="true" title="${hx(c.id+' '+c.name)}" style="--cc:${c.color}"><i></i><b>${c.id}</b><span>${hx(c.short)}</span></button>`).join('')}<span class="tw-cha"><button type="button" class="tw-ch tw-ch-act" data-twch="all">All</button><button type="button" class="tw-ch tw-ch-act" data-twch="none">None</button></span></div>`;
  if(!CHAPS.length&&box)box.hidden=true;
})();
function refreshZones(){if(!design||!design.zoneStatus)return;zstat=Object.fromEntries(design.zoneStatus().map(z=>[z.id,z]));}
function syncChapters(){root.querySelectorAll('[data-twch]').forEach(b=>{const k=b.dataset.twch;if(k==='all'||k==='none'||k==='toggle')return;b.setAttribute('aria-pressed',S.chapters.has(k));});}
function zoneBase(id){const st=zstat[id];const lv=LVL[st?st.level:'controlled'];return lv;}
function buildZones(){
  const grp=new THREE.Group();scene.add(grp);
  const mat=(color,op)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity:op,depthWrite:false,side:THREE.DoubleSide});
  const strip=(A,B)=>{const pos=[];for(let i=0;i<A.length-1;i++)pos.push(...A[i],...B[i],...B[i+1],...A[i],...B[i+1],...A[i+1]);const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));return g;};
  const along=(d0,y0,d1,y1)=>{const A=[],B=[];PIECES.forEach(p=>{const n=p.s?Math.max(2,Math.ceil(plen(p)/3)):10;for(let i=0;i<=n;i++){const f=i/n,a=pt(p,f,d0),b=pt(p,f,d1);A.push([a[0],y0,a[1]]);B.push([b[0],y1,b[1]]);}});return[A,B];};
  const flat=(geo,x,y,zz)=>{const m=new THREE.Mesh(geo);m.rotation.x=-Math.PI/2;m.position.set(x,y,zz);return m;};
  ZD.forEach(z=>{
    const g=new THREE.Group(),fills=[],edges=[];const sh=z.shape;
    const fm=(k)=>{const m=mat(0x46c389,.3);fills.push({m,k:k||1});return m;};
    const em=()=>{const m=mat(new THREE.Color(chColor(z.chapter)),.85);edges.push(m);return m;};
    const add=(mesh,m)=>{mesh.material=m;g.add(mesh);return mesh;};
    if(sh.kind==='spot'){
      const[x,y,zz]=sh.p;
      add(flat(new THREE.CircleGeometry(sh.r,40),x,y,zz),fm(1));
      add(flat(new THREE.RingGeometry(sh.r-.8,sh.r,40),x,y+.03,zz),em());
      const beam=new THREE.Mesh(new THREE.CylinderGeometry(.45,.45,11,8,1,true));beam.position.set(x,y+5.5,zz);add(beam,fm(1.6));
    }else if(sh.kind==='arcs'){
      const mid=(sh.r0+sh.r1)/2;
      sh.arcs.forEach(arc=>{
        const len=2*arc.span*Math.PI/180,start=-((arc.a+arc.span)*Math.PI/180);
        add(flat(new THREE.RingGeometry(sh.r0,sh.r1,36,1,start,len),0,.45,0),fm(1));
        add(flat(new THREE.RingGeometry(sh.r1-.8,sh.r1,36,1,start,len),0,.5,0),em());
        add(flat(new THREE.RingGeometry(sh.r0,sh.r0+.8,36,1,start,len),0,.5,0),em());
        const n=sh.doors||0;
        for(let i=0;i<n;i++){const phi=(arc.a+(n===1?0:(-arc.span*.7+i*(1.4*arc.span)/(n-1))))*Math.PI/180;
          const door=new THREE.Mesh(new THREE.BoxGeometry(1.2,3.6,2.6));door.position.set(mid*Math.cos(phi),1.8,mid*Math.sin(phi));door.rotation.y=-phi;add(door,em());}
      });
    }else if(sh.kind==='frame'){
      const t=1.3,hw=sh.w/2+t/2,hh=sh.h/2+t/2;
      add(flat(new THREE.PlaneGeometry(sh.w,sh.h),0,.25,0),fm(.7));
      [[0,-hh,sh.w+2*t,t],[0,hh,sh.w+2*t,t],[-hw,0,t,sh.h],[hw,0,t,sh.h]].forEach(([x,zz,w,h])=>{const b=new THREE.Mesh(new THREE.BoxGeometry(w,.12,h));b.position.set(x,.3,zz);add(b,em());});
    }else if(sh.kind==='band'||sh.kind==='ribbon'){
      const[A,B]=sh.kind==='band'?along(sh.d,sh.h0,sh.d,sh.h1):along(sh.d0,sh.y,sh.d1,sh.y);
      add(new THREE.Mesh(strip(A,B)),fm(1.2));
      const[A2,B2]=sh.kind==='band'?along(sh.d,sh.h1-.4,sh.d,sh.h1):along(sh.d1-.45,sh.y+.02,sh.d1,sh.y+.02);
      add(new THREE.Mesh(strip(A2,B2)),em());
    }
    g.visible=false;grp.add(g);zobj[z.id]={g,fills,edges};
  });
  refreshZones();applyZones();
}
function applyZones(){
  const on=S.layers.areas;
  ZD.forEach(z=>{
    const vis=on&&S.chapters.has(z.chapter);const st=zstat[z.id];const lv=zoneBase(z.id);
    const o=zobj[z.id];if(o&&ok3d){o.g.visible=vis;o.fills.forEach(f=>{f.m.color.setHex(lv.c);f.m.opacity=Math.min(1,lv.o*f.k+(S.zone===z.id?.14:0));});o.edges.forEach(m=>{m.opacity=S.zone===z.id?1:.8;});}
    const el=zel[z.id];if(el)el.className='tw-zone lvl-'+(st?st.level:'controlled')+(st&&st.escalated?' raised':'')+(S.zone===z.id?' sel':'')+(el.classList.contains('hide')?' hide':'');
  });
  const key=q('.tw-zonekey');if(key)key.hidden=!(S.mode==='areas');
  const lb=q('[data-l="areas"]');if(lb)lb.setAttribute('aria-pressed',S.layers.areas);
}
function zonePulse(now){
  if(!ok3d||!S.layers.areas)return;
  ZD.forEach(z=>{const st=zstat[z.id];if(!st||st.level!=='critical'||!S.chapters.has(z.chapter))return;const o=zobj[z.id];if(!o)return;const base=LVL.critical.o;o.fills.forEach(f=>{f.m.opacity=Math.min(1,base*f.k+(S.zone===z.id?.14:0)+.12+.12*Math.sin(now/240));});});
}
function placeZones(place){
  ZD.forEach(z=>{const el=zel[z.id];if(!el)return;const vis=place(el,z.anchor);el.classList.toggle('hide',!(vis&&S.mode==='areas'&&S.layers.areas&&S.chapters.has(z.chapter)));});
}
// The overview for the Critical areas tab: far enough back, and high enough, to keep every area in frame at the shape of the 3D view.
function areasView(){
  const w=host.clientWidth||1,h=host.clientHeight||1,asp=Math.max(.5,Math.min(2.5,w/h));
  const D=Math.min(640,Math.max(520,220/(Math.tan(20*Math.PI/180)*asp))),el=60*Math.PI/180,az=48*Math.PI/180;
  return{p:[D*Math.cos(el)*Math.cos(az),D*Math.sin(el),D*Math.cos(el)*Math.sin(az)],t:[0,0,0]};
}
function settleModel(){
  S.rev='D';
  if(!ok3d)return;
  PIECES.forEach(p=>{meshes.low[p.k].scale.y=1;meshes.up[p.k].scale.y=1;});
  northUpper.visible=true;northUpper.scale.y=1;tribC.visible=false;tribD.visible=true;chairsEast.scale.set(1,1,1);scanBox.visible=false;drawHeat(true);
}
function updateModeUi(){
  root.classList.toggle('tw-mode-areas',S.mode==='areas');
  root.querySelectorAll('[data-tw^="mode-"]').forEach(b=>b.setAttribute('aria-selected',String((b.dataset.tw==='mode-areas')===(S.mode==='areas'))));
  root.querySelectorAll('[data-l]').forEach(b=>b.setAttribute('aria-pressed',S.layers[b.dataset.l]));
}
function setMode(m){
  if(m===S.mode||(m==='areas'&&!ZD.length))return;
  if(m==='areas'){
    stopAuto();tok++;S.mode='areas';
    roofWas=S.layers.roof;S.heatOn=false;S.layers.roof=false;S.layers.areas=true;
    S.sel=null;S.running=null;caption(null);settleModel();refreshZones();
    updateModeUi();applyLayers();renderPanel();refreshPins();fly(areasView(),1000);
  }else{
    S.mode='review';S.zone=null;S.layers.roof=roofWas;S.layers.areas=false;
    applyBase(S.stage);renderSteps();renderPanel();updateHeader();updateModeUi();
  }
}
function selectZone(id){
  S.zone=S.zone===id?null:id;applyZones();renderPanel();
  const z=ZD.find(x=>x.id===id);
  if(S.zone&&z){caption(`<b>${hx(z.tag)}</b>${hx(z.name)}`);fly(z.view,1000);const c=q('.tw-zcard');if(c&&c.scrollIntoView)c.scrollIntoView({block:'nearest'});}else caption(null);
}
const lvlTxt=k=>(LVL[k]||LVL.controlled).l;
function zoneCard(){
  const z=ZD.find(x=>x.id===S.zone),st=z&&zstat[z.id];if(!z||!st)return '';
  const ch=chOf(z.chapter);
  const reqs=st.findings.map(f=>{const raised=f.escalated&&f.escalated.from!==f.escalated.to;
    return `<div class="tw-req lvl-${f.level}"><header><code>${hx(f.id)}</code><b>${hx(f.title)}</b><span class="tw-lvl lvl-${f.level}">${lvlTxt(f.level)}</span></header><dl class="tw-kv"><dt>Required</dt><dd>${hx(f.required)}</dd><dt>Status</dt><dd>${hx(f.status)}</dd>${f.evidence?`<dt>Evidence</dt><dd>${hx(f.evidence)}</dd>`:''}<dt>Exposure</dt><dd>${hx(f.reason)}</dd>${raised?`<dt>Raised</dt><dd><span class="tw-esc">${lvlTxt(f.escalated.from)} → ${lvlTxt(f.escalated.to)}</span> ${hx(f.escalated.reasons.map(r=>r.id+' '+r.title).join('; '))}</dd>`:''}${f.level!=='controlled'?`<dt>Action</dt><dd>${hx(f.action)}</dd><dt>Owner</dt><dd>${hx(f.owner)}, due ${hx(f.due)}</dd>`:''}</dl></div>`;}).join('');
  return `<div class="tw-card tw-zcard"><h3>${hx(z.name)} <span class="tw-lvl lvl-${st.level}">${lvlTxt(st.level)}</span></h3><p class="tw-small" style="--cc:${chColor(z.chapter)}"><span class="tw-chip"><i></i>${ch?hx(ch.id+' '+ch.name):''}</span> ${hx(z.about)}</p><div class="tw-reqs">${reqs}</div></div>`;
}
function siteCard(){
  if(!design||!design.site)return '';
  const list=design.site.list();
  const dt=iso=>{try{return new Date(iso+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});}catch(e){return iso;}};
  return `<div><p class="tw-sec">Site conditions</p><p class="tw-small">Things that happen on site raise the exposure of the requirements they touch. Log one and the heat map, the stadium page, the Overview and the owners' alerts change with it.</p><div class="tw-sites">${list.map(c=>`<div class="tw-site ${c.logged?'on':''}"><header><span class="tw-kind ${c.kind}">${hx(c.kindLabel)}</span><b>${hx(c.id)}</b><span class="tw-small">${dt(c.logged?c.loggedOn:c.raised)}</span></header><p class="t">${hx(c.title)}</p><p class="msg">${hx(c.detail)}</p><ul class="tw-eff">${c.effects.map(e=>`<li><code>${hx(e.requirementId)}</code><span>${hx(e.title)}${e.zone?` <small>· ${hx(e.zone)}</small>`:''}</span><span class="tw-fromto">${e.from&&e.to&&e.from!==e.to?`<i class="lvl-${e.from}">${lvlTxt(e.from)}</i> → <i class="lvl-${e.to}">${lvlTxt(e.to)}</i>`:`<small>${e.to?'no change':'not in scope'}</small>`}</span></li>`).join('')}</ul><footer><span>${hx(c.source)}</span>${c.logged?`<span class="tw-sent">Logged</span><button type="button" class="linkish" data-twsite="${hx(c.id)}" data-act="withdraw">Withdraw</button>`:`<button type="button" class="primary" data-twsite="${hx(c.id)}" data-act="log">Log site update</button>`}</footer></div>`).join('')}</div></div>`;
}
function areasPanel(){
  const all=ZD.map(z=>({z,s:zstat[z.id]})).filter(x=>x.s);
  const rank=k=>LVL_ORDER.indexOf(k);
  const shown=all.filter(x=>S.chapters.has(x.z.chapter)).sort((a,b)=>rank(a.s.level)-rank(b.s.level)||b.s.open-a.s.open||a.z.name.localeCompare(b.z.name));
  const n=k=>shown.filter(x=>x.s.level===k).length;
  const open=shown.reduce((t,x)=>t+x.s.open,0),raised=shown.filter(x=>x.s.escalated).length;
  const hid=CHAPS.length-S.chapters.size;
  return `<div><div class="tw-eyebrow">Critical areas<span class="tw-actor engine">Register</span></div><h2>Where the exposure is</h2><p class="tw-lede">Each area of the model carries the FIFA requirements that belong to it. Its colour is the worst mitigation exposure among them, read from the register, so it matches the stadium page, the Overview and the reports. Its outline is the colour of its chapter.</p></div>
  <div class="tw-summary lvls">${LVL_ORDER.map(k=>`<div class="lvl-${k}"><b>${n(k)}</b><small>${lvlTxt(k)}</small></div>`).join('')}</div>
  <p class="tw-small">${shown.length} of ${all.length} areas shown · ${open} open finding${open===1?'':'s'}${raised?` · ${raised} raised by site conditions`:''}${hid?` · ${hid} chapter${hid===1?'':'s'} hidden`:''}</p>
  <div class="tw-zrows">${shown.length?shown.map(x=>`<button type="button" class="tw-zrow lvl-${x.s.level} ${S.zone===x.z.id?'sel':''}" data-twzone="${x.z.id}" style="--zc:${chColor(x.z.chapter)}"><i class="dot"></i><span class="zn"><b>${hx(x.z.name)}</b><small>${hx((chOf(x.z.chapter)||{}).id||'')} ${hx((chOf(x.z.chapter)||{}).short||'')} · ${x.s.open} open</small></span>${x.s.escalated?'<em class="tw-raised">Raised</em>':''}<span class="tw-lvl lvl-${x.s.level}">${lvlTxt(x.s.level)}</span></button>`).join(''):'<p class="tw-small">No chapter is switched on. Use the chapter buttons on the model.</p>'}</div>
  ${zoneCard()}${siteCard()}`;
}
function areasClick(b){
  const t=b.dataset.tw;
  if(t==='mode-review'||t==='mode-areas'){setMode(t==='mode-areas'?'areas':'review');return true;}
  if(b.dataset.twch!==undefined){
    const k=b.dataset.twch;
    if(k==='toggle'){const bx=q('.tw-chapters');if(bx)bx.classList.toggle('collapsed');return true;}
    if(k==='all')S.chapters=new Set(CHAPS.map(c=>c.id));else if(k==='none')S.chapters=new Set();else if(S.chapters.has(k))S.chapters.delete(k);else S.chapters.add(k);
    if(S.zone&&!S.chapters.has((ZD.find(x=>x.id===S.zone)||{}).chapter))S.zone=null;
    syncChapters();applyZones();if(S.mode==='areas')renderPanel();return true;
  }
  if(b.dataset.twzone){if(S.mode==='areas')selectZone(b.dataset.twzone);return true;}
  if(b.dataset.twsite){
    const id=b.dataset.twsite,act=b.dataset.act;
    if(hooks.onSite)hooks.onSite(id,act);
    refreshZones();applyZones();renderPanel();refreshPins();updateHeader();
    const c=design&&design.site&&design.site.list().find(x=>x.id===id);
    if(c&&act==='log')emit('site:'+id,'Site condition logged: '+c.title);
    return true;
  }
  return false;
}
