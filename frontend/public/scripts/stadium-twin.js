
// ---------- Design intake: 3D stadium twin (simplified King Salman International Stadium, simulated submissions, illustrative thresholds) ----------
window.WNSTwin=(function(){
"use strict";
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait=ms=>new Promise(r=>setTimeout(r,RM?Math.min(ms,120):ms));
const fmt=n=>n.toLocaleString('en-US');
const HAS3=typeof THREE!=='undefined'&&typeof THREE.OrbitControls!=='undefined';

const STEPS=[
  {k:'Submit',actor:'Design firm',cls:'firm'},
  {k:'Extract',actor:'Engine',cls:'engine'},
  {k:'Generate checks',actor:'Engine',cls:'engine'},
  {k:'Run checks',actor:'Engine',cls:'engine'},
  {k:'Clarify & route',actor:'Engine → firm',cls:'engine'},
  {k:'Resubmit',actor:'Design firm',cls:'firm'},
  {k:'Gate decision',actor:'Assurance team',cls:''}
];
const WEIGHT={Critical:3,High:2,Medium:1};
const SLA={Critical:7,High:14,Medium:21};
const CHECKS=[
  {id:'CAP-01',fam:'Capacity',crit:'Critical',t:'Gross seating capacity',req:'The stadium provides the gross seating capacity required for its match allocation.',rule:'seats_gross ≥ 80,000 (opening match and final)',ev:'Seat instances in 412 tier blocks · Bowl model',pin:[80,22,0],view:{p:[-30,40,20],t:[75,20,0]},hl:'cap'},
  {id:'FOP-01',fam:'Field of play',crit:'Critical',t:'Field of play dimensions',req:'The field of play measures 105 m by 68 m.',rule:'length = 105.0 m ∧ width = 68.0 m (±0.1)',ev:'Space "FOP-Pitch" boundary · Bowl model',pin:[0,1,0],view:{p:[10,140,90],t:[0,0,0]},hl:'fop'},
  {id:'FOP-02',fam:'Field of play',crit:'High',t:'Clear run-off around the pitch',req:'An obstruction-free auxiliary area surrounds the field of play.',rule:'pitch_area ≥ 125 × 85 m ∧ runoff_goal ≥ 6.0 m',ev:'Pitch boundary to nearest obstruction · Bowl model',pin:[58,1,30],view:{p:[20,46,52],t:[58,0,14]},hl:null},
  {id:'ORI-01',fam:'Field of play',crit:'High',t:'Pitch orientation',req:'The pitch runs approximately north to south to limit low sun in players’ eyes.',rule:'|bearing| ≤ 15° from true north',ev:'Pitch axis vs. site true north · Bowl model',pin:[30,1,-22],view:{p:[0,170,24],t:[0,0,0]},hl:null},
  {id:'MED-01',fam:'Media',crit:'Critical',t:'Media tribune size',req:'A media tribune on the main stand, centred on the halfway line, with desk positions for written press.',rule:'media_seats ≥ 2,000 ∧ desk_positions ≥ 800',ev:'Zone "MEDIA-TRIB" seats and desk elements · Bowl model',pin:[0,11,-58],view:{p:[0,30,22],t:[0,10,-58]},hl:'med'},
  {id:'ACC-01',fam:'Accessibility',crit:'Critical',t:'Wheelchair positions',req:'Wheelchair user positions of at least 1% of capacity, distributed across every stand.',rule:'wc_positions ≥ 1% × seats_gross ∧ min(per stand) > 0',ev:'Wheelchair family + accessibility schedule',pin:[0,19,67],view:{p:[0,32,-22],t:[0,14,62]},hl:'acc'},
  {id:'LGT-01',fam:'Floodlighting',crit:'High',t:'Floodlight illuminance and uniformity',req:'Broadcast-grade floodlighting across the whole field of play.',rule:'Ev,min ≥ 2,500 lux ∧ U2 ≥ 0.70 over 100% of grid',ev:'Lighting calculation grid tables, pp. 4–11',pin:[-36,1,0],view:{p:[-10,88,40],t:[-30,0,0]},hl:'lgt'},
  {id:'DRS-01',fam:'Team facilities',crit:'High',t:'Team dressing rooms',req:'Each team dressing room meets the minimum floor area.',rule:'area(DR-HOME), area(DR-AWAY) ≥ 150 m²',ev:'Spaces "DR-HOME", "DR-AWAY" net areas · Bowl model',pin:[24,4,-56],view:{p:[40,30,-18],t:[22,4,-56]},hl:null},
  {id:'THR-01',fam:'Spectator comfort',crit:'Medium',t:'Green roof shading specification',req:'The green roof and walls provide solar shading to spectator seating, with build-up and shading properties declared.',rule:'roof.buildup ≠ null ∧ roof.shading_factor declared',ev:'Roof element KSIS-ROOF-01 property sets',pin:[-30,49,92],view:{p:[-70,160,250],t:[-15,40,70]},hl:'thr'}
];
const CK=Object.fromEntries(CHECKS.map(c=>[c.id,c]));
const GX=21,GZ=14;
function lux(x,z){const nx=x/52.5,nz=z/34;return 3300-330*nx*nx-230*nz*nz+55*Math.sin(x*.13)*Math.cos(z*.17);}
function gridStats(full){let mn=1e9,mx=0,n=0;for(let j=0;j<GX;j++){const x=-52.5+(j+.5)*5;if(!full&&x<-17.5)continue;for(let i=0;i<GZ;i++){const z=-34+(i+.5)*68/GZ,v=lux(x,z);mn=Math.min(mn,v);mx=Math.max(mx,v);n++;}}return{min:Math.round(mn/10)*10,u2:(mn/mx).toFixed(2),cells:n};}
const GC=gridStats(false),GD=gridStats(true);
const FACTS=[
  ['Gross seats','79,180','1,046 tier blocks · Bowl model Rev C'],
  ['North upper tier','deferred','Phasing note PH-07, not modelled in Rev C',true],
  ['Field of play','105.0 × 68.0 m','Space FOP-Pitch · hybrid grass'],
  ['Pitch area, run-off','125 × 85 m · 10.0 m / 8.5 m','Pitch area boundary to first obstruction'],
  ['Pitch bearing','006° from true north','Site true north vs pitch axis'],
  ['Media tribune','1,780 seats · 690 desks','Zone MEDIA-TRIB, West stand'],
  ['Wheelchair positions','712 (East stand: 0)','Accessibility schedule Rev C'],
  ['Lighting calc coverage',`${GC.cells} of ${GX*GZ} grid points`,'Lighting calc PDF Rev C, south third missing',true],
  ['Dressing rooms','168 m² · 168 m²','Spaces DR-HOME, DR-AWAY'],
  ['Hospitality','Royal suite 150 · 120 suites · 2,500 VIP','Hospitality zones, matches public brief'],
  ['Green roof build-up','no material data','Element KSIS-ROOF-01, generic object',true]
];
const RES={C:{
  'CAP-01':{s:'fail',v:'79,180 seats',why:'Short by 820 seats for an opening-match and final venue. The north upper tier is deferred in Rev C (phasing note PH-07).'},
  'FOP-01':{s:'pass',v:'105.0 × 68.0 m',why:'Pitch boundary matches the required dimensions.'},
  'FOP-02':{s:'pass',v:'125 × 85 m · 10.0 m',why:'Pitch area matches the public brief and run-off exceeds the minimum.'},
  'ORI-01':{s:'pass',v:'006°',why:'Within 15° of north–south.'},
  'MED-01':{s:'fail',v:'1,780 seats · 690 desks',why:'Below 2,000 seats and 800 desk positions for a final venue. Tribune spans 20 m of the West stand.'},
  'ACC-01':{s:'fail',v:'712 · 0.90% · East 0',why:'Below 1% of gross capacity (792 needed), and the East stand has no positions at all.'},
  'LGT-01':{s:'evid',v:`${Math.round(GC.cells/(GX*GZ)*100)}% of grid`,why:`The calc covers the north two-thirds only (Ev,min ${fmt(GC.min)} lux there). The south third cannot be assured, so the engine asks instead of guessing.`},
  'DRS-01':{s:'pass',v:'168 m² each',why:'Both rooms exceed 150 m².'},
  'THR-01':{s:'evid',v:'no material data',why:'The green roof is a generic object with no planting build-up or shading properties. Asked, not failed.'}
}};
RES.D=Object.assign({},RES.C,{
  'CAP-01':{s:'pass',v:'92,760 seats',why:'North upper tier brought into Rev D (+13,580 seats). Matches the published 92,760 capacity.'},
  'MED-01':{s:'pass',v:'2,120 seats · 840 desks',why:'Tribune widened to 25 m on the halfway line.'},
  'ACC-01':{s:'pass',v:'960 · 1.03% · East 214',why:'All four stands now provide positions.'},
  'LGT-01':{s:'pass',v:`Ev,min ${fmt(GD.min)} lux · U2 ${GD.u2}`,why:'Full-grid calc submitted. Every grid point meets both thresholds.'}
});
const ITEMS=[
  {id:'NCR-031',kind:'ncr',chk:'CAP-01',to:'Design team · Design lead',msg:'Gross capacity in Rev C is 79,180 against 80,000 required for the opening match and final. Bring the deferred north upper tier into the design.'},
  {id:'NCR-032',kind:'ncr',chk:'MED-01',to:'Design team · Design lead',msg:'Media tribune provides 1,780 seats and 690 desks. Required: 2,000 seats and 800 desks, centred on the halfway line.'},
  {id:'NCR-033',kind:'ncr',chk:'ACC-01',to:'Design team · Access consultant',msg:'712 wheelchair positions (0.90%). East stand has none. Provide at least 1% distributed across all stands.'},
  {id:'CLR-014',kind:'clr',chk:'LGT-01',to:'Design team · Lighting consultant',msg:'Lighting calc covers the north two-thirds of the pitch only. Please submit the full-grid calculation.'},
  {id:'CLR-015',kind:'clr',chk:'THR-01',to:'Design team · Roof engineer',msg:'Green roof KSIS-ROOF-01 has no build-up or shading properties. Please confirm the planting build-up and shading factor.'}
];
function due(crit){const d=new Date('2026-10-30T00:00:00Z');d.setUTCDate(d.getUTCDate()+SLA[crit]);return d.toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});}

