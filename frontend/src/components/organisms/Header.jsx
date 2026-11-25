"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/atoms/ThemeToggle";
import { publicAssetUrl } from "@/lib/assets.mjs";
import { resetMapUi, rerender } from "@/lib/store/state";
import { resetAssessments } from "@/lib/store/assessments";
import { clearIntake } from "@/lib/store/intake";
import { startTour, ASSURANCE, ASSURANCE_FULL } from "@/lib/tour/player";
import { toast } from "@/lib/ui/toast";

// Primary sections. `also` lists other paths that belong to a section.
const TABS = [
  { href: "/", label: "Assurance map" },
  { href: "/review", label: "Review queue" },
  { href: "/intake", label: "Intake" },
  { href: "/reports", label: "Reports" },
  { href: "/compliance", label: "Requirements", also: ["/facilities"] },
];

const LOGO = publicAssetUrl("/Assets/saudi-2034-logo.svg", process.env.NEXT_PUBLIC_BASE_PATH || "");

function activeTab(pathname) {
  const p = (pathname || "/").replace(/\/+$/, "") || "/";
  const within = (base) => p === base || p.startsWith(`${base}/`);
  const hit = TABS.find((t) => (t.href === "/" ? p === "/" : within(t.href) || (t.also || []).some(within)));
  return hit ? hit.href : null;
}

function resetDemo() {
  resetAssessments();
  resetMapUi();
  void clearIntake();
  window.WNSTwin?.reset(); // the 3D design review on King Salman International's page
  rerender();
  toast("Demo reset. Assessments, applied changes and intake documents cleared.");
}

// Close open header menus on an outside click, a menu item click or Escape.
function useMenuDismiss(ref) {
  useEffect(() => {
    const closeAll = () => ref.current?.querySelectorAll("details.menu[open]").forEach((d) => d.removeAttribute("open"));
    const onClick = (e) => {
      ref.current?.querySelectorAll("details.menu[open]").forEach((d) => {
        // Reset demo asks for a second click, so it closes the menu itself (ResetButton).
        const item = e.target.closest(".pop button,.pop a");
        if (!d.contains(e.target) || (item && item.id !== "reset")) d.removeAttribute("open");
      });
    };
    const onKey = (e) => e.key === "Escape" && closeAll();
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref]);
}

// "Reset demo" asks for a second click within three seconds.
function ResetButton() {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      id="reset"
      className={armed ? "danger" : undefined}
      onClick={(e) => {
        if (armed) {
          setArmed(false);
          e.currentTarget.closest("details")?.removeAttribute("open");
          resetDemo();
        } else {
          setArmed(true);
        }
      }}
    >
      {armed ? "Click again to reset" : "Reset demo"}
    </button>
  );
}

export default function Header() {
  const ref = useRef(null);
  useMenuDismiss(ref);
  const current = activeTab(usePathname());
  const links = TABS.map(({ href, label }) => (
    <Link key={href} href={href} aria-current={current === href ? "page" : undefined}>
      {label}
    </Link>
  ));
  return (
    <header className="top" ref={ref}>
      <div className="wrap">
        <div className="bar">
          <div className="brand">
            <img className="logo" src={LOGO} alt="Saudi 2034" width="44" height="41" />
            <div className="brand-text">
              <h1>Venue Compliance Hub</h1>
              <span className="sub">World Cup 2034</span>
            </div>
          </div>
          <nav className="tabs" id="tabs" aria-label="Views">
            {links}
          </nav>
          <div className="right">
            <ThemeToggle />
            <details className="menu nav-menu" id="navMenu">
              <summary className="nav-toggle" aria-label="Open navigation menu">
                Menu
              </summary>
              <div className="pop r" id="tabsMenu">
                {links}
              </div>
            </details>
            <details className="menu" id="demoMenu">
              <summary className="btn">Demo</summary>
              <div className="pop r">
                <small>Guided</small>
                <button type="button" id="execStart" className="tourbtn" onClick={() => startTour(ASSURANCE)}>
                  Assurance demo · 4 min
                </button>
                <button type="button" id="tourStart" onClick={() => startTour(ASSURANCE_FULL)}>
                  Full assurance demo
                </button>
                <hr />
                <ResetButton />
              </div>
            </details>
          </div>
        </div>
      </div>
    </header>
  );
}
