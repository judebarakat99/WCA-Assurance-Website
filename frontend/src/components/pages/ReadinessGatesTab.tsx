"use client";

/**
 * Readiness gates tab: one self-contained file (styles, data, forecast engine and UI).
 * Drop it in, then render <ReadinessGatesTab /> from your Readiness Gates route or tab.
 * All data is sample data. Edit VENUES (and the seed strings) to plug in your real feed.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties, KeyboardEvent, MouseEvent } from "react";
import { FACILITY_REGISTER } from "@/lib/domain/facilities.mjs";

// ======================================================================
// Styles (injected as a <style> tag so this stays a single file)
// ======================================================================
const CSS = `
/*
  Readiness gates tab.
  Every colour reads your site's own token first (--accent, --surface, ...) and falls back to the
  Venue Compliance Hub palette, so the tab inherits the theme when tokens exist and still looks right when they do not.
  Dark mode follows [data-theme="dark"] or the OS setting, the same way the rest of the site does.
*/
.rg {
  --rg-bg: var(--bg, #f2f5f3);
  --rg-surface: var(--surface, #ffffff);
  --rg-sunk: var(--sunk, #e8eeeb);
  --rg-ink: var(--ink, #13211c);
  --rg-muted: var(--muted, #5a6a64);
  --rg-line: var(--line, #d6dfdb);
  --rg-accent: var(--accent, #0b6b4f);
  --rg-accent-ink: var(--accent-ink, #ffffff);
  --rg-accent-soft: var(--accent-soft, #dcefe7);
  --rg-gold: var(--gold, #9a6f17);
  --rg-gold-soft: var(--gold-soft, #f5ead2);
  --rg-good: var(--good, #1d7f47);
  --rg-good-soft: var(--good-soft, #dcf1e3);
  --rg-warn: var(--warn, #a8670f);
  --rg-warn-soft: var(--warn-soft, #f8ead2);
  --rg-bad: var(--bad, #b8342a);
  --rg-bad-soft: var(--bad-soft, #f8dfdc);
  --rg-shadow: var(--shadow, 0 10px 30px rgba(10, 30, 22, 0.14));
  --rg-display: var(--f-display, "Archivo", "Helvetica Neue", Arial, sans-serif);
  --rg-body: var(--f-body, inherit);
  --rg-mono: var(--f-mono, ui-monospace, SFMono-Regular, Menlo, monospace);

  color: var(--rg-ink);
  font-family: var(--rg-body);
  font-size: 14px;
  line-height: 1.5;
  display: block;
  width: 100%;
  max-width: 100%;
  min-width: 0;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .rg {
    --rg-bg: var(--bg, #0d1412);
    --rg-surface: var(--surface, #141d1a);
    --rg-sunk: var(--sunk, #1a2522);
    --rg-ink: var(--ink, #e4ece8);
    --rg-muted: var(--muted, #94a59e);
    --rg-line: var(--line, #26342f);
    --rg-accent: var(--accent, #3dbb8c);
    --rg-accent-ink: var(--accent-ink, #06120d);
    --rg-accent-soft: var(--accent-soft, #16352a);
    --rg-gold: var(--gold, #d8ac50);
    --rg-gold-soft: var(--gold-soft, #3a2f17);
    --rg-good: var(--good, #4cc47f);
    --rg-good-soft: var(--good-soft, #163524);
    --rg-warn: var(--warn, #e2a443);
    --rg-warn-soft: var(--warn-soft, #3a2b14);
    --rg-bad: var(--bad, #ef6d60);
    --rg-bad-soft: var(--bad-soft, #3d1d1a);
    --rg-shadow: var(--shadow, 0 10px 30px rgba(0, 0, 0, 0.5));
  }
}
:root[data-theme="dark"] .rg {
  --rg-bg: var(--bg, #0d1412);
  --rg-surface: var(--surface, #141d1a);
  --rg-sunk: var(--sunk, #1a2522);
  --rg-ink: var(--ink, #e4ece8);
  --rg-muted: var(--muted, #94a59e);
  --rg-line: var(--line, #26342f);
  --rg-accent: var(--accent, #3dbb8c);
  --rg-accent-ink: var(--accent-ink, #06120d);
  --rg-accent-soft: var(--accent-soft, #16352a);
  --rg-gold: var(--gold, #d8ac50);
  --rg-gold-soft: var(--gold-soft, #3a2f17);
  --rg-good: var(--good, #4cc47f);
  --rg-good-soft: var(--good-soft, #163524);
  --rg-warn: var(--warn, #e2a443);
  --rg-warn-soft: var(--warn-soft, #3a2b14);
  --rg-bad: var(--bad, #ef6d60);
  --rg-bad-soft: var(--bad-soft, #3d1d1a);
  --rg-shadow: var(--shadow, 0 10px 30px rgba(0, 0, 0, 0.5));
}

.rg *,
.rg *::before,
.rg *::after {
  box-sizing: border-box;
}
.rg .sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* ---------- headings and text ---------- */
.rg-head {
  display: flex;
  gap: 20px;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.rg-h2 {
  font-family: var(--rg-display);
  font-weight: 800;
  font-size: 24px;
  letter-spacing: -0.01em;
  margin: 0 0 4px;
}
.rg-h3 {
  font-family: var(--rg-display);
  font-weight: 700;
  font-size: 16px;
  margin: 0 0 6px;
}
.rg-lead {
  color: var(--rg-muted);
  max-width: 78ch;
  margin: 0;
}
.rg-note {
  color: var(--rg-muted);
  margin: 0 0 8px;
  max-width: 90ch;
}
.rg-mono {
  font-family: var(--rg-mono);
  font-size: 12.5px;
}
.rg-k {
  font-size: 11.5px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 600;
  color: var(--rg-muted);
}

/* ---------- buttons and inputs ---------- */
.rg button,
.rg select,
.rg input[type="date"] {
  font: inherit;
  font-size: 13px;
  color: var(--rg-ink);
}
.rg-btn,
.rg-seg button,
.rg-chip button {
  font-weight: 500;
  border-radius: 7px;
  border: 1px solid var(--rg-line);
  background: var(--rg-surface);
  padding: 6px 12px;
  cursor: pointer;
  line-height: 1.3;
}
.rg-btn:hover,
.rg-seg button:hover {
  border-color: var(--rg-accent);
}
.rg-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.rg-primary {
  background: var(--rg-accent);
  border-color: var(--rg-accent);
  color: var(--rg-accent-ink) !important;
}
.rg-ghost {
  border-color: transparent;
  background: transparent;
  color: var(--rg-muted) !important;
}
.rg select,
.rg input[type="date"] {
  border: 1px solid var(--rg-line);
  background: var(--rg-surface);
  border-radius: 7px;
  padding: 5px 8px;
}
.rg button:focus-visible,
.rg select:focus-visible,
.rg input:focus-visible,
.rg .rg-row:focus-visible {
  outline: 2px solid var(--rg-accent);
  outline-offset: 2px;
}
.rg-asof {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 12.5px;
  color: var(--rg-muted);
}

/* ---------- panels ---------- */
.rg-panel {
  background: var(--rg-surface);
  border: 1px solid var(--rg-line);
  border-radius: 12px;
  padding: 16px 18px;
  margin-bottom: 16px;
  min-width: 0;
}

/* ---------- hero and tiles ---------- */
.rg-hero {
  background: var(--rg-surface);
  border: 1px solid var(--rg-line);
  border-radius: 12px;
  padding: 16px 18px;
  margin-bottom: 16px;
}
.rg-ans {
  font-family: var(--rg-display);
  font-size: 19px;
  font-weight: 700;
  line-height: 1.35;
  margin: 0 0 14px;
  text-wrap: balance;
}
.rg-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px;
}
.rg-tile {
  background: var(--rg-sunk);
  border-radius: 10px;
  padding: 10px 12px;
  border-left: 3px solid transparent;
}
.rg-tile.good {
  border-left-color: var(--rg-good);
}
.rg-tile.warn {
  border-left-color: var(--rg-warn);
}
.rg-tile.bad {
  border-left-color: var(--rg-bad);
}
.rg-v {
  font-family: var(--rg-display);
  font-weight: 800;
  font-size: 24px;
  line-height: 1.2;
  margin-top: 2px;
}
.rg-n {
  font-size: 12px;
  color: var(--rg-muted);
}

/* ---------- controls ---------- */
.rg-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 14px 22px;
  align-items: center;
}
.rg-seg {
  display: inline-flex;
  border: 1px solid var(--rg-line);
  border-radius: 9px;
  overflow: hidden;
  background: var(--rg-sunk);
}
.rg-seg button {
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--rg-muted);
  padding: 7px 14px;
}
.rg-seg button.on {
  background: var(--rg-accent);
  color: var(--rg-accent-ink);
  font-weight: 600;
}
.rg-field,
.rg-check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.rg-scn {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
  padding: 6px 12px;
  background: var(--rg-sunk);
  border-radius: 9px;
}
.rg-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--rg-gold-soft);
  color: var(--rg-gold);
  font-size: 12px;
  font-weight: 600;
  padding: 2px 4px 2px 10px;
  border-radius: 999px;
}
.rg-chip button {
  border: 0;
  background: transparent;
  color: inherit;
  padding: 0 6px;
  font-size: 15px;
  line-height: 1;
}

/* ---------- pills ---------- */
.rg-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 9px;
  border-radius: 999px;
  white-space: nowrap;
}
.rg-pill::before {
  content: "";
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.rg-pill.good {
  background: var(--rg-good-soft);
  color: var(--rg-good);
}
.rg-pill.warn {
  background: var(--rg-warn-soft);
  color: var(--rg-warn);
}
.rg-pill.bad {
  background: var(--rg-bad-soft);
  color: var(--rg-bad);
}

/* ---------- gantt ---------- */
.rg-gantt {
  position: relative;
  overflow-x: auto;
}
.rg-gantt svg {
  display: block;
  width: 100%;
  min-width: 760px;
  height: auto;
  font-family: var(--rg-body);
}
.rg-gantt text {
  fill: var(--rg-ink);
  font-size: 12px;
}
.rg-gantt .vname {
  font-weight: 600;
  font-size: 13px;
}
.rg-gantt .mut {
  fill: var(--rg-muted);
  font-size: 11px;
}
.rg-gantt .rg-gridl line {
  stroke: var(--rg-line);
  stroke-width: 1;
}
.rg-gantt .today {
  stroke: var(--rg-accent);
  stroke-width: 1.5;
}
.rg-gantt .todaylbl {
  fill: var(--rg-accent);
  font-weight: 600;
  font-size: 11px;
}
.rg-gantt .hit {
  fill: transparent;
}
.rg-gantt .rg-row {
  cursor: pointer;
  outline: none;
}
.rg-gantt .rg-row:hover .hit {
  fill: var(--rg-sunk);
  opacity: 0.55;
}
.rg-gantt .rg-row.sel .hit {
  fill: var(--rg-accent-soft);
  opacity: 0.7;
}
.rg-gantt .rg-row:focus-visible .hit {
  stroke: var(--rg-accent);
  stroke-width: 2;
}
.rg-gantt .runway.good,
.rg svg .runway.good {
  fill: var(--rg-good);
  opacity: 0.85;
}
.rg-gantt .runway.warn,
.rg svg .runway.warn {
  fill: var(--rg-warn);
  opacity: 0.85;
}
.rg-gantt .runway.bad,
.rg svg .runway.bad {
  fill: var(--rg-bad);
  opacity: 0.85;
}
.rg svg .band {
  stroke-width: 1.5;
}
.rg svg .band.good {
  stroke: var(--rg-good);
}
.rg svg .band.warn {
  stroke: var(--rg-warn);
}
.rg svg .band.bad {
  stroke: var(--rg-bad);
}
.rg svg .p60 {
  stroke: var(--rg-ink);
  stroke-width: 2;
}
.rg svg .gate {
  stroke: var(--rg-ink);
  stroke-width: 1.5;
  stroke-dasharray: 3 3;
}
.rg svg .gated {
  fill: var(--rg-ink);
}
.rg svg .pmc {
  fill: var(--rg-surface);
  stroke: var(--rg-muted);
  stroke-width: 2;
}
.rg-gantt .gd {
  fill: var(--rg-sunk);
  stroke: var(--rg-line);
}
.rg-gantt .gd.done {
  fill: var(--rg-good);
  stroke: var(--rg-good);
}
.rg-gantt .gd.next {
  fill: var(--rg-gold);
  stroke: var(--rg-gold);
}
.rg-gantt .marg {
  font-weight: 700;
  font-size: 12.5px;
}
.rg-gantt .marg.good {
  fill: var(--rg-good);
}
.rg-gantt .marg.warn {
  fill: var(--rg-warn);
}
.rg-gantt .marg.bad {
  fill: var(--rg-bad);
}
.rg-tip {
  position: absolute;
  pointer-events: none;
  background: var(--rg-surface);
  border: 1px solid var(--rg-line);
  box-shadow: var(--rg-shadow);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 12.5px;
  line-height: 1.45;
  width: 276px;
  z-index: 5;
}
.rg-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  font-size: 12px;
  color: var(--rg-muted);
}
.rg-legend > span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.rg-glegend {
  margin-top: 10px;
}
.rg-legend i {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  display: inline-block;
}

/* state colours shared by legend, stacked bar and counts */
.rg i.ver,
.rg .rg-stack .ver {
  background: var(--rg-good);
}
.rg i.val,
.rg .rg-stack .val {
  background: var(--rg-accent);
}
.rg i.sub,
.rg .rg-stack .sub {
  background: var(--rg-warn);
}
.rg i.asg,
.rg .rg-stack .asg {
  background: var(--rg-line);
}
.rg i.rej,
.rg .rg-stack .rej {
  background: var(--rg-bad);
}

/* table fallback */
.rg-table {
  margin-top: 12px;
}
.rg-table summary {
  cursor: pointer;
  color: var(--rg-muted);
  font-size: 12.5px;
}
.rg-tablewrap {
  overflow-x: auto;
  margin-top: 8px;
  border: 1px solid var(--rg-line);
  border-radius: 8px;
}
.rg-tablewrap table {
  border-collapse: collapse;
  width: 100%;
  font-size: 12.5px;
}
.rg-tablewrap th,
.rg-tablewrap td {
  text-align: left;
  padding: 7px 10px;
  border-bottom: 1px solid var(--rg-line);
  white-space: nowrap;
}
.rg-tablewrap th {
  background: var(--rg-sunk);
  font-weight: 600;
}
.rg-tablewrap tr:last-child td {
  border-bottom: 0;
}

/* ---------- venue cards ---------- */
.rg-cards-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin: 4px 0 10px;
}
.rg-cards-head .rg-h3 {
  margin: 0;
}
.rg-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 14px;
}
.rg-card {
  background: var(--rg-surface);
  border: 1px solid var(--rg-line);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.rg-card:hover {
  border-color: var(--rg-accent);
}
.rg-card.sel {
  border-color: var(--rg-accent);
  box-shadow: 0 0 0 2px var(--rg-accent-soft), var(--rg-shadow);
}
.rg-chead {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-start;
}
.rg-vname {
  font-weight: 700;
  line-height: 1.3;
}
.rg-meta,
.rg-sub {
  font-size: 12.5px;
  color: var(--rg-muted);
}

/* next gate block */
.rg-next {
  display: flex;
  gap: 14px;
  align-items: center;
  background: var(--rg-sunk);
  border-radius: 10px;
  padding: 12px;
}
.rg-ring {
  --c: var(--rg-good);
  flex: none;
  width: 68px;
  height: 68px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: conic-gradient(var(--c) calc(var(--p) * 1%), var(--rg-line) 0);
  position: relative;
}
.rg-ring.warn {
  --c: var(--rg-warn);
}
.rg-ring.bad {
  --c: var(--rg-bad);
}
.rg-ring::before {
  content: "";
  position: absolute;
  inset: 7px;
  border-radius: 50%;
  background: var(--rg-sunk);
}
.rg-ring span {
  position: relative;
  font-family: var(--rg-display);
  font-weight: 800;
  font-size: 16px;
}
.rg-nextbody {
  min-width: 0;
}
.rg-gname {
  font-family: var(--rg-display);
  font-weight: 700;
  font-size: 16px;
  line-height: 1.3;
}
.rg-gname b {
  font-family: var(--rg-mono);
  font-size: 12px;
  background: var(--rg-gold-soft);
  color: var(--rg-gold);
  padding: 1px 6px;
  border-radius: 4px;
  margin-right: 4px;
}
.rg-margin {
  font-weight: 600;
  font-size: 12.5px;
  margin: 3px 0;
}
.rg-margin.good {
  color: var(--rg-good);
}
.rg-margin.warn {
  color: var(--rg-warn);
}
.rg-margin.bad {
  color: var(--rg-bad);
}

/* gate ladder */
.rg-ladder {
  list-style: none;
  display: flex;
  margin: 0;
  padding: 0;
  gap: 0;
}
.rg-ladder li {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  position: relative;
  text-align: center;
  color: var(--rg-muted);
}
.rg-ladder li:not(:last-child)::after {
  content: "";
  position: absolute;
  top: 11px;
  left: calc(50% + 14px);
  right: calc(-50% + 14px);
  height: 2px;
  background: var(--rg-line);
}
.rg-ladder li.done:not(:last-child)::after {
  background: var(--rg-good);
}
.rg-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-family: var(--rg-mono);
  font-size: 11px;
  font-weight: 600;
  background: var(--rg-sunk);
  border: 2px solid var(--rg-line);
}
.rg-ladder li.done .rg-dot {
  background: var(--rg-good);
  border-color: var(--rg-good);
  color: var(--rg-surface);
}
.rg-ladder li.next .rg-dot {
  background: var(--rg-gold-soft);
  border-color: var(--rg-gold);
  color: var(--rg-gold);
  box-shadow: 0 0 0 3px var(--rg-gold-soft);
}
.rg-ladder li.next {
  color: var(--rg-ink);
  font-weight: 600;
}
.rg-gl {
  font-size: 10.5px;
  line-height: 1.2;
  max-width: 64px;
}

/* compliance block */
.rg-comp {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rg-score {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.rg-big {
  font-family: var(--rg-display);
  font-weight: 800;
  font-size: 30px;
  line-height: 1;
}
.rg-small {
  font-size: 12px;
  color: var(--rg-muted);
  line-height: 1.35;
}
.rg-gapbar {
  position: relative;
  height: 10px;
  border-radius: 6px;
  background: var(--rg-sunk);
  overflow: hidden;
}
.rg-gapbar .decl {
  position: absolute;
  inset: 0 auto 0 0;
  background: repeating-linear-gradient(45deg, var(--rg-warn-soft), var(--rg-warn-soft) 4px, transparent 4px, transparent 8px);
  border-right: 2px solid var(--rg-warn);
}
.rg-gapbar .assu {
  position: absolute;
  inset: 0 auto 0 0;
  background: var(--rg-accent);
  border-radius: 6px;
  transition: width 0.3s;
}
.rg-stack {
  display: flex;
  height: 8px;
  border-radius: 5px;
  overflow: hidden;
  gap: 2px;
}
.rg-stack span {
  min-width: 4px;
}
.rg-counts {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--rg-muted);
}
.rg-counts span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: var(--rg-mono);
}
.rg-counts .zero {
  opacity: 0.45;
}
.rg-counts i {
  width: 9px;
  height: 9px;
  border-radius: 3px;
  display: inline-block;
}

/* gate rules */
.rg-rules {
  border-top: 1px solid var(--rg-line);
  padding-top: 10px;
}
.rg-rtoggle {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: transparent;
  border: 0;
  padding: 2px 0;
  cursor: pointer;
  text-align: left;
}
.rg-rules ul {
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rg-rules li {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  font-size: 13px;
}
.rg-ic {
  flex: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 11px;
  font-weight: 700;
  margin-top: 1px;
}
.rg-ic.ok {
  background: var(--rg-good-soft);
  color: var(--rg-good);
}
.rg-ic.no {
  background: var(--rg-bad-soft);
  color: var(--rg-bad);
}
.rg-blockers {
  font-size: 12px;
  color: var(--rg-bad);
  margin-top: 2px;
}
.rg-blockers code {
  font-family: var(--rg-mono);
  font-size: 11.5px;
}
.rg-blockers em {
  font-style: normal;
  color: var(--rg-muted);
}
.rg-cfoot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: auto;
}

/* Keep the readiness view visually aligned with the shared application shell. */
.rg {
  font-family: var(--f-body);
  color: var(--ink);
}
.rg-h2 {
  font-size: clamp(28px, 3.4vw, 38px);
  line-height: 1.15;
  letter-spacing: -0.025em;
}
.rg-lead {
  max-width: none;
  font-size: 15.5px;
  line-height: 1.65;
}
.rg-panel,
.rg-hero,
.rg-card {
  border-radius: 16px;
  box-shadow: none;
}
.rg-btn,
.rg-seg,
.rg-seg button {
  border-radius: 999px;
}

@media (max-width: 640px) {
  .rg-cards {
    grid-template-columns: 1fr;
  }
  .rg-ans {
    font-size: 17px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .rg * {
    transition: none !important;
  }
}
`;

// ======================================================================
// Data, gate rules and forecast engine
// ======================================================================
// ---------- types ----------
type State = "Assigned" | "Submitted" | "Validated" | "Verified" | "Rejected";
type Crit = "Critical" | "High" | "Medium";
type Tone = "good" | "warn" | "bad";

interface Gate {
  id: string;
  name: string;
}
interface Obligation {
  id: string;
  venue: string;
  code: string;
  family: string;
  text: string;
  crit: Crit;
  gate: string;
  owner: string;
  state: State;
  dependsOn?: string;
}
interface Venue {
  id: string;
  facilityId?: string;
  short: string;
  name: string;
  city: string;
  type: "Stadium" | "Team base camp";
  role?: string;
  gateIdx: number; // index of the NEXT gate the venue still has to pass
  gateDate: string; // FIFA milestone for that gate (ISO date)
  velocity: number; // 1 to 5, delivery capability
  mat: 0 | 1; // 0 = evidence still from drawings, 1 = evidence from built assets
  pmc: { finish: string; pct: number; note: string };
  build: [number, number, number]; // min / likely / max days to build what is still missing
  seed: string; // one letter per obligation: V verified, A validated, S submitted, R rejected, N not started
}
interface Scenario {
  prod: number; // delivery-rate multiplier on durations (0.8 faster, 1.25 slower)
  fifa: boolean; // FIFA changes requirements mid-programme
  recovery: string[]; // venue ids with a recovery team deployed
}
interface Rule {
  ok: boolean;
  text: string;
  blockers: Obligation[];
}
interface GateEval {
  gate: Gate;
  scope: Obligation[];
  rules: Rule[];
  pass: boolean;
  assured: number;
}
interface Forecast {
  id: string;
  gate: Gate;
  gateDate: string;
  gateDays: number;
  p50: number;
  p60: number;
  p80: number;
  d50: string;
  d60: string;
  d80: string;
  prob: number;
  pmcFinish: string;
  pmcLate: number;
  late50: number;
  late80: number;
  status: string;
  tone: Tone;
}
type ComplianceStatus = { label: string; tone: Tone };

// ---------- reference data ----------
const GATES: Gate[] = [
  { id: "G1", name: "Design freeze" },
  { id: "G2", name: "Structure complete" },
  { id: "G3", name: "Construction complete" },
  { id: "G4", name: "Test event ready" },
  { id: "G5", name: "FIFA handover" },
];
const WEIGHT: Record<Crit, number> = { Critical: 3, High: 2, Medium: 1 };
// Evidence maturity a gate needs: 0 design, 1 installed, 2 commissioned, 3 proven in operation.
const MAT = ["Design", "Installed", "Commissioned", "Proven in operation"];
const REQMAT = [0, 1, 1, 2, 3];

type Tpl = Omit<Obligation, "id" | "venue" | "state">;
const T = (code: string, family: string, text: string, crit: Crit, gate: string, owner: string, dependsOn?: string): Tpl => ({
  code,
  family,
  text,
  crit,
  gate,
  owner,
  dependsOn,
});

// Illustrative requirement set modelled on FIFA stadium requirement families.
const STADIUM_TPL: Tpl[] = [
  T("CAP-01", "Capacity", "Gross seating capacity meets the match allocation", "Critical", "G2", "Stadium developer"),
  T("FOP-01", "Field of play", "Field of play measures 105 m in length", "Critical", "G2", "Stadium developer"),
  T("FOP-02", "Field of play", "Natural or hybrid grass surface installed and certified", "High", "G4", "Pitch contractor"),
  T("LGT-01", "Floodlighting", "Vertical illuminance towards fixed cameras", "Critical", "G4", "MEP contractor"),
  T("LGT-02", "Floodlighting", "Vertical illuminance uniformity (U2)", "High", "G4", "MEP contractor"),
  T("MED-01", "Media", "Media tribune seats on the main stand", "High", "G3", "Stadium developer"),
  T("TEA-01", "Team facilities", "Each team dressing room floor area", "High", "G3", "Stadium developer"),
  T("ACC-01", "Accessibility", "Wheelchair user spaces with companion seats", "High", "G3", "Stadium developer"),
  T("SAF-01", "Safety & security", "Full evacuation time to a place of safety", "Critical", "G4", "Civil Defense liaison"),
  T("ITT-01", "IT&T", "Dual-diverse fibre routes from stadium to the IBC", "Critical", "G3", "Telecom operator"),
  T("CLM-01", "Climate", "Bowl temperature at spectator level during matches", "High", "G4", "MEP contractor"),
  T("SUS-01", "Sustainability", "Green building certification achieved", "Medium", "G3", "Sustainability office"),
  T("MDC-01", "Medical", "Pitch-side medical room floor area", "Medium", "G3", "Health cluster"),
];
const CAMP_TPL: Tpl[] = [
  T("TBC-01", "Team base camp", "Training site travel time from team hotel", "High", "G3", "Host city"),
  T("TBC-02", "Team base camp", "Team hotel contracted with dedicated rooms", "Critical", "G3", "Hospitality operator"),
  T("TBC-03", "Team base camp", "Private, screened training sessions possible", "High", "G4", "Host city", "TBC-02"),
];

const SEED_VENUES: Venue[] = [
  { id: "RUH", facilityId: "king-salman-international", short: "King Salman, Riyadh", name: "King Salman International Stadium", city: "Riyadh", type: "Stadium", role: "Opening match and final", gateIdx: 1, gateDate: "2028-06-30", velocity: 4, mat: 0, pmc: { finish: "2028-06-12", pct: 9, note: "Bowl structure on programme" }, build: [420, 560, 800], seed: "V V N A N A V A A N N A N" },
  { id: "JED", facilityId: "king-abdullah-sports-city", short: "King Abdullah SC, Jeddah", name: "King Abdullah Sports City Stadium", city: "Jeddah", type: "Stadium", role: "Group stage to quarter-final", gateIdx: 2, gateDate: "2027-03-31", velocity: 3, mat: 1, pmc: { finish: "2027-03-20", pct: 71, note: "Upgrade works on programme, 11 days float" }, build: [90, 140, 220], seed: "V A N S A S N A N N N A V" },
  { id: "KHO", facilityId: "aramco", short: "Aramco, Al Khobar", name: "Aramco Stadium", city: "Al Khobar", type: "Stadium", role: "Group stage to round of 16", gateIdx: 2, gateDate: "2027-01-31", velocity: 6, mat: 1, pmc: { finish: "2027-01-15", pct: 88, note: "Fit-out and commissioning" }, build: [20, 35, 60], seed: "V V V A V V V V A V A V V" },
  { id: "AHB", facilityId: "king-khalid-university", short: "King Khalid Univ., Abha", name: "King Khalid University Stadium", city: "Abha", type: "Stadium", role: "Group stage", gateIdx: 1, gateDate: "2028-09-30", velocity: 3, mat: 0, pmc: { finish: "2028-09-01", pct: 14, note: "Redevelopment, early works" }, build: [480, 610, 820], seed: "V A A R A A A S N A N A A" },
  { id: "NEO", facilityId: "neom", short: "NEOM Stadium", name: "NEOM Stadium", city: "NEOM", type: "Stadium", role: "Group stage to round of 16", gateIdx: 0, gateDate: "2027-06-30", velocity: 3, mat: 0, pmc: { finish: "2027-06-10", pct: 42, note: "Design development, stage 3" }, build: [0, 0, 0], seed: "A A N N N S A N N S N A N" },
  { id: "TBC-R3", short: "Base camp R-03, Riyadh", name: "Team base camp R-03", city: "Riyadh", type: "Team base camp", gateIdx: 2, gateDate: "2027-06-30", velocity: 6, mat: 1, pmc: { finish: "2027-05-30", pct: 60, note: "Training pitch works" }, build: [30, 60, 110], seed: "A S N" },
  { id: "TBC-J1", short: "Base camp J-01, Jeddah", name: "Team base camp J-01", city: "Jeddah", type: "Team base camp", gateIdx: 2, gateDate: "2027-09-30", velocity: 6, mat: 1, pmc: { finish: "2027-08-31", pct: 55, note: "Hotel refurbishment" }, build: [40, 80, 140], seed: "V V A" },
];

// Keep the readiness view aligned with the 15-stadium facility register used by Overview.
// The five detailed scenarios above retain their illustrative forecast inputs; the remaining
// registered stadiums receive neutral seed data until a live readiness feed is connected.
const REGISTERED_STADIUMS: Venue[] = FACILITY_REGISTER.stadiums
  .filter((stadium) => !SEED_VENUES.some((venue) => venue.facilityId === stadium.id))
  .map((stadium, index) => {
    const city = FACILITY_REGISTER.hostCities.find((item) => item.id === stadium.cityId)?.name ?? stadium.cityId;
    const gateDate = `${Math.max(2027, stadium.completionYear)}-06-30`;
    const progress = stadium.status === "existing-refurbishment" ? 55 : stadium.status === "under-construction" ? 38 : 18;
    return {
      id: stadium.id,
      facilityId: stadium.id,
      short: `${stadium.name.replace(/ Stadium$/, "")}, ${city}`,
      name: stadium.name,
      city,
      type: "Stadium",
      role: "Group stage",
      gateIdx: index % GATES.length,
      gateDate,
      velocity: 3 + (index % 3),
      mat: stadium.status === "existing-refurbishment" ? 1 : 0,
      pmc: { finish: gateDate, pct: progress, note: `${stadium.status.replace(/-/g, " ")} programme` },
      build: [120 + index * 8, 220 + index * 10, 360 + index * 12],
      seed: "N A S V A N N S A N N A N",
    };
  });

const VENUES: Venue[] = [...SEED_VENUES, ...REGISTERED_STADIUMS];

const EXTERNAL = ["Telecom operator", "Civil Defense liaison", "Host city", "Hospitality operator", "Health cluster"];

// ---------- dates ----------
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY = 864e5;
const addDays = (iso: string, n: number): string => new Date(Date.parse(iso + "T00:00:00Z") + n * DAY).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string): number => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / DAY);
const fmtD = (iso: string): string => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
const pct = (x: number): number => Math.round(x * 100);
const dayWord = (n: number): string => `${Math.abs(n)} day${Math.abs(n) === 1 ? "" : "s"}`;

// ---------- obligations ----------
const LETTER: Record<string, State> = { V: "Verified", A: "Validated", S: "Submitted", R: "Rejected", N: "Assigned" };

function buildObligations(): Obligation[] {
  const out: Obligation[] = [];
  VENUES.forEach((v) => {
    const tpl = v.type === "Stadium" ? STADIUM_TPL : CAMP_TPL;
    const codes = v.seed.split(" ");
    tpl.forEach((t, i) => {
      out.push({
        ...t,
        id: `${v.id}-${t.code}`,
        venue: v.id,
        state: LETTER[codes[i]] ?? "Assigned",
        dependsOn: t.dependsOn ? `${v.id}-${t.dependsOn}` : undefined,
      });
    });
  });
  return out;
}

const gateNum = (g: string) => Number(g.slice(1));
const isProven = (o: Obligation) => o.state === "Verified" || o.state === "Validated";
const venueOf = (id: string) => VENUES.find((v) => v.id === id)!;

/** Evidence maturity of an obligation: -1 when no passing evidence exists yet. */
function matOf(o: Obligation): number {
  if (!isProven(o)) return -1;
  return venueOf(o.venue).mat === 0 ? 0 : gateNum(o.gate) >= 4 ? 2 : 1;
}

function scores(list: Obligation[]): { assured: number; declared: number } {
  let w = 0,
    a = 0,
    d = 0;
  list.forEach((o) => {
    const k = WEIGHT[o.crit];
    w += k;
    a += k * (o.state === "Verified" ? 1 : o.state === "Validated" ? 0.8 : 0);
    d += k * (o.state === "Assigned" ? 0 : 1);
  });
  return { assured: w ? a / w : 0, declared: w ? d / w : 0 };
}

function stateCounts(list: Obligation[]): Record<State, number> {
  const c: Record<State, number> = { Verified: 0, Validated: 0, Submitted: 0, Assigned: 0, Rejected: 0 };
  list.forEach((o) => c[o.state]++);
  return c;
}

function gateScope(list: Obligation[], gn: number): Obligation[] {
  return gn === 1 ? list.filter((o) => o.crit !== "Medium") : list.filter((o) => gateNum(o.gate) <= gn);
}

/** The rules a venue must meet before its next gate can pass. */
function gateEval(v: Venue, all: Obligation[]): GateEval | null {
  if (v.gateIdx >= GATES.length) return null;
  const mine = all.filter((o) => o.venue === v.id);
  const gn = v.gateIdx + 1;
  const req = REQMAT[gn - 1];
  const scope = gateScope(mine, gn);
  const immature = scope.filter((o) => isProven(o) && matOf(o) < req);
  const crit = scope.filter((o) => o.crit === "Critical" && o.state !== "Verified");
  const sc = scores(scope);
  const openCrit = mine.filter((o) => o.crit === "Critical" && o.state === "Rejected");
  const notValid = scope.filter((o) => !isProven(o));
  const rules: Rule[] = [
    { ok: crit.length === 0, text: "All Critical obligations in scope are verified by the second line", blockers: crit },
    { ok: immature.length === 0, text: `Evidence comes from the ${MAT[req].toLowerCase()} stage or later, not only from drawings`, blockers: immature },
    { ok: sc.assured >= 0.9, text: `Assured readiness for gate scope is at least 90% (now ${pct(sc.assured)}%)`, blockers: sc.assured >= 0.9 ? [] : notValid },
    { ok: openCrit.length === 0, text: "No open Critical issues", blockers: openCrit },
  ];
  return { gate: GATES[v.gateIdx], scope, rules, pass: rules.every((r) => r.ok), assured: sc.assured };
}

/** Compliance status shown on each venue. */
function complianceStatus(e: GateEval | null, own: Obligation[]): ComplianceStatus {
  if (!e) return { label: "All gates passed", tone: "good" };
  if (e.pass) return { label: "Meets gate rules", tone: "good" };
  // Rejected evidence anywhere in the venue means a requirement is failing today.
  return own.some((o) => o.state === "Rejected") ? { label: "Non-compliant items", tone: "bad" } : { label: "Gaps open", tone: "warn" };
}

// ---------- forecast: Monte Carlo on evidence, not on reported progress ----------
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function tri(r: () => number, a: number, m: number, b: number): number {
  if (b <= a) return a;
  const u = r(),
    f = (m - a) / (b - a);
  return u < f ? a + Math.sqrt(u * (b - a) * (m - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - m));
}
// Illustrative days to move an obligation to the state a gate needs. Calibrate on the PMC's schedule data.
const DUR: Partial<Record<State, [number, number, number]>> = {
  Assigned: [40, 80, 180],
  Submitted: [5, 20, 60],
  Rejected: [25, 55, 130],
  Validated: [4, 10, 25],
};

function forecast(v: Venue, all: Obligation[], scn: Scenario, today: string, runs = 1000): Forecast | null {
  if (v.gateIdx >= GATES.length) return null;
  const gn = v.gateIdx + 1;
  const req = REQMAT[gn - 1];
  const scope = gateScope(all.filter((o) => o.venue === v.id), gn);
  const gateDays = daysBetween(today, v.gateDate);
  const rec = scn.recovery.includes(v.id);
  const vel = 1 + (5 - v.velocity) * 0.12;
  const b = v.build;
  const r = rng([...v.id].reduce((h, c) => h * 31 + c.charCodeAt(0), 7) + (rec ? 17 : 0) + (scn.fifa ? 29 : 0) + Math.round(scn.prod * 100));
  const W = scope.reduce((s, o) => s + WEIGHT[o.crit], 0);
  const out: number[] = [];
  for (let k = 0; k < runs; k++) {
    const build = tri(r, b[0], b[1], b[2]) * (1 + (scn.prod - 1) * 0.5) * (rec ? 0.85 : 1);
    const fin: Record<string, number> = {};
    const t = scope.map((o) => {
      let d = 0;
      const need = o.crit === "Critical" ? "Verified" : "Validated";
      if (!(o.state === "Verified" || (o.state === "Validated" && need === "Validated"))) {
        const p = DUR[o.state] || [0, 0, 0];
        d = tri(r, p[0], p[1], p[2]) * vel * scn.prod * (rec ? 0.65 : 1);
      }
      if (matOf(o) < req || o.state === "Assigned" || o.state === "Rejected") d = Math.max(d, build + (o.state === "Verified" ? tri(r, 4, 10, 25) : 0));
      if (scn.fifa && r() < 0.12) d += tri(r, 20, 45, 100);
      return { o, d };
    });
    t.forEach((x) => (fin[x.o.id] = x.d));
    t.forEach((x) => {
      const dep = x.o.dependsOn ? fin[x.o.dependsOn] : undefined;
      if (dep) x.d = Math.max(x.d, dep + x.d * 0.6);
    });
    let crit = 0;
    t.forEach((x) => {
      if (x.o.crit === "Critical") crit = Math.max(crit, x.d);
    });
    t.sort((a, c) => a.d - c.d);
    let acc = 0,
      p90 = 0;
    for (const x of t) {
      acc += WEIGHT[x.o.crit];
      p90 = x.d;
      if (acc >= 0.9 * W) break;
    }
    out.push(Math.max(0, crit, p90));
  }
  out.sort((a, c) => a - c);
  const q = (p: number) => Math.round(out[Math.min(out.length - 1, Math.floor(p * out.length))]);
  const prob = out.filter((x) => x <= gateDays).length / out.length;
  const p50 = q(0.5),
    p60 = q(0.6),
    p80 = q(0.8);
  const late50 = p50 - gateDays,
    late80 = p80 - gateDays;
  return {
    id: v.id,
    gate: GATES[v.gateIdx],
    gateDate: v.gateDate,
    gateDays,
    p50,
    p60,
    p80,
    d50: addDays(today, p50),
    d60: addDays(today, p60),
    d80: addDays(today, p80),
    prob,
    pmcFinish: v.pmc.finish,
    pmcLate: daysBetween(v.gateDate, v.pmc.finish),
    late50,
    late80,
    status: late50 > 0 ? "Late at P50" : late80 > 0 ? "At risk at P80" : "On track at P80",
    tone: late50 > 0 ? "bad" : late80 > 0 ? "warn" : "good",
  };
}

// ======================================================================
// UI
// ======================================================================
// ---------- row model ----------
interface Row {
  v: Venue;
  f: Forecast;
  ev: GateEval | null;
  comp: ComplianceStatus;
  sc: { assured: number; declared: number };
  counts: Record<State, number>;
  total: number;
}

type Filter = "stadium" | "all" | "camp";
type SortKey = "gate" | "risk" | "ready";

const STATE_ORDER: State[] = ["Verified", "Validated", "Submitted", "Assigned", "Rejected"];
const STATE_CLASS: Record<State, string> = {
  Verified: "ver",
  Validated: "val",
  Submitted: "sub",
  Assigned: "asg",
  Rejected: "rej",
};
const DELIVERY: [number, string][] = [
  [0.8, "Faster (+20%)"],
  [1, "As planned"],
  [1.25, "Slower (-20%)"],
];

const pad = (n: number) => String(n).padStart(2, "0");
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const timing = (days: number) => (days >= 0 ? `in ${dayWord(days)}` : `${dayWord(days)} ago`);
const margin = (late80: number) => (late80 > 0 ? `${dayWord(late80)} late at P80` : `${dayWord(late80)} spare at P80`);

// ======================================================================
// Main tab
// ======================================================================
export default function ReadinessGatesTab({ asOf, title = "Readiness gates" }: { asOf?: string; title?: string }) {
  const router = useRouter();
  const [today, setToday] = useState<string | null>(asOf ?? null);
  const [scn, setScn] = useState<Scenario>({ prod: 1, fifa: false, recovery: [] });
  const [filter, setFilter] = useState<Filter>("stadium");
  const [sort, setSort] = useState<SortKey>("gate");
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  // Read the clock on the client only, so the static export never mismatches on hydration.
  useEffect(() => {
    if (!asOf) {
      const timer = window.setTimeout(() => setToday(localToday()), 0);
      return () => window.clearTimeout(timer);
    }
  }, [asOf]);

  const obligations = useMemo(() => buildObligations(), []);

  const rows: Row[] = useMemo(() => {
    if (!today) return [];
    const out: Row[] = [];
    VENUES.forEach((v) => {
      const f = forecast(v, obligations, scn, today);
      if (!f) return;
      const own = obligations.filter((o) => o.venue === v.id);
      const ev = gateEval(v, obligations);
      out.push({ v, f, ev, comp: complianceStatus(ev, own), sc: scores(own), counts: stateCounts(own), total: own.length });
    });
    return out;
  }, [today, scn, obligations]);

  const visible = useMemo(() => {
    const list = rows.filter((r) => (filter === "all" ? true : filter === "stadium" ? r.v.type === "Stadium" : r.v.type !== "Stadium"));
    const by: Record<SortKey, (a: Row, b: Row) => number> = {
      gate: (a, b) => a.f.gateDays - b.f.gateDays,
      risk: (a, b) => a.f.prob - b.f.prob || b.f.late80 - a.f.late80,
      ready: (a, b) => b.sc.assured - a.sc.assured,
    };
    return list.slice().sort(by[sort]);
  }, [rows, filter, sort]);

  const toggleRecovery = (id: string) =>
    setScn((s) => ({ ...s, recovery: s.recovery.includes(id) ? s.recovery.filter((x) => x !== id) : [...s.recovery, id] }));
  const scenarioChanged = scn.prod !== 1 || scn.fifa || scn.recovery.length > 0;

  const pick = (id: string, scroll: boolean) => {
    setSelected(id);
    setOpen((o) => ({ ...o, [id]: true }));
    if (scroll && typeof window !== "undefined") {
      requestAnimationFrame(() => document.getElementById(`rg-card-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
    }
  };

  if (!today) {
    return (
      <div className="rg" aria-busy="true">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <h2 className="rg-h2">{title}</h2>
        <p className="rg-lead">Loading forecast...</p>
      </div>
    );
  }

  // ---------- summary ----------
  const n = visible.length;
  const on80 = visible.filter((r) => r.f.late80 <= 0).length;
  const on50 = visible.filter((r) => r.f.late50 <= 0).length;
  const worst = visible.slice().sort((a, b) => a.f.prob - b.f.prob || b.f.late80 - a.f.late80)[0];
  const soonest = visible.slice().sort((a, b) => a.f.gateDays - b.f.gateDays)[0];
  const nonCompliant = visible.filter((r) => r.comp.tone === "bad").length;
  const allOwn = obligations.filter((o) => visible.some((r) => r.v.id === o.venue));
  const portfolio = scores(allOwn);

  return (
    <div className="rg">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header className="rg-head">
        <div>
          <h2 className="rg-h2">{title}</h2>
          <p className="rg-lead">
            Where each venue stands against its next FIFA gate: the forecast timeline, the compliance position behind it, and the gate it will reach next. Forecasts start from what evidence has proven, not from reported percent complete. Sample data; durations are illustrative until calibrated on the PMC&apos;s schedule data.
          </p>
        </div>
        <div className="rg-asof">
          <label htmlFor="rgAsOf">As of</label>
          <input id="rgAsOf" type="date" value={today} onChange={(e) => e.target.value && setToday(e.target.value)} />
          <button type="button" className="rg-btn rg-ghost" onClick={() => setToday(localToday())} disabled={today === localToday()}>
            Today
          </button>
        </div>
      </header>

      {n > 0 && worst && soonest && (
        <section className="rg-hero" aria-live="polite">
          <p className="rg-ans">
            {on80} of {n} venue{n === 1 ? "" : "s"} make their next gate with 80% confidence{on50 > on80 ? `, ${on50} at 50%` : ""}.{" "}
            {worst.f.late80 > 0
              ? `${worst.v.short} is the biggest risk: a ${pct(worst.f.prob)}% chance of meeting its ${worst.f.gate.id} milestone and a P80 ${dayWord(worst.f.late80)} late${worst.f.pmcLate <= 0 ? ", while the PMC schedule shows it on time" : ""}.`
              : "No venue is late at P80."}
          </p>
          <div className="rg-tiles">
            <Tile k="On track at P80" v={`${on80}/${n}`} note={`${n - on80} at risk or late`} tone={on80 === n ? "good" : "warn"} />
            <Tile k="Next gate due" v={fmtD(soonest.f.gateDate)} note={`${soonest.v.short} · ${soonest.f.gate.id} · ${timing(soonest.f.gateDays)}`} />
            <Tile k="Assured readiness" v={`${pct(portfolio.assured)}%`} note={`${pct(portfolio.declared)}% declared by owners`} />
            <Tile k="Non-compliant venues" v={String(nonCompliant)} note="venues with rejected evidence" tone={nonCompliant ? "bad" : "good"} />
          </div>
        </section>
      )}

      <section className="rg-panel" aria-label="Controls">
        <div className="rg-controls">
          <div className="rg-seg" role="group" aria-label="Venues shown">
            {([
              ["stadium", "Stadiums"],
              ["camp", "Base camps"],
              ["all", "All venues"],
            ] as [Filter, string][]).map(([k, l]) => (
              <button key={k} type="button" aria-pressed={filter === k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>
                {l}
              </button>
            ))}
          </div>
          <label className="rg-field">
            Sort by
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              <option value="gate">Next gate date</option>
              <option value="risk">Highest risk</option>
              <option value="ready">Assured readiness</option>
            </select>
          </label>
          <div className="rg-scn" role="group" aria-label="Scenario">
            <b>Scenario</b>
            <label className="rg-field">
              Delivery rate
              <select value={scn.prod} onChange={(e) => setScn((s) => ({ ...s, prod: Number(e.target.value) }))}>
                {DELIVERY.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="rg-check">
              <input type="checkbox" checked={scn.fifa} onChange={(e) => setScn((s) => ({ ...s, fifa: e.target.checked }))} />
              FIFA changes requirements mid-programme
            </label>
            {scn.recovery.map((id) => (
              <span className="rg-chip" key={id}>
                Recovery: {VENUES.find((v) => v.id === id)?.short}
                <button type="button" aria-label={`Remove recovery team at ${id}`} onClick={() => toggleRecovery(id)}>
                  ×
                </button>
              </span>
            ))}
            {scenarioChanged && (
              <button type="button" className="rg-btn rg-ghost" onClick={() => setScn({ prod: 1, fifa: false, recovery: [] })}>
                Reset scenario
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="rg-panel" aria-label="Gate forecast timeline">
        <h3 className="rg-h3">Gate timeline</h3>
        <p className="rg-note">
          Each bar runs from today to the date the next gate&apos;s rules are met in 50% of 1,000 simulated runs (P50), and the lighter band extends to 80% (P80). The diamond is FIFA&apos;s milestone. Select a row to jump to that venue.
        </p>
        {n === 0 ? <p className="rg-note">No venues in this view.</p> : <Gantt rows={visible} today={today} selected={selected} onSelect={(id) => pick(id, true)} />}
        <details className="rg-table">
          <summary>Show as table</summary>
          <div className="rg-tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Venue</th>
                  <th>Compliance</th>
                  <th>Next gate</th>
                  <th>FIFA milestone</th>
                  <th>PMC finish</th>
                  <th>P50</th>
                  <th>P60</th>
                  <th>P80</th>
                  <th>On time</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.v.id}>
                    <td>{r.v.short}</td>
                    <td>
                      <span className={`rg-pill ${r.comp.tone}`}>{r.comp.label}</span>
                    </td>
                    <td>
                      {r.f.gate.id} {r.f.gate.name}
                    </td>
                    <td className="rg-mono">{fmtD(r.f.gateDate)}</td>
                    <td className="rg-mono">{fmtD(r.f.pmcFinish)}</td>
                    <td className="rg-mono">{fmtD(r.f.d50)}</td>
                    <td className="rg-mono">{fmtD(r.f.d60)}</td>
                    <td className="rg-mono">{fmtD(r.f.d80)}</td>
                    <td>{pct(r.f.prob)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <div className="rg-cards-head">
        <h3 className="rg-h3">Compliance and next gate by stadium</h3>
        <div className="rg-legend">
          <span>
            <i className="ver" />
            Verified
          </span>
          <span>
            <i className="val" />
            Validated
          </span>
          <span>
            <i className="sub" />
            Submitted
          </span>
          <span>
            <i className="asg" />
            Not started
          </span>
          <span>
            <i className="rej" />
            Rejected
          </span>
        </div>
      </div>
      <div className="rg-cards">
        {visible.map((r) => (
          <VenueCard
            key={r.v.id}
            r={r}
            selected={selected === r.v.id}
            expanded={!!open[r.v.id]}
            recovery={scn.recovery.includes(r.v.id)}
            onSelect={() => router.push(`/facilities/${r.v.facilityId ?? r.v.id}`)}
            onToggle={() => setOpen((o) => ({ ...o, [r.v.id]: !o[r.v.id] }))}
            onRecovery={() => toggleRecovery(r.v.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ======================================================================
// Small pieces
// ======================================================================
function Tile({ k, v, note, tone }: { k: string; v: string; note: string; tone?: Tone }) {
  return (
    <div className={`rg-tile ${tone ?? ""}`}>
      <div className="rg-k">{k}</div>
      <div className="rg-v">{v}</div>
      <div className="rg-n">{note}</div>
    </div>
  );
}

function Ladder({ gateIdx, compact }: { gateIdx: number; compact?: boolean }) {
  return (
    <ol className={`rg-ladder ${compact ? "compact" : ""}`} aria-label="Gate progress">
      {GATES.map((g, i) => (
        <li key={g.id} className={i < gateIdx ? "done" : i === gateIdx ? "next" : ""} title={`${g.id} ${g.name}`}>
          <span className="rg-dot">{i < gateIdx ? "✓" : g.id.slice(1)}</span>
          {!compact && <span className="rg-gl">{g.name}</span>}
        </li>
      ))}
    </ol>
  );
}

// ======================================================================
// Gantt (SVG)
// ======================================================================
function Gantt({ rows, today, selected, onSelect }: { rows: Row[]; today: string; selected: string | null; onSelect: (id: string) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ r: Row; x: number; y: number } | null>(null);

  const W = 1100,
    L = 250,
    R = 128,
    top = 38,
    rowH = 60;
  const H = top + rows.length * rowH + 14;
  const t0 = Date.parse(today + "T00:00:00Z");
  let end = t0;
  rows.forEach((r) => [r.f.d80, r.f.gateDate, r.f.pmcFinish].forEach((d) => (end = Math.max(end, Date.parse(d + "T00:00:00Z")))));
  end += 45 * 864e5;
  const X = (d: string) => L + ((Date.parse(d + "T00:00:00Z") - t0) / (end - t0)) * (W - L - R);

  const span = (end - t0) / 864e5;
  const step = span > 900 ? 6 : span > 360 ? 3 : 1;
  const ticks: string[] = [];
  const s = new Date(today + "T00:00:00Z");
  s.setUTCDate(1);
  s.setUTCMonth(Math.ceil((s.getUTCMonth() + 1) / step) * step);
  while (s.getTime() < end) {
    ticks.push(s.toISOString().slice(0, 10));
    s.setUTCMonth(s.getUTCMonth() + step);
  }

  const move = (e: MouseEvent, r: Row) => {
    const b = wrapRef.current?.getBoundingClientRect();
    if (!b) return;
    setTip({ r, x: Math.min(e.clientX - b.left + 14, Math.max(0, b.width - 290)), y: e.clientY - b.top + 14 });
  };
  const key = (e: KeyboardEvent, id: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(id);
    }
  };

  return (
    <>
      <div className="rg-gantt" ref={wrapRef}>
        <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Gate forecast per venue: P50 to P80 range against the FIFA milestone and PMC finish">
          <defs>
            {(["good", "warn", "bad"] as Tone[]).map((t) => (
              <pattern key={t} id={`rg-hatch-${t}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="6" height="6" style={{ fill: `var(--rg-${t}-soft)` }} />
                <line x1="0" y1="0" x2="0" y2="6" style={{ stroke: `var(--rg-${t})`, strokeWidth: 2 }} />
              </pattern>
            ))}
          </defs>
          <g className="rg-gridl">
            {ticks.map((d) => (
              <line key={d} x1={X(d)} x2={X(d)} y1={top - 8} y2={H - 8} />
            ))}
          </g>
          {ticks.map((d) => (
            <text key={d} className="mut" x={X(d)} y={top - 16} textAnchor="middle">
              {MONTHS[Number(d.slice(5, 7)) - 1]} {d.slice(2, 4)}
            </text>
          ))}

          {rows.map((r, i) => {
            const y = top + i * rowH + rowH / 2;
            const f = r.f;
            const sel = selected === r.v.id;
            const gx = X(f.gateDate);
            const x0 = X(today),
              x50 = X(f.d50),
              x80 = X(f.d80);
            const ready = f.p80 === 0;
            return (
              <g
                key={r.v.id}
                className={`rg-row ${sel ? "sel" : ""}`}
                tabIndex={0}
                role="button"
                aria-label={`${r.v.short}, next gate ${f.gate.id} ${f.gate.name}, ${r.comp.label}, ${f.status}. Select to see details.`}
                onClick={() => onSelect(r.v.id)}
                onKeyDown={(e) => key(e, r.v.id)}
                onMouseMove={(e) => move(e, r)}
                onMouseLeave={() => setTip(null)}
                onBlur={() => setTip(null)}
              >
                <rect className="hit" x={0} y={y - rowH / 2} width={W} height={rowH} />
                <text x={0} y={y - 8} className="vname">
                  {r.v.short}
                </text>
                {GATES.map((g, gi) => (
                  <rect key={g.id} x={gi * 17} y={y + 2} width={13} height={7} rx={2} className={gi < r.v.gateIdx ? "gd done" : gi === r.v.gateIdx ? "gd next" : "gd"} />
                ))}
                <text className="mut" x={92} y={y + 9}>
                  {f.gate.id} next · {pct(f.prob)}% on time
                </text>

                {/* runway today to P50, uncertainty band P50 to P80 */}
                <rect className={`runway ${f.tone}`} x={x0} y={y - 6} width={Math.max(2, x50 - x0)} height={12} rx={4} />
                <rect x={x50} y={y - 6} width={Math.max(3, x80 - x50)} height={12} rx={4} fill={`url(#rg-hatch-${f.tone})`} className={`band ${f.tone}`} />
                <line className="p60" x1={X(f.d60)} x2={X(f.d60)} y1={y - 9} y2={y + 9} />
                <line className="gate" x1={gx} x2={gx} y1={y - 15} y2={y + 15} />
                <path className="gated" d={`M${gx} ${y - 21} l4.5 4.5 l-4.5 4.5 l-4.5 -4.5 z`} />
                <circle className="pmc" cx={X(f.pmcFinish)} cy={y} r={5} />
                {ready && (
                  <text className="mut" x={x50 + 10} y={y + 22}>
                    Gate rules met today
                  </text>
                )}
                <text className={`marg ${f.tone}`} x={W - R + 14} y={y - 2}>
                  {dayWord(f.late80)} {f.late80 > 0 ? "late" : "spare"}
                </text>
                <text className="mut" x={W - R + 14} y={y + 13}>
                  at P80
                </text>
              </g>
            );
          })}

          <line className="today" x1={X(today)} x2={X(today)} y1={top - 8} y2={H - 8} />
          <text className="todaylbl" x={X(today) + 5} y={H - 1}>
            Today
          </text>
        </svg>

        {tip && (
          <div className="rg-tip" style={{ left: tip.x, top: tip.y }} role="tooltip">
            <b>{tip.r.v.name}</b>
            <div>
              {tip.r.f.gate.id} {tip.r.f.gate.name}: FIFA milestone {fmtD(tip.r.f.gateDate)}
            </div>
            <div>PMC deterministic finish {fmtD(tip.r.f.pmcFinish)}</div>
            <div>
              Evidence-based P50 {fmtD(tip.r.f.d50)} · P60 {fmtD(tip.r.f.d60)} · P80 {fmtD(tip.r.f.d80)}
            </div>
            <div>Chance of meeting the milestone: {pct(tip.r.f.prob)}%</div>
            <div>
              Compliance: <b>{tip.r.comp.label}</b>
            </div>
          </div>
        )}
      </div>

      <div className="rg-legend rg-glegend">
        <span>
          <svg width="30" height="12" aria-hidden="true">
            <rect x="0" y="2" width="14" height="8" rx="3" className="runway good" />
            <rect x="14" y="2" width="15" height="8" rx="3" fill="url(#rg-hatch-good)" className="band good" />
          </svg>
          Today to P50, then P50 to P80
        </span>
        <span>
          <svg width="6" height="14" aria-hidden="true">
            <line x1="3" x2="3" y1="0" y2="14" className="p60" />
          </svg>
          P60
        </span>
        <span>
          <svg width="12" height="12" aria-hidden="true">
            <circle cx="6" cy="6" r="4.5" className="pmc" />
          </svg>
          PMC schedule finish
        </span>
        <span>
          <svg width="10" height="14" aria-hidden="true">
            <path d="M5 0 l4 4 l-4 4 l-4 -4 z" className="gated" />
            <line x1="5" x2="5" y1="8" y2="14" className="gate" />
          </svg>
          FIFA milestone
        </span>
        <span>
          <span className="rg-pill good">On track at P80</span>
          <span className="rg-pill warn">At risk at P80</span>
          <span className="rg-pill bad">Late at P50</span>
        </span>
      </div>
    </>
  );
}

// ======================================================================
// Venue card
// ======================================================================
function VenueCard({
  r,
  selected,
  expanded,
  recovery,
  onSelect,
  onToggle,
  onRecovery,
}: {
  r: Row;
  selected: boolean;
  expanded: boolean;
  recovery: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onRecovery: () => void;
}) {
  const { v, f, ev, comp, sc, counts, total } = r;
  const after = GATES[v.gateIdx + 1];
  const met = ev ? ev.rules.filter((x) => x.ok).length : 0;
  const ring = { "--p": pct(f.prob) } as CSSProperties;

  return (
    <article id={`rg-card-${v.id}`} className={`rg-card ${selected ? "sel" : ""}`} onClick={onSelect}>
      <div className="rg-chead">
        <div>
          <div className="rg-vname">{v.name}</div>
          <div className="rg-meta">
            {v.city} · {v.type}
            {v.role ? ` · ${v.role}` : ""}
          </div>
        </div>
        <span className={`rg-pill ${comp.tone}`}>{comp.label}</span>
      </div>

      <div className="rg-next">
        <div className={`rg-ring ${f.tone}`} style={ring} role="img" aria-label={`${pct(f.prob)}% chance of meeting the milestone`}>
          <span>{pct(f.prob)}%</span>
        </div>
        <div className="rg-nextbody">
          <div className="rg-k">Next gate</div>
          <div className="rg-gname">
            <b>{f.gate.id}</b> {f.gate.name}
          </div>
          <div className="rg-sub">
            FIFA milestone {fmtD(f.gateDate)} · {timing(f.gateDays)}
          </div>
          <div className="rg-sub">
            Forecast P50 {fmtD(f.d50)} · P80 {fmtD(f.d80)}
          </div>
          <div className={`rg-margin ${f.tone}`}>
            {f.status} · {margin(f.late80)}
          </div>
          <div className="rg-sub">{after ? `Then ${after.id} ${after.name}` : "Final gate"}</div>
        </div>
      </div>

      <Ladder gateIdx={v.gateIdx} />

      <div className="rg-comp">
        <div className="rg-score">
          <span className="rg-big">{pct(sc.assured)}%</span>
          <span className="rg-small">
            assured across {total} obligations
            <br />
            {pct(sc.declared)}% declared by owners
          </span>
        </div>
        <div className="rg-gapbar" title="Outline = declared by owners, solid = assured by evidence">
          <div className="decl" style={{ width: `${pct(sc.declared)}%` }} />
          <div className="assu" style={{ width: `${pct(sc.assured)}%` }} />
        </div>
        <div className="rg-stack" role="img" aria-label={STATE_ORDER.map((s) => `${counts[s]} ${s}`).join(", ")}>
          {STATE_ORDER.map((s) => (counts[s] ? <span key={s} className={STATE_CLASS[s]} style={{ flex: counts[s] }} title={`${s}: ${counts[s]}`} /> : null))}
        </div>
        <div className="rg-counts">
          {STATE_ORDER.map((s) => (
            <span key={s} className={counts[s] ? "" : "zero"}>
              <i className={STATE_CLASS[s]} />
              {counts[s]}
            </span>
          ))}
        </div>
      </div>

      {ev && (
        <div className="rg-rules">
          <button type="button" className="rg-rtoggle" aria-expanded={expanded} onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}>
            <span>
              Gate rules <b>{met} of {ev.rules.length}</b> met
            </span>
            <span aria-hidden="true">{expanded ? "−" : "+"}</span>
          </button>
          {expanded && (
            <ul>
              {ev.rules.map((rule) => (
                <li key={rule.text}>
                  <span className={`rg-ic ${rule.ok ? "ok" : "no"}`} aria-hidden="true">
                    {rule.ok ? "✓" : "✕"}
                  </span>
                  <div>
                    <span className="sr-only">{rule.ok ? "Met: " : "Not met: "}</span>
                    {rule.text}
                    {!rule.ok && rule.blockers.length > 0 && (
                      <div className="rg-blockers">
                        Blocked by{" "}
                        {rule.blockers.slice(0, 6).map((o: Obligation, i: number) => (
                          <span key={o.id} title={`${o.text} (${o.state}, ${o.crit})`}>
                            <code>{o.code}</code> <em>{o.state}</em>
                            {i < Math.min(rule.blockers.length, 6) - 1 ? ", " : ""}
                          </span>
                        ))}
                        {rule.blockers.length > 6 ? ` and ${rule.blockers.length - 6} more` : ""}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="rg-cfoot">
        <span className="rg-sub">
          PMC: {v.pmc.pct}% · {v.pmc.note}
        </span>
        {(f.late80 > 0 || recovery) && (
          <button type="button" className={`rg-btn ${recovery ? "" : "rg-primary"}`} onClick={(e) => {
              e.stopPropagation();
              onRecovery();
            }}>
            {recovery ? "Remove recovery team" : "Test recovery team"}
          </button>
        )}
      </div>
    </article>
  );
}
