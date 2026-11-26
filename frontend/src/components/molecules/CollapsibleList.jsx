"use client";

import { useState } from "react";

/**
 * Sections that open and close one by one, with Expand all and Collapse all.
 * items: [{ id, summary, body, open? }] (summary and body are rendered nodes); heading and actions sit in the bar.
 */
export default function CollapsibleList({ heading, actions, items }) {
  const [open, setOpen] = useState(() => Object.fromEntries(items.map((i) => [i.id, Boolean(i.open)])));
  const setAll = (value) => setOpen(Object.fromEntries(items.map((i) => [i.id, value])));
  return (
    <>
      <div className="filters mt collapse-bar">
        {heading}
        <span className="spacer" />
        <button type="button" className="linkish small" onClick={() => setAll(true)}>
          Expand all
        </button>
        <button type="button" className="linkish small" onClick={() => setAll(false)}>
          Collapse all
        </button>
        {actions}
      </div>
      {items.map((item) => (
        <details
          key={item.id}
          className="comp-detail"
          open={Boolean(open[item.id])}
          onToggle={(e) => {
            const value = e.currentTarget.open;
            if (value !== Boolean(open[item.id])) setOpen((o) => ({ ...o, [item.id]: value }));
          }}
        >
          <summary>{item.summary}</summary>
          <div className="comp-detail-body">{item.body}</div>
        </details>
      ))}
    </>
  );
}
