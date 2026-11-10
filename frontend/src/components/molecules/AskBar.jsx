"use client";

import { useState } from "react";
import { aiAsk } from "@/lib/assistant/chat";

/** One-line question box that sends to Nabd (opens the assistant panel). */
export default function AskBar({ placeholder = "Ask Nabd about FIFA requirements or assurance…" }) {
  const [q, setQ] = useState("");
  return (
    <form
      className="askbar"
      onSubmit={(e) => {
        e.preventDefault();
        if (!q.trim()) return;
        void aiAsk(q);
        setQ("");
      }}
    >
      <input aria-label="Ask Nabd" placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} />
      <button type="submit" className="primary" aria-label="Send">
        ↑
      </button>
    </form>
  );
}
