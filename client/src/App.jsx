import { useState } from "react";

const ZONE_COLORS = ["#6d5ce8", "#e79a56", "#42a982", "#e06d83"];

function Icon({ name, size = 18 }) {
  const paths = {
    check: <path d="m5 12 4 4L19 6" />,
    play: <path d="m8 5 12 7-12 7z" />,
    droplet: <><path d="M12 22a7 7 0 0 0 7-7c0-4-7-13-7-13S5 11 5 15a7 7 0 0 0 7 7Z" /><path d="M9 16a3 3 0 0 0 3 3" /></>,
    spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" /><path d="m19 14 1.1 2.9L23 18l-2.9 1.1L19 22l-1.1-2.9L15 18l2.9-1.1L19 14Z" /></>,
    thermometer: <><path d="M14 14.76V5a3 3 0 0 0-6 0v9.76a5 5 0 1 0 6 0Z" /><path d="M11 11v6" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    leaf: <><path d="M20 4c-9 0-15 4-15 11a5 5 0 0 0 5 5c7 0 11-6 10-16Z" /><path d="M5 20c2-5 6-8 12-11" /></>,
    refresh: <><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M5.6 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.4-3" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></>,
    chart: <><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-5 5" /></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
  };

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

async function runSimulation(days) {
  let response;
  try {
    response = await fetch("/api/simulation/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days, seed: 2024 }),
    });
  } catch {
    throw new Error("Can't reach the simulation server. Start the app from the pern-app folder with npm run dev.");
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || "The simulation request failed.");
  }
  return result;
}

