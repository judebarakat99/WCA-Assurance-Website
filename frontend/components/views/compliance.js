// ---------- Compliance: programme -> authority/family -> venue -> requirements ----------
import { VENUES, esc, pct } from "../../lib/data";
import { ui } from "../../lib/state";
import {
  COMPLIANCE_AUTHORITIES,
  COMPLIANCE_GROUPS,
  COMPLIANCE_REQUIREMENTS,
  complianceRecords,
  complianceProven,
} from "../../lib/complianceData";
import { headV } from "./shared";

const records = () => complianceRecords(VENUES);
const rate = (L) =>
  L.length
    ? Math.round(
        (L.filter((x) => complianceProven(x.status)).length / L.length) * 100,
      )
    : 0;
const tone = (n) => (n >= 85 ? "good" : n >= 65 ? "warn" : "bad");
const pill = (s) =>
  s === "Verified"
    ? "p-good"
    : s === "Validated"
      ? "p-info"
      : s === "Rejected"
        ? "p-bad"
        : s === "Submitted"
          ? "p-warn"
          : "p-mute";
const A = (id) => COMPLIANCE_AUTHORITIES.find((x) => x.id === id);
const familyGroup = (f) =>
  COMPLIANCE_GROUPS.find((g) => g.families.includes(f));

function authorityCards(all) {
  return `<div class="comp-authorities">${COMPLIANCE_AUTHORITIES.map((a) => {
    const L = all.filter((x) => x.authority === a.id),
      r = rate(L),
      proven = L.filter((x) => complianceProven(x.status)).length;
    return `<button class="comp-authority ${ui.compliance.authority === a.id ? "sel" : ""}" data-comp-authority="${a.id}"><span>${esc(a.name)}</span><b>${r}%</b><small>${proven}/${L.length} controls proven</small><i class="comp-meter"><em class="${tone(r)}" style="width:${r}%"></em></i><p>${esc(a.full)}</p></button>`;
  }).join("")}</div>`;
}

function familySection(all) {
  return COMPLIANCE_GROUPS.map(
    (g) =>
      `<section class="comp-group"><div class="comp-group-head"><span>${esc(g.name)}</span><small>${g.families.length} families</small></div><div class="comp-families">${g.families
        .map((f) => {
          const L = all.filter(
              (x) =>
                x.family === f &&
                (ui.compliance.authority === "all" ||
                  x.authority === ui.compliance.authority),
            ),
            r = rate(L);
          const byA = COMPLIANCE_AUTHORITIES.map((a) => {
            const X = all.filter((x) => x.family === f && x.authority === a.id);
            const ar = rate(X);
            return `<span title="${esc(a.full)}"><b>${esc(a.name)}</b><i><em class="${tone(ar)}" style="width:${ar}%"></em></i><strong>${ar}%</strong></span>`;
          }).join("");
          return `<button class="comp-family" data-comp-family="${esc(f)}"><div><h3>${esc(f)}</h3><p>${L.filter((x) => complianceProven(x.status)).length}/${L.length} controls proven across programme</p></div><div class="comp-family-rate ${tone(r)}">${r}%</div><div class="comp-auth-bars">${byA}</div><span class="comp-arrow">View venues →</span></button>`;
        })
        .join("")}</div></section>`,
  ).join("");
}

function venueMatrix(all) {
  return `<section class="comp-block"><div class="comp-block-head"><div><span class="eyebrow">Venue compliance</span><h3>All venues across all authorities</h3><p>Click a venue to drill into every family and individual requirement.</p></div></div><div class="comp-venue-grid">${VENUES.map(
    (v) => {
      const L = all.filter((x) => x.venue === v.id),
        r = rate(L);
      const cells = COMPLIANCE_AUTHORITIES.map((a) => {
        const ar = rate(L.filter((x) => x.authority === a.id));
        return `<span><small>${a.name}</small><b class="${tone(ar)}">${ar}%</b></span>`;
      }).join("");
      return `<button class="comp-venue" data-comp-venue="${v.id}"><div class="comp-venue-top"><div><b>${esc(v.name)}</b><small>${esc(v.city)} · ${esc(v.type)}</small></div><strong class="${tone(r)}">${r}%</strong></div><div class="comp-venue-auth">${cells}</div><i class="comp-meter"><em class="${tone(r)}" style="width:${r}%"></em></i></button>`;
    },
  ).join("")}</div></section>`;
}

