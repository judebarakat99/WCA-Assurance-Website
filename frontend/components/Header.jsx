"use client";

import Link from "next/link";
import {publicAssetUrl} from "../lib/assets.mjs";
import {usePathname} from "next/navigation";

const TABS=[
  ["/readiness","Readiness"],
  ["/control-tower","Control Tower"],
  ["/decisions-actions","Actions"],
  ["/design-review","Design"],
  ["/requirements-evidence","Compliance Intake"],
  ["/dossiers","Dossiers"],
];

function activeTab(pathname){
  const p=(pathname||"/").replace(/\/+$/,"")||"/";
  if(p==="/") return "/readiness";
  const hit=TABS.find(([href])=>p===href||p.startsWith(href+"/"));
  return hit?hit[0]:null;
}

export default function Header(){
  const pathname=usePathname();
  const cur=activeTab(pathname);
  const links=TABS.map(([href,label])=>(
    <Link key={href} href={href} aria-current={cur===href?"page":undefined}>{label}</Link>
  ));
  return (
    <header className="top">
      <div className="wrap">
        <div className="bar">
          <div className="brand">
            <img
              className="logo"
              src={publicAssetUrl("/Assets/شعار_الهيئة_العليا_لاستضافة_كأس_العالم_2034.svg.png",process.env.NEXT_PUBLIC_BASE_PATH || "")}
              alt="Logo"
              width="48"
              height="48"
            />
            <div className="brand-text">
              <h1>Compliance Assurance Engine</h1>
              <span className="sub">World Cup 2034</span>
            </div>
          </div>
          <nav className="tabs" id="tabs" aria-label="Views">{links}</nav>
          <div className="right">
            <details className="menu nav-menu" id="navMenu">
              <summary className="nav-toggle" aria-label="Open navigation menu">Menu</summary>
              <div className="pop r" id="tabsMenu">{links}</div>
            </details>
            <details className="menu" id="demoMenu">
              <summary className="btn">Demo</summary>
              <div className="pop r">
                <small>Guided</small>
                <button id="execStart" className="tourbtn">Executive demo · 3 min</button>
                <button id="tourStart">Full guided demo</button>
                <hr />
                <small>Simulation</small>
                <button id="advance" title="Move the simulated clock forward and run escalation rules">Advance 7 days</button>
                <button id="reset">Reset demo</button>
              </div>
            </details>
          </div>
        </div>
      </div>
    </header>
  );
}
