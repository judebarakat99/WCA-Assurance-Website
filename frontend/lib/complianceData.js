// Sample multi-authority compliance library for the Compliance PoC.
// FIFA structure is FIFA-aligned. KSA examples reference Saudi Building Code / municipal themes.
// WCA and City requirements are explicitly illustrative until authoritative libraries are loaded.
export const COMPLIANCE_AUTHORITIES=[
  {id:"KSA",name:"KSA",full:"Saudi Arabia laws & codes",note:"Sample statutory requirements based on Saudi Building Code and national regulatory themes."},
  {id:"CITY",name:"City",full:"Municipal & city requirements",note:"Illustrative city overlays based on published Saudi municipal sports-facility requirement themes."},
  {id:"WCA",name:"WCA",full:"World Cup Authority requirements",note:"Illustrative programme requirements for the proof of concept; not an asserted official WCA rulebook."},
  {id:"FIFA",name:"FIFA",full:"FIFA tournament requirements",note:"FIFA-aligned sample requirements; validate against tournament-specific FIFA requirements."},
];

export const COMPLIANCE_GROUPS=[
  {id:"experience",name:"Stadium & Spectator Experience",families:[
    "Spectator Facilities & Capacity","Pitch & Field of Play","Accessibility & Inclusive Design"]},
  {id:"operations",name:"Tournament Operations",families:[
    "Players, Teams & Match Officials","Media & Broadcast","Hospitality & VIP","Operations, Offices & Back of House"]},
  {id:"safety",name:"Safety & Infrastructure",families:[
    "Safety, Security & Medical","Technical Systems & Utilities","IT, Telecommunications & Technology"]},
  {id:"sustainability",name:"Sustainability",families:["Sustainability & Environmental Performance"]},
];