const S={stage:0,shown:{},sel:null,running:null,reveal:0,sent:false,rev:'C',layers:{heat:true,acc:true,roof:true,pins:true},auto:false,heatOn:false,pinsOn:new Set()};
let tok=0,playTok=0,introDone=false,hooks={onEvent:null,onChange:null};const logged=new Set();
function emit(key,text){if(logged.has(key))return;logged.add(key);if(hooks.onEvent)hooks.onEvent(text);}

/* ---------- DOM ---------- */
const root=document.createElement('div');root.className='twin';
root.innerHTML=`
<div class="tw-bar">
  <div class="tw-steps-wrap"><nav class="tw-steps" aria-label="Design intake steps"></nav></div>
  <div class="tw-meta">
    <div class="tw-metric"><small>Model</small><b data-m="rev">Rev C</b></div>
    <div class="tw-metric"><small>Assured</small><b data-m="score">—</b></div>
    <div class="tw-metric"><small>G1 Design freeze</small><span class="pill p-mute" data-m="gate">Not assessed</span></div>
    <button type="button" class="tourbtn" data-tw="play">Play intake demo</button>
  </div>
</div>
<div class="tw-main">
  <div class="tw-stage">
    <div class="tw-pins"></div>
    <div class="tw-caption" hidden></div>
    <div class="tw-ov tw-heatkey" hidden><span>Vertical illuminance to main camera (lux)</span><div class="ramp"></div><div class="rl"><span>2,500</span><span>2,900</span><span>3,300</span></div><div class="nd"><i></i><span>No calculation data submitted</span></div></div>
    <div class="tw-ov tw-legend"><span class="pass">Pass</span><span class="fail">Fail</span><span class="evid">Needs evidence</span><span class="pend">Pending</span></div>
    <div class="tw-ov tw-layers">
      <button class="tw-layer" type="button" data-l="heat" aria-pressed="true">Lighting calc</button>
      <button class="tw-layer" type="button" data-l="acc" aria-pressed="true">Wheelchair positions</button>
      <button class="tw-layer" type="button" data-l="roof" aria-pressed="true">Green roof and facade</button>
      <button class="tw-layer" type="button" data-l="pins" aria-pressed="true">Check pins</button>
      <button class="tw-layer" type="button" data-tw="recenter">Reset view</button>
    </div>
  </div>
  <aside class="tw-panel"><div class="tw-scroll"></div><div class="tw-foot"><button type="button" data-tw="back">Back</button><button type="button" class="primary" data-tw="next">Next</button></div></aside>
</div>`;
const q=s=>root.querySelector(s);
const host=q('.tw-stage'),pinLayer=q('.tw-pins');

/* ---------- 3D scene ---------- */
let renderer,scene,camera,controls,ok3d=HAS3;
if(ok3d){try{renderer=new THREE.WebGLRenderer({antialias:true});}catch(e){ok3d=false;}}
if(!ok3d){const d=document.createElement('div');d.className='tw-fail';d.textContent='The 3D view needs WebGL, which is turned off in this browser. The step-by-step record still works.';host.appendChild(d);}
const meshes={low:{},up:{}},roofMeshes=[],hlMats={cap:[],med:[],acc:[],thr:[]};
let tribC,tribD,chairsBase,chairsEast,heatMesh,heatCanvas,heatTex,scanBox,dimLines,northUpper,fixtures=[],cTmp,COL,v3,flight=null;
const R0=18,HA=62.5,HB=42.5,SX=HA-R0,SZ=HB-R0;
const PIECES=[
  {k:'N',s:1,a:[HA,-SZ],b:[HA,SZ],n:[1,0]},{k:'NE',c:[SX,SZ],a0:0,a1:Math.PI/2},
  {k:'E',s:1,a:[SX,HB],b:[-SX,HB],n:[0,1]},{k:'SE',c:[-SX,SZ],a0:Math.PI/2,a1:Math.PI},
  {k:'S',s:1,a:[-HA,SZ],b:[-HA,-SZ],n:[-1,0]},{k:'SW',c:[-SX,-SZ],a0:Math.PI,a1:1.5*Math.PI},
  {k:'W',s:1,a:[-SX,-HB],b:[SX,-HB],n:[0,-1]},{k:'NW',c:[SX,-SZ],a0:1.5*Math.PI,a1:2*Math.PI}
];
const PC=Object.fromEntries(PIECES.map(p=>[p.k,p]));
function pt(pc,f,d){if(pc.s)return[pc.a[0]+(pc.b[0]-pc.a[0])*f+pc.n[0]*d,pc.a[1]+(pc.b[1]-pc.a[1])*f+pc.n[1]*d];const g=pc.a0+(pc.a1-pc.a0)*f;return[pc.c[0]+(R0+d)*Math.cos(g),pc.c[1]+(R0+d)*Math.sin(g)];}
function plen(pc){return pc.s?Math.hypot(pc.b[0]-pc.a[0],pc.b[1]-pc.a[1]):R0*Math.PI/2;}
function profLower(){const p=[{d:0,h:0},{d:0,h:1.2}];let d=0,h=1.2;for(let r=0;r<30;r++){d+=.85;p.push({d,h,seat:1,row:r});h+=.36+r*.008;p.push({d,h});}p.push({d:d+3,h});p.push({d:d+3,h:0});p.push({d:0,h:0});return p;}
function profUpper(){const p=[{d:26,h:17.5},{d:26,h:19.5}];let d=26,h=19.5;for(let r=0;r<30;r++){d+=.85;p.push({d,h,seat:1,row:r+40});h+=.6+r*.01;p.push({d,h});}p.push({d:d+1.5,h});p.push({d:d+1.5,h:0});p.push({d:29,h:0});p.push({d:29,h:16.6});p.push({d:26,h:17.5});return p;}
const LOW=profLower(),UP=profUpper(),LOW_TOP=LOW[LOW.length-4];
const VIEW0={p:[230,170,255],t:[0,8,0]};

