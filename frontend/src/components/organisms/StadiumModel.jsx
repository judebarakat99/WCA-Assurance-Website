"use client";

import { useEffect, useMemo, useState } from "react";
import StatusPill from "@/components/atoms/StatusPill";
import StadiumTwin from "@/components/organisms/StadiumTwin";
import TwinScripts from "@/components/providers/TwinScripts";
import { STATUS } from "@/lib/domain/assessment.mjs";
import { CHAPTERS } from "@/lib/domain/fifa-catalogue.mjs";
import {
  AREAS_VIEW,
  CHAPTER_COLOR,
  DESIGN_VIEW,
  EXPOSURE,
  areaExposure,
  areaView,
} from "@/lib/domain/stadiumAreas.mjs";

/** Stadium with the 3D model (King Salman International: the opening match and final venue). */
export const MODEL_STADIUM = "king-salman-international";

const twin = () => (typeof window !== "undefined" ? window.WNSTwin : null);

function ChapterLegend({ shown, setShown }) {
  const [open, setOpen] = useState(true);
  const toggle = (id) =>
    setShown((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <div className="sm-ov sm-chapters" aria-label="FIFA chapters">
      <button type="button" className="sm-collapse" aria-expanded={open} onClick={() => setOpen(!open)}>
        <b>FIFA chapters</b> <span aria-hidden="true">{open ? "▾" : "▸"}</span>
      </button>
      {open &&
        CHAPTERS.map((c) => (
          <label key={c.id}>
            <input type="checkbox" checked={shown.includes(c.id)} onChange={() => toggle(c.id)} />
            <i style={{ background: CHAPTER_COLOR[c.id] }} />
            <span>
              {c.id} {c.short}
            </span>
          </label>
        ))}
      {open && (
        <div className="sm-chapter-btns">
          <button type="button" onClick={() => setShown(CHAPTERS.map((c) => c.id))}>
            All
          </button>
          <button type="button" onClick={() => setShown([])}>
            None
          </button>
        </div>
      )}
    </div>
  );
}

function ExposureLegend() {
  return (
    <div className="sm-ov sm-exposure" aria-label="Mitigation exposure">
      <b>Mitigation exposure</b>
      {Object.entries(EXPOSURE).map(([k, e]) => (
        <span key={k}>
          <i className={e.tone} /> {e.label}
        </span>
      ))}
      <small>Outline colour is the FIFA chapter</small>
    </div>
  );
}

function AreasPanel({ data, shown, selected, onSelect }) {
  const visible = data.areas.filter((a) => shown.includes(a.chapter));
  return (
    <aside className="sm-panel" aria-labelledby="sm-panel-title">
      <span className="sm-eyebrow">
        Critical areas <StatusPill tone="gold">Register</StatusPill>
      </span>
      <h3 id="sm-panel-title">Where the exposure is</h3>
      <p className="muted small">
        Each area of the model carries the FIFA register checks that belong to
        it. Its colour is the worst exposure among them, read from this
        stadium&apos;s assessments, so it matches the requirements below, the
        map and the reports. Its outline is the colour of its chapter.
      </p>
      <div className="sm-counts">
        {["critical", "material", "manageable", "controlled"].map((k) => (
          <div key={k} className={`sm-count ${EXPOSURE[k].tone}`}>
            <b>{data.counts[k]}</b>
            <span>{EXPOSURE[k].label}</span>
          </div>
        ))}
      </div>
      <p className="muted fine">
        {visible.length} of {data.areas.length} areas shown · {data.open} open
        finding{data.open === 1 ? "" : "s"}
        {data.counts.none ? ` · ${data.counts.none} not assessed yet` : ""}
      </p>
      <ul className="sm-list">
        {visible.map((a) => {
          const open = a.id === selected;
          return (
            <li
              key={a.id}
              style={{ "--chapter": a.color }}
              className={open ? "sel" : undefined}
            >
              <button
                type="button"
                aria-expanded={open}
                onClick={() => onSelect(open ? null : a.id)}
              >
                <i className={`sm-dot ${EXPOSURE[a.exposure].tone}`} />
                <span>
                  <b>{a.label}</b>
                  <small>
                    {a.chapter} {a.chapterInfo.short} ·{" "}
                    {a.open
                      ? `${a.open} open`
                      : `${a.assessed} of ${a.checks.length} assessed`}
                  </small>
                </span>
                <StatusPill tone={EXPOSURE[a.exposure].tone}>
                  {EXPOSURE[a.exposure].label}
                </StatusPill>
              </button>
              {open && (
                <ul className="sm-checks">
                  {a.checks.map((c) => (
                    <li key={c.requirement.id}>
                      <span className="mono small">{c.requirement.id}</span>{" "}
                      {c.requirement.title}
                      <StatusPill tone={EXPOSURE[c.exposure].tone}>
                        {c.exposure === "material"
                          ? "Fails check"
                          : STATUS[c.status]}
                      </StatusPill>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      <p className="muted fine">
        {Object.values(EXPOSURE)
          .map((e) => `${e.label}: ${e.rule}`)
          .join(" · ")}
        .
      </p>
    </aside>
  );
}

/**
 * The stadium's 3D model with two views: Design review (the design intake twin,
 * unchanged) and Critical areas (areas of the model coloured by the worst
 * exposure among their FIFA checks).
 */
export default function StadiumModel({ stadium, records }) {
  const [view, setView] = useState("design");
  const [shown, setShown] = useState(() => CHAPTERS.map((c) => c.id));
  const [selected, setSelected] = useState(null);
  const data = useMemo(
    () => areaExposure(stadium, records),
    [stadium, records],
  );

  // Push the areas into the 3D model while the Critical areas view is open.
  useEffect(() => {
    let timer = null;
    const apply = () => {
      const t = twin();
      if (!t?.areas) {
        timer = setTimeout(apply, 200);
        return;
      }
      if (view !== "areas") {
        t.areas(null);
      } else {
        t.areas(
          data.areas.map((a) => ({
            id: a.id,
            label: a.label,
            pos: a.pos,
            tone: EXPOSURE[a.exposure].tone,
            color: a.color,
            selected: a.id === selected,
            off: !shown.includes(a.chapter),
            aria: `${a.label}: ${EXPOSURE[a.exposure].label}, ${a.open} open`,
          })),
          (id) => {
            setSelected((cur) => (cur === id ? null : id));
            const area = data.areas.find((x) => x.id === id);
            if (area) t.fly?.(areaView(area), 1000);
          },
        );
      }
      requestAnimationFrame(() => t.resize?.());
    };
    apply();
    return () => clearTimeout(timer);
  }, [view, data, shown, selected]);

  // Switching views: an overview of every area, or back to the twin's own view.
  const switchView = (next) => {
    if (next === view) return;
    setView(next);
    setTimeout(
      () => twin()?.fly?.(next === "areas" ? AREAS_VIEW : DESIGN_VIEW, 900),
      60,
    );
  };

  // Leaving the page: give the twin back its own pins.
  useEffect(() => () => twin()?.areas?.(null), []);

  const select = (id) => {
    setSelected(id);
    const area = data.areas.find((a) => a.id === id);
    if (area) twin()?.fly?.(areaView(area), 1000);
  };

  return (
    <section className="block smodel" aria-labelledby="smodel-title">
      <TwinScripts />
      <div className="smodel-head">
        <div>
          <span className="eyebrow">3D model</span>
          <h3 id="smodel-title">
            {view === "design" ? "Design intake" : "Critical areas"} ·{" "}
            {stadium.name}
          </h3>
        </div>
        <div className="view-toggle" role="group" aria-label="Model view">
          {[
            ["design", "Design review"],
            ["areas", "Critical areas"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={view === id}
              className={view === id ? "on" : undefined}
              onClick={() => switchView(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="lead">
        {view === "design" ? (
          <>
            Before anything is built, the design team&apos;s model goes in and
            compliance checks come out. This is the Riyadh venue for the 2034
            opening match and final, beside King Abdulaziz Park in north Riyadh.
            The 3D massing follows Populous&apos;s published concept: a
            circular, segmented form like a seed cracking the earth, green walls
            and roof, and a ring of hospitality boxes between two tiers.
            Proportions are approximate. The submissions and findings are
            simulated, and thresholds are illustrative.
          </>
        ) : (
          <>
            The same model, read against the FIFA venue requirements register.
            Each pin is an area of the stadium; its colour is the worst exposure
            among the checks it carries. Select an area to fly to it and see its
            checks. Positions are approximate.
          </>
        )}
      </p>
      <div className={`smodel-body ${view}`}>
        <div className="smodel-stage">
          <StadiumTwin />
          {view === "areas" && (
            <>
              <ChapterLegend shown={shown} setShown={setShown} />
              <ExposureLegend />
            </>
          )}
        </div>
        {view === "areas" && (
          <AreasPanel
            data={data}
            shown={shown}
            selected={selected}
            onSelect={select}
          />
        )}
      </div>
    </section>
  );
}
