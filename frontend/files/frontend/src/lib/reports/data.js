// The report data: everything a report needs, read once from the same modules every page uses, so a report
// always agrees with the overview, the stadium pages, the review queue and Nabd.
import { FACILITY_REGISTER, MATCH_LABEL, STATUS_LABEL } from "@/lib/domain/facilities.mjs";
import { EXPOSURE, nextGate, schedulePosition, stadiumExposure } from "@/lib/domain/exposure.mjs";
import { dueDate, formatDue, mitigationAction, ownerFor } from "@/lib/domain/mitigation.mjs";
import { FAMILIES, REGISTER_DATE } from "@/lib/register/data.mjs";
import { allAlerts } from "@/lib/store/alerts";
import { getAssessments } from "@/lib/store/assessments";
import { criterionText, plain, shortDate, statusKey, STATUS_WORD } from "@/lib/reports/text.mjs";

/**
 * { now, registerDate, cities, families, stadiums, owners, alerts, documents, exposure, schedule }.
 * Each stadium carries its in-scope requirements as rows (status, recorded value, owner, exposure class,
 * next step and due date); counts and findings in a report are built from those rows.
 * documents: the filed intake documents to list in a stadium report (pass filedDocuments()).
 */
export function loadReportData({ now = new Date(), documents = [] } = {}) {
  const records = getAssessments();
  const cities = FACILITY_REGISTER.hostCities.map((c) => ({ id: c.id, name: c.name }));
  const cityName = (id) => cities.find((c) => c.id === id)?.name || "";

  const stadiums = FACILITY_REGISTER.stadiums.map((stadium) => {
    const { counts, findings } = stadiumExposure(stadium, records);
    const rows = findings.map((f) => {
      const req = f.row.requirement;
      const latest = f.record?.evidence?.at(-1);
      const unit = req.criterion.operator !== "manual" ? req.criterion.unit : "";
      const key = statusKey(f.record);
      return {
        id: req.id,
        title: req.title,
        familyId: req.familyId,
        family: req.category,
        section: req.section,
        required: criterionText(req.criterion),
        hasThreshold: req.criterion.operator !== "manual",
        statusKey: key,
        status: STATUS_WORD[key],
        value: latest && latest.value !== "" && latest.value != null ? `${latest.value}${unit ? ` ${unit}` : ""}` : "",
        evidenceDate: latest?.on ? shortDate(latest.on) : "",
        evidenceFile: latest?.file || "",
        owner: ownerFor(stadium.id, req),
        level: f.level,
        levelLabel: EXPOSURE[f.level].label,
        levelTone: EXPOSURE[f.level].tone,
        reason: plain(f.reason),
        action: plain(mitigationAction(f)),
        due: f.level === "controlled" ? "" : formatDue(dueDate(f.level, now)),
        dueOrder: f.level === "critical" ? 0 : f.level === "material" ? 1 : 2,
      };
    });
    return {
      id: stadium.id,
      name: stadium.name,
      cityId: stadium.cityId,
      city: cityName(stadium.cityId),
      completionYear: stadium.completionYear,
      statusLabel: STATUS_LABEL[stadium.status] || stadium.status,
      matchLabel: MATCH_LABEL[stadium.highestMatch] || stadium.highestMatch,
      grossCapacity: stadium.grossCapacity,
      counts,
      schedule: schedulePosition(counts),
      gate: nextGate(stadium),
      rows,
    };
  });

  const alerts = allAlerts(records).map((a) => ({
    id: a.id,
    status: a.status,
    severity: a.severity,
    stadiumId: a.stadium_id,
    stadium: stadiums.find((s) => s.id === a.stadium_id)?.name || a.stadium_id,
    requirementId: a.requirement_id,
    requirement: a.requirement_id
      ? `${a.requirement_id} ${stadiums.flatMap((s) => s.rows).find((r) => r.id === a.requirement_id)?.title || ""}`.trim()
      : "Document",
    title: plain(a.title),
    detail: plain(a.detail),
    action: plain(a.action),
    owner: a.owner,
    due: shortDate(a.due),
    dueIso: a.due,
    source: a.source?.type === "register" ? "Register scan" : a.source?.name || "Register scan",
    fromDocument: a.source?.type === "document",
  }));

  const filed = documents.map((d) => ({
    name: d.name,
    kind: d.kind,
    stadiumId: d.stadium_id,
    revision: d.revision || "",
    asOf: d.as_of ? shortDate(d.as_of) : "",
    registered: d.registered || [],
    superseded: !!d.superseded,
  }));

  const owners = [...new Set(stadiums.flatMap((s) => s.rows.map((r) => r.owner)))].sort();
  const families = FAMILIES.filter((f) => f.forStadiums).map((f) => ({
    id: f.id,
    name: f.name,
    label: `${f.id} ${f.name}`,
    description: f.description,
    owner: f.defaultOwner,
    page: f.chapterPage,
  }));

  return {
    now,
    registerDate: shortDate(REGISTER_DATE),
    cities,
    families,
    stadiums,
    owners,
    alerts,
    documents: filed,
    exposure: EXPOSURE,
    schedule: schedulePosition,
  };
}
