import LegacyScripts from "../components/LegacyScripts";

export default function Home() {
  return (
    <>
<header className="top">
  <div className="wrap">
    <div className="bar">
      <div className="brand">
        <img className="logo" src="frontend/public/Assets/Logo_Green.jpg" alt="Logo" width="48" height="48" />        
        <div className="brand-text">
          <h1>Compliance Assurance Engine</h1>
          <span className="sub">FIFA World Cup 2034 · PoC, sample data</span>
          </div>
      </div>
      <nav className="tabs" id="tabs" aria-label="Views"></nav>
      <div className="right">
        <span className="status" title="Programme date (simulated clock)"><i></i><b id="today"></b></span>
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
<main className="wrap" id="view"></main>
<div id="drawerRoot"></div>
<div id="toastRoot"></div>
<div id="tourRoot"></div>
      <LegacyScripts />
    </>
  );
}