function build(){
  cTmp=new THREE.Color();
  const cTeal=new THREE.Color(0x0a6b3c),cSand=new THREE.Color(0xc89c55),cRiser=new THREE.Color(0x56544f),cBack=new THREE.Color(0x77736a);
  COL={pass:new THREE.Color(0x46c389),fail:new THREE.Color(0xf05d4e),evid:new THREE.Color(0xf2a73b),sel:new THREE.Color(0xe2b56a)};
  v3=new THREE.Vector3();
  function seatColor(x,z,row){const a=Math.atan2(z,x);const w=Math.sin(a*5+row*.32);const t=Math.max(0,(w-.55)/.45);cTmp.copy(cTeal).lerp(cSand,t*.9);cTmp.offsetHSL(0,0,((row*37)%7)/70-.04);return cTmp;}
  function sweep(pc,f0,f1,prof,colorFn,lift){
    lift=lift||0;const n=pc.s?Math.max(1,Math.ceil(plen(pc)*(f1-f0)/2.2)):Math.max(2,Math.ceil(18*(f1-f0)));const pos=[],col=[];
    for(let j=0;j<n;j++){const fa=f0+(f1-f0)*j/n,fb=f0+(f1-f0)*(j+1)/n;
      for(let k=0;k<prof.length-1;k++){const p=prof[k],q=prof[k+1];const a=pt(pc,fa,p.d),b=pt(pc,fb,p.d),c=pt(pc,fb,q.d),d=pt(pc,fa,q.d);
        pos.push(a[0],p.h+lift,a[1],b[0],p.h+lift,b[1],c[0],q.h+lift,c[1],a[0],p.h+lift,a[1],c[0],q.h+lift,c[1],d[0],q.h+lift,d[1]);
        const cc=colorFn(p,q,(a[0]+c[0])/2,(a[1]+c[1])/2);for(let v=0;v<6;v++)col.push(cc.r,cc.g,cc.b);}}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.computeVertexNormals();return g;
  }
  const bowlColor=(p,q,x,z)=>{if(q.seat&&p.h===q.h)return seatColor(x,z,q.row);if(p.d===q.d&&q.h>p.h&&p.d>0)return cRiser;return cBack;};
  const stdMat=()=>new THREE.MeshStandardMaterial({vertexColors:true,roughness:.86,metalness:0,side:THREE.DoubleSide,emissive:0x000000});

  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  host.insertBefore(renderer.domElement,host.firstChild);
  scene=new THREE.Scene();scene.background=new THREE.Color(0x0d181c);scene.fog=new THREE.Fog(0x0d181c,460,980);
  camera=new THREE.PerspectiveCamera(40,1,1,2000);camera.position.set(...VIEW0.p);
  controls=new THREE.OrbitControls(camera,renderer.domElement);controls.target.set(...VIEW0.t);
  controls.enableDamping=true;controls.dampingFactor=.08;controls.maxPolarAngle=1.48;controls.minDistance=30;controls.maxDistance=640;controls.autoRotateSpeed=.35;
  controls.addEventListener('start',()=>{controls.autoRotate=false;flight=null;});
  scene.add(new THREE.HemisphereLight(0xcfe3ef,0x3b3226,.62));
  const sun=new THREE.DirectionalLight(0xffe0b0,1.05);sun.position.set(-110,170,90);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-200,right:200,top:200,bottom:-200,near:10,far:700});sun.shadow.bias=-.0006;scene.add(sun);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(1600,1600),new THREE.MeshStandardMaterial({color:0x2a3a26,roughness:1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
  function rrShape(ha,hb,r){const s=new THREE.Shape();s.moveTo(-ha+r,-hb);s.lineTo(ha-r,-hb);s.absarc(ha-r,-hb+r,r,-Math.PI/2,0);s.lineTo(ha,hb-r);s.absarc(ha-r,hb-r,r,0,Math.PI/2);s.lineTo(-ha+r,hb);s.absarc(-ha+r,hb-r,r,Math.PI/2,Math.PI);s.lineTo(-ha,-hb+r);s.absarc(-ha+r,-hb+r,r,Math.PI,1.5*Math.PI);return s;}
  const plaza=new THREE.Mesh(new THREE.RingGeometry(0,168,96),new THREE.MeshStandardMaterial({color:0x4a4436,roughness:1}));plaza.rotation.x=-Math.PI/2;plaza.position.y=.03;plaza.receiveShadow=true;scene.add(plaza);
  const bowlFloor=new THREE.Mesh(new THREE.ShapeGeometry(rrShape(HA,HB,R0),24),new THREE.MeshStandardMaterial({color:0x1d4529,roughness:1}));bowlFloor.rotation.x=-Math.PI/2;bowlFloor.position.y=.06;bowlFloor.receiveShadow=true;scene.add(bowlFloor);
  // pitch
  const pc=document.createElement('canvas');pc.width=1050;pc.height=680;const x=pc.getContext('2d');
  for(let i=0;i<14;i++){x.fillStyle=i%2?'#2f7a3c':'#2a7036';x.fillRect(i*75,0,75,680);}
  x.strokeStyle='rgba(255,255,255,.92)';x.lineWidth=4;const M=v=>v*10;
  x.strokeRect(2,2,1046,676);x.beginPath();x.moveTo(525,0);x.lineTo(525,680);x.stroke();x.beginPath();x.arc(525,340,M(9.15),0,Math.PI*2);x.stroke();
  [[0,1],[1050,-1]].forEach(([gx,s])=>{x.strokeRect(s>0?gx:gx-M(16.5),340-M(20.16),M(16.5),M(40.32));x.strokeRect(s>0?gx:gx-M(5.5),340-M(9.16),M(5.5),M(18.32));
    x.fillStyle='#fff';x.beginPath();x.arc(gx+s*M(11),340,4,0,Math.PI*2);x.fill();x.beginPath();x.arc(gx+s*M(11),340,M(9.15),s>0?-.93:Math.PI-.93,s>0?.93:Math.PI+.93);x.stroke();});
  x.fillStyle='#fff';x.beginPath();x.arc(525,340,4,0,Math.PI*2);x.fill();
  const ptex=new THREE.CanvasTexture(pc);ptex.anisotropy=8;
  const pitch=new THREE.Mesh(new THREE.PlaneGeometry(105,68),new THREE.MeshStandardMaterial({map:ptex,roughness:.95}));pitch.rotation.x=-Math.PI/2;pitch.position.y=.1;pitch.receiveShadow=true;scene.add(pitch);
  const gm=new THREE.MeshStandardMaterial({color:0xffffff});
  [-52.5,52.5].forEach(gx=>{const g=new THREE.Group();[-3.66,3.66].forEach(z=>{const p=new THREE.Mesh(new THREE.BoxGeometry(.15,2.44,.15),gm);p.position.set(0,1.22,z);g.add(p);});const b=new THREE.Mesh(new THREE.BoxGeometry(.15,.15,7.47),gm);b.position.y=2.44;g.add(b);g.position.x=gx+(gx>0?.1:-.1);scene.add(g);});
  // bowl, roof, columns, floodlights
  const roofP=[{d:12,h:46.6},{d:56,h:43},{d:56,h:42.4},{d:12,h:46},{d:12,h:46.6}];
  const beamP=[{d:11.5,h:46.3},{d:12.3,h:47.1},{d:12.3,h:45.6},{d:11.5,h:46.3}];
  const ROOF_IN=20,RTOP=118,RBASE=140,HTOP=47;
  const cGreen=new THREE.Color(0x4e6e3b),cGreen2=new THREE.Color(0x3f5c30),cPath=new THREE.Color(0xc9b386);
  function radialRoof(pc){
    const n=pc.s?Math.max(1,Math.ceil(plen(pc)/2.2)):18,pos=[],col=[];
    const bands=[[0,.55,cGreen],[.55,.62,cPath],[.62,1,cGreen2]];
    for(let j=0;j<n;j++){const fa=j/n,fb=(j+1)/n;const a=pt(pc,fa,ROOF_IN),b=pt(pc,fb,ROOF_IN);
      const oa=[a[0]/Math.hypot(...a)*RTOP,a[1]/Math.hypot(...a)*RTOP],ob=[b[0]/Math.hypot(...b)*RTOP,b[1]/Math.hypot(...b)*RTOP];
      bands.forEach(([t0,t1,c])=>{const L=(p,q,t)=>[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t];const A=L(a,oa,t0),B=L(b,ob,t0),C=L(b,ob,t1),D=L(a,oa,t1);const y=HTOP;
        pos.push(A[0],y,A[1],B[0],y,B[1],C[0],y,C[1],A[0],y,A[1],C[0],y,C[1],D[0],y,D[1]);for(let v=0;v<6;v++)col.push(c.r,c.g,c.b);});
      // inner fascia
      pos.push(a[0],HTOP,a[1],b[0],HTOP,b[1],b[0],HTOP-2.2,b[1],a[0],HTOP,a[1],b[0],HTOP-2.2,b[1],a[0],HTOP-2.2,a[1]);for(let v=0;v<6;v++)col.push(.55,.53,.47);
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.computeVertexNormals();return g;
  }
  function buildShell(){
    // circular, segmented green shell: the published 'seed cracking the earth' concept, simplified
    const NSEG=28,gap=.014,pos=[],col=[];
    for(let k=0;k<NSEG;k++){
      const a0=k/NSEG*Math.PI*2+gap,a1=(k+1)/NSEG*Math.PI*2-gap,lift=((k*7)%5)*.9,bulge=((k*3)%4)*1.2;
      const prof=[[RTOP,HTOP+lift*.3],[RTOP+9+bulge,HTOP-9],[RBASE-4+bulge*.5,18],[RBASE+bulge*.6,0]];
      for(let i=0;i<10;i++){const u0=a0+(a1-a0)*i/10,u1=a0+(a1-a0)*(i+1)/10;
        for(let m=0;m<prof.length-1;m++){const[r0,h0]=prof[m],[r1,h1]=prof[m+1];
          const P=(r,u,h)=>[r*Math.cos(u),h,r*Math.sin(u)];const A=P(r0,u0,h0),B=P(r0,u1,h0),C=P(r1,u1,h1),D=P(r1,u0,h1);
          pos.push(...A,...B,...C,...A,...C,...D);
          for(let v=0;v<6;v++){const band=Math.floor((h0+h1)/2/4)%2;const c=band?cGreen:cGreen2;cTmp.copy(c).offsetHSL(0,0,((k*13)%5)/90-.02);col.push(cTmp.r,cTmp.g,cTmp.b);}}}
      // top cap of each segment so the cracks read from above
      const P=(r,u)=>[r*Math.cos(u),HTOP+lift*.3,r*Math.sin(u)];
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.computeVertexNormals();
    const shell=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95,side:THREE.DoubleSide}));shell.castShadow=shell.receiveShadow=true;scene.add(shell);roofMeshes.push(shell);
    // warm light showing through the cracks
    const glow=new THREE.Mesh(new THREE.CylinderGeometry(RTOP+2,RBASE-6,HTOP-1,96,1,true),new THREE.MeshBasicMaterial({color:0x7a4a14,side:THREE.DoubleSide}));glow.position.y=(HTOP-1)/2;scene.add(glow);roofMeshes.push(glow);
    // cracked-earth apron at the base
    const apron=new THREE.Mesh(new THREE.RingGeometry(RBASE,RBASE+14,96),new THREE.MeshStandardMaterial({color:0x6b5a40,roughness:1}));apron.rotation.x=-Math.PI/2;apron.position.y=.08;apron.receiveShadow=true;scene.add(apron);
    // royal box and VVIP band at the centre of the west stand
    const royal=new THREE.Mesh(sweep(PC.W,.42,.58,[{d:25.7,h:15.4},{d:25.7,h:17.7}],()=>cTmp.set(0xffffff)),new THREE.MeshStandardMaterial({color:0x8a6a2a,emissive:0xe2b56a,emissiveIntensity:.7,side:THREE.DoubleSide}));scene.add(royal);
    // King Abdulaziz Park: trees and the connecting valley to the west
    const valley=new THREE.Mesh(new THREE.PlaneGeometry(34,520),new THREE.MeshStandardMaterial({color:0x5a4e3a,roughness:1}));valley.rotation.x=-Math.PI/2;valley.position.set(0,.05,-(RBASE+14+260));valley.receiveShadow=true;scene.add(valley);
    const tg=new THREE.ConeGeometry(3.2,9,6),tm=new THREE.MeshStandardMaterial({color:0x33582f,roughness:1});const N=520;const trees=new THREE.InstancedMesh(tg,tm,N);const o=new THREE.Object3D();let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
    let k=0;while(k<N){const r=180+rnd()*360,a=rnd()*Math.PI*2;const x=r*Math.cos(a),z=r*Math.sin(a);if(Math.abs(x)<26&&z<0)continue;o.position.set(x,4.5,z);const sc=.7+rnd()*.8;o.scale.set(sc,sc,sc);o.updateMatrix();trees.setMatrixAt(k++,o.matrix);}
    trees.castShadow=true;scene.add(trees);
  }
  PIECES.forEach(p=>{
    const l=new THREE.Mesh(sweep(p,0,1,LOW,bowlColor),stdMat());l.castShadow=l.receiveShadow=true;scene.add(l);meshes.low[p.k]=l;
    const u=new THREE.Mesh(sweep(p,0,1,UP,bowlColor),stdMat());u.castShadow=u.receiveShadow=true;scene.add(u);meshes.up[p.k]=u;
    const rm=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95,side:THREE.DoubleSide,emissive:0x000000});
    const r=new THREE.Mesh(radialRoof(p),rm);r.castShadow=true;r.receiveShadow=true;scene.add(r);roofMeshes.push(r);hlMats.thr.push(rm);
    const glass=new THREE.Mesh(sweep(p,0,1,[{d:25.95,h:15.6},{d:25.95,h:17.5}],()=>cTmp.set(0xffffff)),new THREE.MeshStandardMaterial({color:0x2b3a44,emissive:0xffcf8a,emissiveIntensity:.55,side:THREE.DoubleSide}));scene.add(glass);
    const L=plen(p);
    const nf=Math.max(2,Math.round(L/7));
    for(let i=0;i<nf;i++){const[fx,fz]=pt(p,(i+.5)/nf,20.3);const m=new THREE.Mesh(new THREE.BoxGeometry(1.1,.7,1.1),new THREE.MeshBasicMaterial({color:0xfff4d6}));m.position.set(fx,46.4,fz);scene.add(m);fixtures.push(m);roofMeshes.push(m);}
  });
  buildShell();
  hlMats.cap.push(meshes.low.N.material,meshes.up.N.material);hlMats.acc.push(meshes.low.E.material);northUpper=meshes.up.N;
  const i0=LOW.findIndex(p=>p.row===9)-1,i1=LOW.findIndex(p=>p.row===22)+1;const tribProf=LOW.slice(i0,i1+1);
  const tribColor=(p,q)=>q.seat&&p.h===q.h?cTmp.set(0x1b2b35):cTmp.set(0xd9d2c2);const WL=plen(PC.W),tw=m=>[.5-m/2/WL,.5+m/2/WL];
  tribC=new THREE.Mesh(sweep(PC.W,...tw(20),tribProf,tribColor,.07),stdMat());tribD=new THREE.Mesh(sweep(PC.W,...tw(25),tribProf,tribColor,.08),stdMat());
  [tribC,tribD].forEach(m=>{m.receiveShadow=true;scene.add(m);hlMats.med.push(m.material);});
  const chairGeo=new THREE.BoxGeometry(2.4,.6,1.4),chairMat=new THREE.MeshStandardMaterial({color:0x5b8cff,emissive:0x2448b0,emissiveIntensity:.8});
  function chairs(list){const g=new THREE.Group();list.forEach(([k,f])=>{const p=PC[k];const[x0,z0]=pt(p,f,LOW_TOP.d+1.4);const[x1,z1]=pt(p,Math.min(1,f+.01),LOW_TOP.d+1.4);const m=new THREE.Mesh(chairGeo,chairMat);m.position.set(x0,LOW_TOP.h+.35,z0);m.rotation.y=-Math.atan2(z1-z0,x1-x0);g.add(m);});scene.add(g);return g;}
  const base=[];['N','S','W'].forEach(k=>[.15,.38,.62,.85].forEach(f=>base.push([k,f])));['NE','SE','SW','NW'].forEach(k=>base.push([k,.5]));
  chairsBase=chairs(base);chairsEast=chairs([.12,.3,.5,.7,.88].map(f=>['E',f]));
  heatCanvas=document.createElement('canvas');heatCanvas.width=GX*20;heatCanvas.height=GZ*20;heatTex=new THREE.CanvasTexture(heatCanvas);heatTex.magFilter=THREE.NearestFilter;
  heatMesh=new THREE.Mesh(new THREE.PlaneGeometry(105,68),new THREE.MeshBasicMaterial({map:heatTex,transparent:true,opacity:.78,depthWrite:false}));heatMesh.rotation.x=-Math.PI/2;heatMesh.position.y=.2;scene.add(heatMesh);
  scanBox=new THREE.Mesh(new THREE.BoxGeometry(1.4,64,190),new THREE.MeshBasicMaterial({color:0x6fe3d2,transparent:true,opacity:.22,blending:THREE.AdditiveBlending,depthWrite:false}));scanBox.position.y=32;scanBox.visible=false;scene.add(scanBox);
  const V=(a,b,c)=>new THREE.Vector3(a,b,c);
  dimLines=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([V(-52.5,.4,37.5),V(52.5,.4,37.5),V(-52.5,.4,35.5),V(-52.5,.4,39.5),V(52.5,.4,35.5),V(52.5,.4,39.5),V(56,.4,-34),V(56,.4,34),V(54,.4,-34),V(58,.4,-34),V(54,.4,34),V(58,.4,34)]),new THREE.LineBasicMaterial({color:0xe2b56a}));
  dimLines.visible=false;scene.add(dimLines);
  new ResizeObserver(resize).observe(host);
}
if(ok3d){try{build();}catch(e){console.error(e);ok3d=false;}}