function MoistureChart({ daily }) {
  const width = 720;
  const height = 250;
  const left = 43;
  const right = 18;
  const top = 18;
  const bottom = 32;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const pointX = (index) => left + (daily.length <= 1 ? plotWidth / 2 : (index / (daily.length - 1)) * plotWidth);
  const pointY = (value) => top + (1 - value / 60) * plotHeight;
  const series = daily[0]?.zones.map((zone, zoneIndex) => ({
    zone,
    color: ZONE_COLORS[zoneIndex],
    values: daily.map((day) => day.zones[zoneIndex].meanMoisturePct),
  })) ?? [];
  const dayTicks = [...new Set([0, Math.floor((daily.length - 1) / 2), daily.length - 1])];

  return (
    <div className="chart-wrap">
      <svg className="moisture-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Average soil moisture by zone over the simulated days">
        {[0, 20, 40, 60].map((value) => {
          const y = pointY(value);
          return (
            <g key={value}>
              <line x1={left} x2={width - right} y1={y} y2={y} className="chart-grid" />
              <text x={left - 10} y={y + 4} className="chart-axis-label" textAnchor="end">{value}%</text>
            </g>
          );
        })}
        {series.map((item) => {
          const points = item.values.map((value, index) => `${pointX(index)},${pointY(value)}`).join(" ");
          return (
            <g key={item.zone.zone}>
              {item.values.length > 1 && <polyline points={points} fill="none" stroke={item.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
              {item.values.map((value, index) => (
                <circle key={`${item.zone.zone}-${index}`} cx={pointX(index)} cy={pointY(value)} r={daily.length === 1 ? 4 : 2.7} fill="#fff" stroke={item.color} strokeWidth="2" />
              ))}
            </g>
          );
        })}
        {dayTicks.map((index) => (
          <text key={index} x={pointX(index)} y={height - 7} className="chart-axis-label" textAnchor="middle">
            Day {daily[index].day}
          </text>
        ))}
      </svg>
    </div>
  );
}

function MetricCard({ icon, label, value, note, variant }) {
  return (
    <article className="metric-card">
      <span className={`metric-icon ${variant}`}><Icon name={icon} size={19} /></span>
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
      <span className="metric-note">{note}</span>
    </article>
  );
}

export default function App() {
  const [days, setDays] = useState(7);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const startSimulation = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      setResult(await runSimulation(days));
    } catch (simulationError) {
      setError(simulationError.message);
    } finally {
      setLoading(false);
    }
  };

  const summary = result?.summary;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Terra home">
          <span className="brand-mark"><Icon name="leaf" size={19} /></span>
          <span>terra<span className="brand-period">.</span></span>
        </a>

        <p className="workspace-label">SMART IRRIGATION</p>
        <div className="workspace-card">
          <span className="workspace-avatar"><Icon name="droplet" size={17} /></span>
          <span className="workspace-copy"><strong>Field monitor</strong><small>Simulation workspace</small></span>
          <span className="online-indicator" title="Local simulator ready" />
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          <p className="nav-heading">TOOLS</p>
          <a className="nav-item is-active" href="#simulation" aria-current="page">
            <Icon name="chart" size={17} />
            <span>Field simulation</span>
          </a>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-icon"><Icon name="info" size={16} /></span>
            <p><strong>A design simulation</strong><br />Not a field-tested irrigation forecast.</p>
          </div>
          <div className="model-status">
            <span className="model-status-dot" />
            <span><strong>AI model</strong><small>Random forest · v2</small></span>
          </div>
        </div>
      </aside>

      <main className="main-content" id="simulation">
        <header className="topbar">
          <div className="breadcrumb"><span>Smart irrigation</span><span className="breadcrumb-divider">/</span><strong>Field simulation</strong></div>
          <div className="today-label"><span className="today-dot" /> Model ready</div>
        </header>

        <div className="page-content">
          <section className="welcome">
            <div className="welcome-copy">
              <p className="eyebrow">SIMULATION LAB <span className="eyebrow-divider">/</span> AI CONTROLLER</p>
              <h1>Grow with confidence<span className="wave">.</span></h1>
              <p className="welcome-subtitle">Explore soil moisture and irrigation decisions across four simulated soil zones.</p>
            </div>
            <div className="welcome-art" aria-hidden="true">
              <span className="art-sun" />
              <span className="art-hill art-hill-back" />
              <span className="art-hill art-hill-front" />
              <span className="art-sprout">✳</span>
              <span className="art-star">✦</span>
            </div>
          </section>

          <section className="simulation-controls" aria-labelledby="run-title">
            <div className="control-copy">
              <span className="control-icon"><Icon name="play" size={17} /></span>
              <div>
                <h2 id="run-title">Run a field simulation</h2>
                <p>Choose how many days to model. The same seed gives repeatable results.</p>
              </div>
            </div>
            <form className="run-form" onSubmit={startSimulation}>
              <label className="days-control">
                <span>Simulation length</span>
                <select value={days} onChange={(event) => setDays(Number(event.target.value))} disabled={loading}>
                  {[1, 3, 7, 14, 30].map((option) => <option value={option} key={option}>{option} {option === 1 ? "day" : "days"}</option>)}
                </select>
              </label>
              <button className="run-button" type="submit" disabled={loading}>
                {loading ? <span className="button-spinner" /> : <Icon name="play" size={15} />}
                <span>{loading ? "Simulating..." : "Run simulation"}</span>
              </button>
            </form>
          </section>

          {error && <div className="error-banner" role="alert"><Icon name="info" size={17} /><span>{error}</span></div>}

          {loading && !result && (
            <div className="loading-panel" role="status">
              <span className="loading-spinner" />
              <div><strong>Growing your forecast...</strong><span>Running the AI controller against simulated weather.</span></div>
            </div>
          )}

          {result && summary ? (
            <>
              <section className="metrics-grid" aria-label="Simulation summary">
                <MetricCard icon="droplet" variant="metric-icon-blue" label="Water used" value={`${summary.waterLitres.toLocaleString()} L`} note={`Across ${result.days} simulated ${result.days === 1 ? "day" : "days"}`} />
                <MetricCard icon="spark" variant="metric-icon-violet" label="Irrigation events" value={summary.irrigationEvents.toLocaleString()} note="Valve activations across zones" />
                <MetricCard icon="thermometer" variant="metric-icon-green" label="Average soil moisture" value={`${summary.meanMoisturePct}%`} note="Mean of all simulated readings" />
                <MetricCard icon="leaf" variant="metric-icon-peach" label="Comfort-range hours" value={`${summary.comfortHoursPct}%`} note={`${summary.stressHoursPct}% stress hours · below 20% moisture`} />
              </section>

              <section className="results-panel" aria-labelledby="moisture-title">
                <div className="panel-header">
                  <div>
                    <p className="section-kicker">SOIL CONDITIONS</p>
                    <h2 id="moisture-title">Moisture across the field</h2>
                    <p className="panel-subtitle">Average soil moisture by zone through the simulation</p>
                  </div>
                  <span className="seed-chip"><Icon name="refresh" size={14} /> Repeatable · Seed {result.seed}</span>
                </div>
                <MoistureChart daily={result.daily} />
                <div className="chart-legend">
                  {result.zones.map((zone, index) => (
                    <span className="legend-item" key={zone.zone}><i style={{ backgroundColor: ZONE_COLORS[index] }} />Zone {zone.zone} · {zone.soil}</span>
                  ))}
                </div>
              </section>

              <section className="zones-section" aria-labelledby="zones-title">
                <div className="section-heading">
                  <div>
                    <p className="section-kicker">ZONE BREAKDOWN</p>
                    <h2 id="zones-title">How each soil responded</h2>
                  </div>
                  <span className="model-badge"><Icon name="spark" size={14} /> {result.model}</span>
                </div>
                <div className="zones-grid">
                  {result.zones.map((zone, index) => (
                    <article className="zone-card" key={zone.zone}>
                      <div className="zone-card-top">
                        <span className="zone-marker" style={{ backgroundColor: ZONE_COLORS[index] }}>{zone.zone}</span>
                        <span className="soil-tag">{zone.soil} soil</span>
                      </div>
                      <div className="zone-moisture">{zone.meanMoisturePct}<span>%</span></div>
                      <div className="zone-moisture-label">average moisture</div>
                      <div className="zone-meter" role="progressbar" aria-label={`Zone ${zone.zone} average moisture`} aria-valuenow={zone.meanMoisturePct} aria-valuemin={0} aria-valuemax={60}>
                        <span style={{ width: `${Math.min(zone.meanMoisturePct / 60 * 100, 100)}%`, backgroundColor: ZONE_COLORS[index] }} />
                      </div>
                      <div className="zone-stats">
                        <span><Icon name="droplet" size={14} /><strong>{zone.waterLitres.toLocaleString()} L</strong><small>water</small></span>
                        <span><Icon name="clock" size={14} /><strong>{zone.irrigationEvents}</strong><small>events</small></span>
                      </div>
                      <div className="zone-final">Final moisture <strong>{zone.finalMoisturePct}%</strong></div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="safety-strip">
                <span className="safety-icon"><Icon name="shield" size={18} /></span>
                <p><strong>Safety rules are active.</strong> The simulation applies a 6-hour valve lockout, a 90-minute daily cap per zone, and closes valves on invalid sensor readings.</p>
              </section>
            </>
          ) : !loading ? (
            <section className="empty-panel">
              <span className="empty-icon"><Icon name="chart" size={24} /></span>
              <h2>Your field report starts here</h2>
              <p>Run a simulation to see predicted soil moisture, irrigation activity, and water use for each zone.</p>
              <span className="empty-note"><Icon name="info" size={14} /> Uses synthetic weather and assumed soil properties.</span>
            </section>
          ) : null}

          <footer className="page-footer">Simulation only <span>·</span> Soil constants are assumptions <span>·</span> Validate with real field data</footer>
        </div>
      </main>
    </div>
  );
}