function familyDrill(all, family) {
  const g = familyGroup(family);
  return `<div class="comp-drill-head"><button class="linkish" data-comp-back>← Programme compliance</button><span>${esc(g?.name || "")}</span><h2>${esc(family)}</h2><p>Compliance by authority across all seven venues.</p></div>
 <div class="comp-family-authorities">${COMPLIANCE_AUTHORITIES.map((a) => {
   const L = all.filter((x) => x.family === family && x.authority === a.id),
     r = rate(L);
   return `<div class="comp-fa"><span>${a.name}</span><b class="${tone(r)}">${r}%</b><small>${esc(a.full)}</small></div>`;
 }).join("")}</div>
 <div class="tablewrap comp-table"><table><thead><tr><th>Venue</th>${COMPLIANCE_AUTHORITIES.map((a) => `<th>${a.name}</th>`).join("")}<th>Overall</th></tr></thead><tbody>${VENUES.map(
   (v) => {
     const L = all.filter((x) => x.family === family && x.venue === v.id),
       r = rate(L);
     return `<tr><td><button class="linkish" data-comp-venue="${v.id}">${esc(v.name)}</button><div class="muted">${esc(v.city)}</div></td>${COMPLIANCE_AUTHORITIES.map(
       (a) => {
         const x = L.find((z) => z.authority === a.id);
         return `<td><span class="pill ${pill(x.status)}">${x.status}</span></td>`;
       },
     ).join("")}<td><b class="comp-pct ${tone(r)}">${r}%</b></td></tr>`;
   },
 ).join("")}</tbody></table></div>`;
}

function venueDrill(all, id) {
  const v = VENUES.find((x) => x.id === id),
    L = all.filter((x) => x.venue === id),
    overall = rate(L);
  const auth = COMPLIANCE_AUTHORITIES.map((a) => {
    const X = L.filter((x) => x.authority === a.id),
      r = rate(X);
    return `<div class="comp-fa"><span>${a.name}</span><b class="${tone(r)}">${r}%</b><small>${X.filter((x) => complianceProven(x.status)).length}/${X.length} proven</small></div>`;
  }).join("");
  const groups = COMPLIANCE_GROUPS.map(
    (g, gi) =>
      `<details class="comp-detail" ${gi === 0 ? "open" : ""}><summary><div><span>${esc(g.name)}</span><small>${g.families.length} families</small></div><b>${rate(L.filter((x) => g.families.includes(x.family)))}%</b></summary><div class="comp-detail-body">${g.families
        .map(
          (f) =>
            `<section><h3>${esc(f)}</h3><div class="tablewrap"><table><thead><tr><th>Authority</th><th>Ref</th><th>Requirement</th><th>Source / basis</th><th>Status</th></tr></thead><tbody>${COMPLIANCE_AUTHORITIES.map(
              (a) => {
                const x = L.find((z) => z.family === f && z.authority === a.id);
                return `<tr><td><b>${a.name}</b></td><td class="mono">${esc(x.code)}</td><td>${esc(x.text)}</td><td class="muted">${esc(a.id === "CITY" ? x.source + " · " + v.city : x.source)}</td><td><span class="pill ${pill(x.status)}">${x.status}</span></td></tr>`;
              },
            ).join("")}</tbody></table></div></section>`,
        )
        .join("")}</div></details>`,
  ).join("");
  return `<div class="comp-drill-head"><button class="linkish" data-comp-back>← All venues</button><span>${esc(v.city)} · ${esc(v.type)}</span><h2>${esc(v.name)}</h2><p><b>${overall}%</b> combined sample compliance across KSA, City, WCA and FIFA controls.</p></div><div class="comp-family-authorities">${auth}</div>${groups}`;
}

export function viewCompliance() {
  const all = records();
  if (ui.compliance.venue) return venueDrill(all, ui.compliance.venue);
  if (ui.compliance.family) return familyDrill(all, ui.compliance.family);
  const overall = rate(all),
    proven = all.filter((x) => complianceProven(x.status)).length;
  return (
    headV(
      `Compliance · ${VENUES.length} venues · ${COMPLIANCE_AUTHORITIES.length} authorities`,
      "Programme compliance",
      "Start at programme level, compare compliance across the four authorities and requirement families, then drill into a family or venue. KSA examples are regulatory samples; WCA and City controls are illustrative PoC data and must be replaced by authoritative requirement libraries.",
    ) +
    `<div class="comp-actions"><div class="comp-overall"><span>Combined compliance</span><b>${overall}%</b><small>${proven}/${all.length} venue-controls proven</small></div><div class="spacer"></div><button class="primary" data-compliance-intake="evidence">+ Add new evidence</button><button data-compliance-intake="requirement">+ Add new requirement</button></div>` +
    authorityCards(all) +
    venueMatrix(all) +
    `<section class="comp-block"><div class="comp-block-head"><div><span class="eyebrow">Requirement families</span><h3>Compliance by authority and family</h3><p>Four executive groups, eleven FIFA-aligned families and four authority lenses.</p></div></div>${familySection(all)}</section>`
  );
}