function drawHeat(full){
  if(!heatCanvas)return;const x=heatCanvas.getContext('2d');x.clearRect(0,0,heatCanvas.width,heatCanvas.height);
  const stops=[[2500,[44,79,143]],[2900,[42,161,152]],[3150,[216,201,90]],[3300,[243,163,59]]];
  const ramp=v=>{v=Math.max(2500,Math.min(3300,v));for(let i=0;i<stops.length-1;i++){const[a,ca]=stops[i],[b,cb]=stops[i+1];if(v<=b){const t=(v-a)/(b-a);return ca.map((c,k)=>Math.round(c+(cb[k]-c)*t));}}return stops[3][1];};
  for(let j=0;j<GX;j++){const cx=-52.5+(j+.5)*5;for(let i=0;i<GZ;i++){const cz=-34+(i+.5)*68/GZ;
    if(!full&&cx<-17.5){x.fillStyle='#2a2a2a';x.fillRect(j*20,i*20,20,20);x.strokeStyle='#6a6a6a';x.lineWidth=2;for(let s=-20;s<20;s+=6){x.beginPath();x.moveTo(j*20+s,i*20+20);x.lineTo(j*20+s+20,i*20);x.stroke();}continue;}
    x.fillStyle=`rgb(${ramp(lux(cx,cz))})`;x.fillRect(j*20,i*20,20,20);}}
  if(!full){x.strokeStyle='#f2a73b';x.lineWidth=4;x.strokeRect(2,2,7*20-2,GZ*20-4);}
  x.strokeStyle='rgba(0,0,0,.25)';x.lineWidth=1;for(let j=1;j<GX;j++){x.beginPath();x.moveTo(j*20,0);x.lineTo(j*20,GZ*20);x.stroke();}for(let i=1;i<GZ;i++){x.beginPath();x.moveTo(0,i*20);x.lineTo(GX*20,i*20);x.stroke();}
  heatTex.needsUpdate=true;
}