const F=COMPLIANCE_GROUPS.flatMap(g=>g.families);
const req=(authority,family,code,text,source)=>({authority,family,code,text,source});
export const COMPLIANCE_REQUIREMENTS=[
// KSA: sample regulatory controls anchored to Saudi Building Code / national requirements.
req("KSA",F[0],"KSA-SFC-01","Occupancy, spectator circulation and safe exit provisions meet the applicable Saudi building requirements.","SBC 201 / applicable Saudi codes"),
req("KSA",F[1],"KSA-PIT-01","Playing-area structures, surfaces and associated construction comply with applicable Saudi construction and safety requirements.","Saudi Building Code system"),
req("KSA",F[2],"KSA-ACC-01","Accessible routes, seating, sanitary facilities and means of egress are provided for people with disabilities.","SBC 201 accessibility provisions"),
req("KSA",F[3],"KSA-PLY-01","Player, official and staff areas comply with applicable occupancy, health, sanitary and life-safety requirements.","SBC 201 / SBC 701 / SBC 801"),
req("KSA",F[4],"KSA-MED-01","Media and broadcast work areas comply with applicable building, electrical and fire-safety requirements.","SBC 201 / SBC 401 / SBC 801"),
req("KSA",F[5],"KSA-HOS-01","Hospitality areas comply with occupancy, accessibility, sanitary and fire-protection requirements.","SBC 201 / SBC 701 / SBC 801"),
req("KSA",F[6],"KSA-OPS-01","Operational and back-of-house spaces comply with applicable occupancy, workplace and building-service requirements.","Saudi Building Code system"),
req("KSA",F[7],"KSA-SAF-01","Fire and life-safety systems, evacuation provisions and emergency access comply with Saudi fire-protection requirements.","SBC 801 / SBC 201"),
req("KSA",F[8],"KSA-TEC-01","Electrical, mechanical and plumbing systems comply with applicable Saudi technical codes.","SBC 401 / SBC 501 / SBC 701"),
req("KSA",F[9],"KSA-ITT-01","ICT rooms, cabling infrastructure and associated power installations comply with applicable Saudi electrical/building requirements.","SBC 401 / SBC 201"),
req("KSA",F[10],"KSA-SUS-01","Energy conservation and green-building measures demonstrate compliance with applicable Saudi requirements.","SBC 601 / SBC 1001"),
// CITY: illustrative local overlays based on Saudi municipal sports-facility themes.
req("CITY",F[0],"CITY-SFC-01","Venue licensing, site access, parking and spectator interface satisfy the host city's applicable municipal approvals.","Illustrative municipal requirement"),
req("CITY",F[1],"CITY-PIT-01","Field-of-play servicing, access and surrounding external works satisfy city-approved site and public-realm conditions.","Illustrative city overlay"),
req("CITY",F[2],"CITY-ACC-01","Accessible parking, sidewalks, entrances and public-realm connections satisfy host-city accessibility conditions.","Illustrative city overlay"),
req("CITY",F[3],"CITY-PLY-01","Team and official arrival/departure routes are coordinated with city traffic and event operations plans.","Illustrative city overlay"),
req("CITY",F[4],"CITY-MED-01","Broadcast compounds and media logistics areas have city-approved access, servicing and temporary-use arrangements.","Illustrative city overlay"),
req("CITY",F[5],"CITY-HOS-01","Hospitality operations and temporary event uses hold required local permits and food-service interfaces.","Illustrative city overlay"),
req("CITY",F[6],"CITY-OPS-01","Signage, cleaning, waste, maintenance and operating arrangements meet applicable municipal conditions.","Illustrative municipal requirement"),
req("CITY",F[7],"CITY-SAF-01","Local emergency access, CCTV interfaces and event traffic controls are coordinated with city and emergency services.","Illustrative city overlay"),
req("CITY",F[8],"CITY-TEC-01","Utility connections and public-infrastructure interfaces have required city/NOC approvals.","Illustrative city overlay"),
req("CITY",F[9],"CITY-ITT-01","Telecom wayleaves and municipal infrastructure interfaces required for venue connectivity are approved.","Illustrative city overlay"),
req("CITY",F[10],"CITY-SUS-01","Waste, water, landscaping and environmental operating conditions meet applicable host-city requirements.","Illustrative city overlay"),
// WCA: illustrative programme assurance controls.
req("WCA",F[0],"WCA-SFC-01","Venue capacity and spectator-experience commitments are baselined, owned and evidence-backed before readiness approval.","Illustrative WCA programme requirement"),
req("WCA",F[1],"WCA-PIT-01","Field-of-play readiness is independently assured before the relevant programme gate.","Illustrative WCA programme requirement"),
req("WCA",F[2],"WCA-ACC-01","Accessibility commitments are tracked to evidence, corrective action and executive closure.","Illustrative WCA programme requirement"),
req("WCA",F[3],"WCA-PLY-01","Team and match-official facilities have accountable owners and completed readiness evidence.","Illustrative WCA programme requirement"),
req("WCA",F[4],"WCA-MED-01","Media and broadcast readiness is integrated into the venue assurance plan and tested before handover.","Illustrative WCA programme requirement"),
req("WCA",F[5],"WCA-HOS-01","Hospitality readiness dependencies and unresolved gaps are reported through the programme assurance process.","Illustrative WCA programme requirement"),
req("WCA",F[6],"WCA-OPS-01","Operational readiness plans, owners, dependencies and evidence are complete before venue handover.","Illustrative WCA programme requirement"),
req("WCA",F[7],"WCA-SAF-01","Critical safety, security and medical gaps cannot pass a programme readiness gate without verified closure.","Illustrative WCA programme requirement"),
req("WCA",F[8],"WCA-TEC-01","Critical venue systems have integrated testing, commissioning evidence and accountable owners.","Illustrative WCA programme requirement"),
req("WCA",F[9],"WCA-ITT-01","Technology dependencies, resilience tests and integration evidence are complete before operational readiness.","Illustrative WCA programme requirement"),
req("WCA",F[10],"WCA-SUS-01","Sustainability commitments are translated into measurable controls and tracked through programme assurance.","Illustrative WCA programme requirement"),
// FIFA-aligned samples.
req("FIFA",F[0],"FIFA-SFC-01","Spectator capacity, seating/standing areas and circulation satisfy the applicable tournament stadium requirements.","FIFA-aligned sample"),
req("FIFA",F[1],"FIFA-PIT-01","Pitch dimensions, surface and surrounding field-of-play areas satisfy applicable FIFA requirements.","FIFA-aligned sample"),
req("FIFA",F[2],"FIFA-ACC-01","Accessible routes, viewing positions, toilets, parking and services satisfy applicable FIFA accessibility requirements.","FIFA-aligned sample"),
req("FIFA",F[3],"FIFA-PLY-01","Players' and match officials' dressing, medical, doping-control and supporting spaces satisfy applicable FIFA requirements.","FIFA-aligned sample"),
req("FIFA",F[4],"FIFA-MED-01","Media tribune, broadcast areas, camera positions and related facilities satisfy applicable FIFA requirements.","FIFA-aligned sample"),
req("FIFA",F[5],"FIFA-HOS-01","Hospitality, VIP and premium-guest facilities satisfy applicable tournament requirements.","FIFA-aligned sample"),
req("FIFA",F[6],"FIFA-OPS-01","Offices, workforce and back-of-house spaces satisfy applicable FIFA operational requirements.","FIFA-aligned sample"),
req("FIFA",F[7],"FIFA-SAF-01","Safety, security, emergency and medical infrastructure satisfy applicable FIFA tournament requirements.","FIFA-aligned sample"),
req("FIFA",F[8],"FIFA-TEC-01","MEP, power, water and floodlighting systems satisfy applicable FIFA technical requirements.","FIFA-aligned sample"),
req("FIFA",F[9],"FIFA-ITT-01","IT, connectivity, telecommunications and technology spaces satisfy applicable FIFA requirements.","FIFA-aligned sample"),
req("FIFA",F[10],"FIFA-SUS-01","Venue sustainability and environmental measures satisfy applicable FIFA tournament commitments and requirements.","FIFA-aligned sample"),
];

const STATUS=["Verified","Validated","Submitted","Assigned","Rejected"];
export function complianceStatus(venueId,authority,family){
  const s=[...String(venueId+authority+family)].reduce((a,c)=>a+c.charCodeAt(0),0);
  const r=s%20;
  return r<10?"Verified":r<14?"Validated":r<17?"Submitted":r<19?"Assigned":"Rejected";
}
export const complianceProven=s=>s==="Verified"||s==="Validated";
export function complianceRecords(venues){
  return venues.flatMap(v=>COMPLIANCE_REQUIREMENTS.map(r=>({...r,venue:v.id,city:v.city,status:complianceStatus(v.id,r.authority,r.family)})));
}