/* ---------- pins & labels ---------- */
const pinEls={},labelEls=[];
CHECKS.forEach(c=>{const b=document.createElement('button');b.type='button';b.className='tw-pin pend hide';b.setAttribute('aria-label',`${c.id} ${c.t}`);b.dataset.twsel=c.id;
  b.innerHTML=`<span class="tag">${c.id}<em></em></span><span class="stem"></span><span class="dot"></span>`;pinLayer.appendChild(b);pinEls[c.id]=b;});
[['NORTH STAND',[75,17,0]],['SOUTH STAND',[-75,17,0]],['EAST STAND',[0,17,55]],['WEST · MAIN STAND',[0,17,-55]]].forEach(([t,p])=>{const d=document.createElement('div');d.className='tw-lbl';d.textContent=t;pinLayer.appendChild(d);labelEls.push([d,p]);});
const dimEls=[['105.0 m',[0,.5,41]],['68.0 m',[60,.5,0]]].map(([t,p])=>{const d=document.createElement('div');d.className='tw-dim';d.textContent=t;d.hidden=true;pinLayer.appendChild(d);return[d,p];});

/* ---------- animation ---------- */
const tweens=[];
function tween(ms,fn){return new Promise(res=>{if(RM||ms<=0||!ok3d){fn(1);res();return;}tweens.push({t0:performance.now(),ms,fn,res});});}
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
function fly(v,ms){if(!ok3d)return Promise.resolve();controls.autoRotate=false;const p0=camera.position.clone(),t0=controls.target.clone(),p1=new THREE.Vector3(...v.p),t1=new THREE.Vector3(...v.t);const id={};flight=id;
  return tween(ms||1100,e=>{if(flight!==id)return;const k=ease(e);camera.position.lerpVectors(p0,p1,k);controls.target.lerpVectors(t0,t1,k);});}
function setRev(rev){S.rev=rev;if(!ok3d)return;northUpper.visible=rev==='D';northUpper.scale.y=1;tribC.visible=rev==='C';tribD.visible=rev==='D';chairsEast.scale.set(1,1,1);drawHeat(rev==='D');}
function applyLayers(){q('.tw-heatkey').hidden=!(S.heatOn&&S.layers.heat&&ok3d);q('.tw-heatkey .nd').hidden=S.rev==='D';if(!ok3d)return;
  heatMesh.visible=S.heatOn&&S.layers.heat;chairsBase.visible=S.layers.acc;chairsEast.visible=S.layers.acc&&S.rev==='D';roofMeshes.forEach(m=>m.visible=S.layers.roof);}
const flashUntil={};
function updateHighlights(now){
  Object.values(hlMats).forEach(a=>a.forEach(m=>m.emissive.setRGB(0,0,0)));
  CHECKS.forEach(c=>{if(!c.hl||!hlMats[c.hl])return;const r=S.shown[c.id];let col=null,k=0;
    if(S.running===c.id){col=COL.sel;k=.35+.2*Math.sin(now/120);}
    else if(r&&r.s==='fail'){col=COL.fail;k=.38+.22*Math.sin(now/260);}
    else if(r&&r.s==='evid'){col=COL.evid;k=.3+.12*Math.sin(now/400);}
    else if(r&&r.s==='pass'&&flashUntil[c.id]>now){col=COL.pass;k=.5*(flashUntil[c.id]-now)/1400;}
    else if(S.sel===c.id&&r){col=COL[r.s];k=.25;}
    if(col)hlMats[c.hl].forEach(m=>m.emissive.copy(col).multiplyScalar(k));});
  const show=S.sel==='FOP-01'||S.running==='FOP-01';dimLines.visible=show;dimEls.forEach(([d])=>d.hidden=!show);
}
function placeOverlays(){
  const w=host.clientWidth,h=host.clientHeight;
  const place=(el,p)=>{v3.set(...p).project(camera);el.style.left=((v3.x+1)/2*w)+'px';el.style.top=((1-v3.y)/2*h)+'px';return v3.z<1&&Math.abs(v3.x)<1.1&&Math.abs(v3.y)<1.1;};
  CHECKS.forEach(c=>{const el=pinEls[c.id];const vis=place(el,c.pin);el.classList.toggle('hide',!(vis&&S.layers.pins&&S.pinsOn.has(c.id)));});
  labelEls.forEach(([el,p])=>{el.style.visibility=place(el,p)?'visible':'hidden';});dimEls.forEach(([el,p])=>place(el,p));
}
function refreshPins(){CHECKS.forEach(c=>{const el=pinEls[c.id];const r=S.shown[c.id];el.className='tw-pin '+(r?r.s:'pend')+(S.sel===c.id?' sel':'')+(S.running===c.id?' run':'')+(el.classList.contains('hide')?' hide':'');el.querySelector('em').textContent=r?{pass:'✓',fail:'✕',evid:'?'}[r.s]:'';});}
function resize(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
function loop(now){
  for(let i=tweens.length-1;i>=0;i--){const tw=tweens[i];const e=Math.min(1,(now-tw.t0)/tw.ms);tw.fn(e);if(e>=1){tweens.splice(i,1);tw.res();}}
  if(ok3d&&root.isConnected&&host.clientWidth){controls.update();updateHighlights(now);fixtures.forEach((f,i)=>f.material.color.setHSL(.12,.6,.82+.08*Math.sin(now/600+i)));renderer.render(scene,camera);placeOverlays();}
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* ---------- UI ---------- */
function score(){if(!Object.keys(S.shown).length)return null;let tot=0,ok=0;CHECKS.forEach(c=>{tot+=WEIGHT[c.crit];if(S.shown[c.id]&&S.shown[c.id].s==='pass')ok+=WEIGHT[c.crit];});return Math.round(ok/tot*100);}
function gateState(){
  if(Object.keys(S.shown).length<CHECKS.length)return{cls:'p-mute',t:S.stage>=3?'Assessing':'Not assessed'};
  const blockers=CHECKS.filter(c=>c.crit!=='Medium'&&S.shown[c.id].s!=='pass'),conds=CHECKS.filter(c=>c.crit==='Medium'&&S.shown[c.id].s!=='pass');
  if(blockers.length)return{cls:'p-bad',t:`Blocked · ${blockers.length} blocker${blockers.length>1?'s':''}`};
  if(S.stage>=6)return{cls:conds.length?'p-gold':'p-good',t:conds.length?`Passed · ${conds.length} condition`:'Passed'};
  return{cls:'p-gold',t:'Ready to pass'};
}
function updateHeader(){const s=score();q('[data-m="rev"]').textContent='Rev '+S.rev;q('[data-m="score"]').textContent=s==null?'—':s+'%';const g=gateState(),el=q('[data-m="gate"]');el.className='pill '+g.cls;el.textContent=g.t;if(hooks.onChange)hooks.onChange();}
function caption(html){const c=q('.tw-caption');if(!html){c.hidden=true;return;}c.hidden=false;c.innerHTML=html;}
function renderSteps(){
  const nav=q('.tw-steps');
  nav.innerHTML=STEPS.map((s,i)=>`<button type="button" class="tw-step ${i<S.stage?'done':''} ${i===S.stage?'cur':''}" data-twstep="${i}" ${i===S.stage?'aria-current="step"':''}><i>${i<S.stage?'✓':i+1}</i><span><b>${s.k}</b><small>${s.actor}</small></span></button>`).join('');
  const cur=nav.querySelector('.cur'),wrap=q('.tw-steps-wrap');if(cur&&wrap)wrap.scrollLeft=Math.max(0,cur.offsetLeft-wrap.clientWidth/2+cur.clientWidth/2);
}
const stPill=r=>r?`<span class="tw-st ${r.s}">${{pass:'Pass',fail:'Fail',evid:'Needs evidence'}[r.s]}</span>`:'<span class="tw-st pend">Queued</span>';
function head(title,lede){const s=STEPS[S.stage];return `<div><div class="tw-eyebrow">Step ${S.stage+1} of ${STEPS.length}<span class="tw-actor ${s.cls}">${s.actor}</span></div><h2>${title}</h2><p class="tw-lede">${lede}</p></div>`;}
function checkRow(c,showRes){const r=showRes?S.shown[c.id]:null;const running=S.running===c.id;
  return `<button type="button" class="tw-chk ${r?r.s:'pend'} ${S.sel===c.id?'sel':''}" data-twsel="${c.id}"><span class="id">${c.id}</span><span class="t">${c.t}</span>${showRes?(running?'<span class="tw-st pend">Running</span>':stPill(r)):`<span class="tw-crit ${c.crit}">${c.crit}</span>`}
  ${showRes?(r?`<span class="val">${r.v}</span>`:''):`<span class="rule">${c.rule}</span><span class="meta"><span>${c.fam}</span><span>·</span><span>Gate G1</span><span class="tw-illus">illustrative threshold</span></span>`}</button>`;}
function detailCard(){
  const c=CK[S.sel];if(!c)return '';const r=S.shown[c.id];const item=ITEMS.find(i=>i.chk===c.id);
  return `<div class="tw-card tw-detail"><h3>${c.id} · ${c.t} ${stPill(r)}</h3><dl class="tw-kv">
    <dt>Requirement</dt><dd>${c.req}</dd><dt>Generated rule</dt><dd><code class="mono" style="color:var(--gold)">${c.rule}</code> <span class="tw-illus">illustrative</span></dd>
    <dt>Extracted</dt><dd>${r?r.v:'—'}</dd><dt>Evidence</dt><dd>${c.ev} · Rev ${S.rev}</dd><dt>Criticality</dt><dd>${c.crit} · Gate G1</dd>
    ${item&&r&&r.s!=='pass'?`<dt>Action</dt><dd>${item.id} to ${item.to}</dd>`:''}</dl>${r?`<p class="why">${r.why}</p>`:''}</div>`;
}
function renderPanel(){
  const el=q('.tw-scroll');const keep=el.scrollTop;let h='';const st=S.stage;
  if(st===0){
    h=head('The design team submits its model','The design team uploads a design-freeze package for King Salman International Stadium. The engine logs the files and their revision before anything else happens. The package and everything that follows are simulated.')+
    `<div class="tw-card"><dl class="tw-kv"><dt>Venue</dt><dd>King Salman International Stadium, north Riyadh</dd><dt>Public brief</dt><dd>92,760 seats · opening match and final · opens Q4 2029 (planned)</dd><dt>From</dt><dd>Stadium design team (simulated)</dd><dt>Package</dt><dd>KSIS-DES Rev C · 30 Oct 2026, 09:14 (simulated)</dd><dt>For gate</dt><dd>G1 Design freeze</dd></dl></div>
    <ul class="tw-files"><li><code>KSIS-ARC-Bowl-RevC.ifc</code><span>688 MB</span></li><li><code>KSIS-LGT-Calc-RevC.pdf</code><span>24 MB</span></li><li><code>KSIS-ACC-Schedule-RevC.xlsx</code><span>1.6 MB</span></li></ul>
    <p class="tw-note">Each file is fingerprinted and versioned, so every result later on points back to the exact revision it was checked against.</p>
    <p class="tw-small">The 3D model follows the published concept by Populous: a circular, segmented form like a seed cracking the earth, green walls and a green roof with a walking path, a continuous ring of hospitality boxes between the lower and upper tiers, royal and VIP seating in the west stand, and King Abdulaziz Park around it. It is a simplified massing with approximate proportions, not the architect’s model. Sources: <a href="https://populous.com/article/populous-designed-king-salman-stadium-set-to-become-global-sporting-icon" target="_blank" rel="noopener">Populous</a>, <a href="https://en.wikipedia.org/wiki/King_Salman_International_Stadium" target="_blank" rel="noopener">Wikipedia</a>, <a href="https://saudipedia.com/en/list-of-2034-world-cup-stadiums" target="_blank" rel="noopener">Saudipedia</a>.</p>`;
  }else if(st===1){
    h=head('The engine reads the model','It extracts the facts the requirements care about, and notes where each one came from. Gaps are recorded as gaps, not filled in.')+
    `<div class="tw-facts">${FACTS.map((f,i)=>`<div class="tw-fact tw-rev ${i<S.reveal?'in':''}" data-i="${i}"><b>${f[0]}</b><code class="${f[3]?'miss':''}">${f[1]}</code><small>${f[2]}</small></div>`).join('')}</div>`;
  }else if(st===2){
    h=head('Requirements become checks','Each requirement becomes a testable rule with a threshold, a criticality and the gate it blocks. These are the same atomic obligations the Decompose requirements view produces.')+
    `<p class="tw-note">Thresholds are illustrative, modelled on FIFA stadium requirement families and scaled for an opening-match and final venue. A live deployment loads the authority’s FIFA documents.</p>
    <div class="tw-checks">${CHECKS.map((c,i)=>`<div class="tw-rev ${i<S.reveal?'in':''}" data-i="${i}">${checkRow(c,false)}</div>`).join('')}</div>`;
  }else if(st===3){
    const n={pass:0,fail:0,evid:0};Object.values(S.shown).forEach(r=>n[r.s]++);const pend=CHECKS.length-Object.keys(S.shown).length;
    h=head('Checks run on the model','Each rule runs against the extracted facts. Failures light up in place on the stadium, so the team sees where the problem is, not just that one exists.')+
    `<div class="tw-summary"><div class="pass"><b>${n.pass}</b><small>Pass</small></div><div class="fail"><b>${n.fail}</b><small>Fail</small></div><div class="evid"><b>${n.evid}</b><small>Needs evidence</small></div><div><b>${pend}</b><small>Queued</small></div></div>
    ${detailCard()}<div class="tw-checks">${CHECKS.map(c=>checkRow(c,true)).join('')}</div>${!S.running?'<p class="tw-small">Select a check or a pin on the model to see its evidence.</p>':''}`;
  }else if(st===4){
    h=head('Findings go to the people who fix them','Fails become non-conformances. Missing or unclear evidence becomes a clarification. Each has an owner and a due date set by criticality, and joins the same escalation ladder as the rest of the programme.')+
    `<div class="tw-items">${ITEMS.map(it=>{const c=CK[it.chk];return `<div class="tw-item"><header><span class="tw-kind ${it.kind}">${it.kind==='ncr'?'NON-CONFORMANCE':'CLARIFICATION'}</span><b>${it.id}</b><span class="tw-crit ${c.crit}">${c.crit}</span></header>
      <p><button type="button" class="linkish" data-twsel="${c.id}">${c.id} · ${c.t}</button></p><p class="msg">${it.msg}</p>
      <footer><span>To: ${it.to}</span><span>Due ${due(c.crit)} (${SLA[c.crit]} days)</span><span>${S.sent?'<span class="tw-sent">Sent · SLA clock running</span>':'Draft'}</span></footer></div>`;}).join('')}</div>
    ${S.sent?'<p class="tw-note">Sent to the design team 30 Oct 2026, 09:19. Overdue items escalate automatically: delivery owner, workstream lead, authority executive, ministerial steering.</p>':'<button class="primary" type="button" data-tw="send">Send 5 items to the design team</button>'}
    <p class="tw-small">Due dates use the control tower’s SLA days: Critical 7, High 14, Medium 21.</p>`;
  }else if(st===5){
    const changed=['CAP-01','MED-01','ACC-01','LGT-01'];
    h=head('The firm resubmits, the engine re-checks','Rev D arrives six days later. The engine compares it with Rev C and re-runs only the checks touched by changed elements.')+
    `<div class="tw-card"><dl class="tw-kv"><dt>Package</dt><dd>KSIS-DES Rev D · 5 Nov 2026, 16:40 (simulated)</dd><dt>Responds to</dt><dd>NCR-031, NCR-032, NCR-033, CLR-014</dd></dl></div>
    <div><p class="tw-sec">What changed in the model</p><ul class="tw-diff"><li><i>+13,580</i><span>North upper tier brought into the design</span></li><li><i>+5 m</i><span>Media tribune widened on the halfway line</span></li><li><i>+214</i><span>Wheelchair positions added to the East stand</span></li><li><i>100%</i><span>Full-grid lighting calculation attached</span></li></ul></div>
    <div><p class="tw-sec">Delta re-run · 4 of 9 checks</p><div class="tw-checks">${changed.map(id=>{const c=CK[id];const r=S.shown[id];return `<button type="button" class="tw-chk ${r.s} ${S.sel===id?'sel':''}" data-twsel="${id}"><span class="id">${id}</span><span class="t">${c.t}</span><span class="tw-flip">${stPill(RES.C[id])}<span class="muted">→</span>${S.running===id?'<span class="tw-st pend">Running</span>':stPill(r===RES.C[id]?null:r)}</span><span class="val">${r.v}</span></button>`;}).join('')}</div></div>
    <p class="tw-note">THR-01 is unchanged in Rev D, so CLR-015 stays open with its original due date.</p>${detailCard()}`;
  }else if(st===6){
    const fams={};CHECKS.forEach(c=>{fams[c.fam]=fams[c.fam]||{ok:0,n:0};fams[c.fam].n++;if(S.shown[c.id].s==='pass')fams[c.fam].ok++;});
    h=head('The readiness gate updates itself','G1 Design freeze passes because every Critical and High check is assured with evidence. The open Medium item rides along as a tracked condition.')+
    `<div class="tw-card"><div class="tw-eyebrow" style="margin-bottom:8px">Gate G1 · Design freeze · King Salman International Stadium</div><span class="tw-stamp">PASSED</span>
      <p style="margin:12px 0 0;font-size:13px">Condition: <b class="mono">CLR-015</b> green roof build-up specification, due ${due('Medium')}. If it lapses, it escalates and blocks G2.</p>
      <div class="tw-track"><div class="passed"><b>G1</b>Design freeze</div><div class="next"><b>G2</b>Structure complete</div><div><b>G3</b>Construction complete</div><div><b>G4</b>Test event ready</div><div><b>G5</b>FIFA handover</div></div></div>
    <div><p class="tw-sec">Assured by requirement family</p><div class="tw-bars">${Object.entries(fams).map(([f,v])=>`<div class="tw-barrow"><span>${f}</span><span class="tr"><i style="width:${v.ok/v.n*100}%"></i></span><code>${v.ok}/${v.n}</code></div>`).join('')}</div></div>
    <div><p class="tw-sec">Assurance record</p><ol class="tw-audit">
      <li><time>30 Oct 09:14</time><span>Rev C received from the design team, 3 files fingerprinted</span></li>
      <li><time>30 Oct 09:16</time><span>11 facts extracted, 3 gaps recorded</span></li>
      <li><time>30 Oct 09:17</time><span>9 checks generated for gate G1</span></li>
      <li><time>30 Oct 09:18</time><span>4 pass, 3 fail, 2 need evidence. G1 blocked</span></li>
      <li><time>30 Oct 09:19</time><span>3 non-conformances and 2 clarifications sent with due dates</span></li>
      <li><time>5 Nov 16:40</time><span>Rev D received. 4 checks re-run, all pass</span></li>
      <li><time>5 Nov 16:41</time><span>G1 passed with 1 condition (CLR-015)</span></li></ol></div>
    <p class="tw-note">The gate decision is computed from evidence tied to a model revision. Every line above opens back to the element it was checked against.</p>`;
  }
  el.innerHTML=h;el.scrollTop=keep;
  q('[data-tw="back"]').disabled=st===0;
  q('[data-tw="next"]').textContent=st<STEPS.length-1?`Next: ${STEPS[st+1].k}`:'Start again';
}
function select(id){
  if(S.running||S.stage<2)return;S.sel=id;refreshPins();renderPanel();fly(CK[id].view,1000);
  const c=CK[id],r=S.shown[id];if(S.stage>=3)caption(`<b>${id}</b>${c.t}${r?' · '+r.v:''}`);
}

/* ---------- stage flow ---------- */
function applyBase(i){
  S.sel=null;S.running=null;S.reveal=0;setRev(i>=6?'D':'C');
  S.shown=i>=6?Object.assign({},RES.D):i>=4?Object.assign({},RES.C):{};
  S.heatOn=i>=2;S.pinsOn=new Set(i>=3?CHECKS.map(c=>c.id):[]);
  if(i<4)S.sent=false;else if(i>=5)S.sent=true;
  if(ok3d){PIECES.forEach(p=>{meshes.low[p.k].scale.y=1;meshes.up[p.k].scale.y=1;});scanBox.visible=false;}
  applyLayers();refreshPins();caption(null);
}
const alive=t=>t===tok;
async function goStage(i){const t=++tok;S.stage=i;applyBase(i);renderSteps();renderPanel();updateHeader();try{await enter(i,t);}catch(e){console.error(e);}}
async function enter(i,t){
  if(i===0){
    if(!ok3d)return;
    PIECES.forEach(p=>{meshes.low[p.k].scale.y=.001;meshes.up[p.k].scale.y=.001;});roofMeshes.forEach(m=>m.visible=false);chairsBase.visible=false;tribC.visible=false;northUpper.visible=false;
    caption('<b>Rev C</b>Loading the design model');fly(VIEW0,1200);
    await tween(1500,e=>{PIECES.forEach((p,k)=>{meshes.low[p.k].scale.y=Math.max(.001,ease(Math.min(1,Math.max(0,e*1.6-k*.06))));});});if(!alive(t))return;
    await tween(1300,e=>{PIECES.forEach((p,k)=>{if(p.k!=='N')meshes.up[p.k].scale.y=Math.max(.001,ease(Math.min(1,Math.max(0,e*1.5-k*.05))));});});if(!alive(t))return;
    tribC.visible=true;applyLayers();caption('<b>Rev C</b>Model received. 3 files, 431 MB, fingerprinted');await wait(1400);if(alive(t))caption(null);return;
  }
  if(i===1){
    S.heatOn=false;applyLayers();caption('<b>Engine</b>Extracting facts from the model and attached files');
    if(ok3d){scanBox.visible=true;fly({p:[0,150,270],t:[0,8,0]},1000);}
    const n=FACTS.length;const sw=ok3d?tween(n*330+300,e=>{scanBox.position.x=-150+300*e;}):Promise.resolve();
    for(let k=0;k<n;k++){await wait(330);if(!alive(t))return;S.reveal=k+1;const el=q(`.tw-fact[data-i="${k}"]`);if(el)el.classList.add('in');if(k===7){S.heatOn=true;applyLayers();}}
    await sw;if(!alive(t))return;if(ok3d)scanBox.visible=false;caption('<b>Engine</b>11 facts extracted, 3 gaps recorded');await wait(1500);if(alive(t))caption(null);return;
  }
  if(i===2){
    caption('<b>Engine</b>Generating checks from stadium requirements');
    for(let k=0;k<CHECKS.length;k++){await wait(380);if(!alive(t))return;S.reveal=k+1;const el=q(`.tw-checks .tw-rev[data-i="${k}"]`);if(el)el.classList.add('in');S.pinsOn.add(CHECKS[k].id);refreshPins();}
    caption('<b>Engine</b>9 checks generated, each tied to gate G1');await wait(1400);if(alive(t))caption(null);return;
  }
  if(i===3){
    for(const c of CHECKS){
      if(!alive(t))return;S.running=c.id;refreshPins();renderPanel();caption(`<b>${c.id}</b>Running ${c.t.toLowerCase()}`);
      await fly(c.view,850);if(!alive(t))return;await wait(350);if(!alive(t))return;
      const r=S.shown[c.id]=RES.C[c.id];if(r.s==='pass')flashUntil[c.id]=performance.now()+1400;S.running=null;refreshPins();renderPanel();updateHeader();
      caption(`<b>${c.id}</b>${r.v} · ${{pass:'Pass',fail:'Fail',evid:'Needs evidence'}[r.s]}`);await wait(r.s==='pass'?500:1100);
    }
    if(!alive(t))return;S.sel='CAP-01';refreshPins();renderPanel();emit('run','King Salman International Stadium design Rev C checked: 3 fails, 2 clarifications, G1 Design freeze blocked');
    caption('<b>Result</b>4 pass · 3 fail · 2 need evidence. G1 is blocked');await fly(VIEW0,1300);return;
  }
  if(i===4){fly({p:[190,130,-230],t:[0,8,0]},1300);if(S.auto){await wait(2600);if(!alive(t))return;send();}return;}
  if(i===5){
    caption('<b>Rev D</b>Resubmission received. Comparing with Rev C');await fly({p:[-30,40,20],t:[75,20,0]},1100);if(!alive(t))return;
    S.rev='D';
    const steps=[['CAP-01',()=>{northUpper.visible=true;northUpper.scale.y=.001;return tween(1500,e=>northUpper.scale.y=Math.max(.001,ease(e)));}],['MED-01',()=>{tribC.visible=false;tribD.visible=true;}],['ACC-01',()=>{chairsEast.visible=S.layers.acc;chairsEast.scale.setScalar(.001);return tween(700,e=>chairsEast.scale.setScalar(Math.max(.001,ease(e))));}],['LGT-01',()=>{drawHeat(true);applyLayers();}]];
    for(const [id,act] of steps){
      if(!alive(t))return;const c=CK[id];S.running=id;refreshPins();renderPanel();updateHeader();caption(`<b>${id}</b>Re-running ${c.t.toLowerCase()}`);
      if(id!=='CAP-01')await fly(c.view,950);if(!alive(t))return;if(ok3d)await act();await wait(600);if(!alive(t))return;
      S.shown[id]=RES.D[id];flashUntil[id]=performance.now()+1400;S.running=null;refreshPins();renderPanel();updateHeader();caption(`<b>${id}</b>${c.t} · ${RES.D[id].v} · Pass`);await wait(850);
    }
    if(!alive(t))return;emit('resub','King Salman International Stadium design Rev D re-checked: 4 checks re-run, all pass');
    caption('<b>Result</b>All Critical and High checks now pass. One Medium clarification remains open');await fly(VIEW0,1300);return;
  }
  if(i===6){emit('gate','King Salman International Stadium design passed G1 Design freeze with 1 condition (CLR-015)');fly({p:[-230,185,-230],t:[0,8,0]},1600);
    if(ok3d&&!RM)setTimeout(()=>{if(alive(t)&&!S.auto)controls.autoRotate=true;},1700);return;}
}
function send(){if(S.sent)return;S.sent=true;emit('send','5 design findings sent to the King Salman International Stadium design team');renderPanel();}
function stopAuto(){S.auto=false;playTok++;q('[data-tw="play"]').textContent='Play intake demo';}
async function play(list,fromTour){
  const my=++playTok;S.auto=true;if(!fromTour)q('[data-tw="play"]').textContent='Pause intake demo';
  for(let n=0;n<list.length;n++){if(my!==playTok)return;await goStage(list[n]);if(my!==playTok)return;if(n<list.length-1)await wait(fromTour?700:[2400,2800,2800,3000,3800,3400,0][list[n]]);}
  if(my===playTok&&!fromTour)stopAuto();
}

/* ---------- events (scoped to the twin) ---------- */
root.addEventListener('click',ev=>{
  const b=ev.target.closest('button');if(!b||!root.contains(b))return;
  if(b.dataset.twsel){select(b.dataset.twsel);return;}
  if(b.dataset.twstep!==undefined){stopAuto();goStage(+b.dataset.twstep);return;}
  if(b.dataset.l){const k=b.dataset.l;S.layers[k]=!S.layers[k];b.setAttribute('aria-pressed',S.layers[k]);applyLayers();return;}
  const a=b.dataset.tw;
  if(a==='next'){stopAuto();goStage(S.stage<STEPS.length-1?S.stage+1:0);}
  else if(a==='back'){stopAuto();if(S.stage>0)goStage(S.stage-1);}
  else if(a==='recenter')fly(VIEW0,1000);
  else if(a==='send')send();
  else if(a==='play'){if(S.auto)stopAuto();else{const all=[0,1,2,3,4,5,6];play(S.stage>=6?all:all.slice(S.stage));}}
});

applyBase(0);renderSteps();renderPanel();updateHeader();
return {
  root,
  mount(container){container.appendChild(root);if(ok3d)resize();if(!introDone){introDone=true;goStage(0);}},
  play(list){introDone=true;return play(list,true);},
  stop(){stopAuto();},
  reset(){stopAuto();tok++;logged.clear();S.stage=0;applyBase(0);renderSteps();renderPanel();updateHeader();introDone=false;},
  hooks(h){Object.assign(hooks,h);},
  summary(){const g=gateState();const open=Object.values(S.shown).filter(r=>r.s!=='pass').length;return{rev:S.rev,step:S.stage,stepName:STEPS[S.stage].k,gate:g,score:score(),open,checked:Object.keys(S.shown).length};}
};
})();

