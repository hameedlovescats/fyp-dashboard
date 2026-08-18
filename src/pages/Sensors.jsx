function Sparkline({ values }) {
  const width = 180;
  const height = 48;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => `${(index / (values.length - 1)) * width},${height - ((value - min) / range) * (height - 8) - 4}`).join(" ");
  return <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true"><path d={`M ${points.replaceAll(" ", " L ")}`} /></svg>;
}

const sensorCards = [
  { label: "SOIL MOISTURE", value: "63%", values: [52,55,54,59,61,58,62,63] },
  { label: "CANOPY HUMIDITY", value: "78%", values: [69,72,74,71,75,77,76,78] },
  { label: "AIR TEMPERATURE", value: "28.4°C", values: [26,26.8,27.2,28.1,29,28.7,28.2,28.4] },
  { label: "LEAF WETNESS", value: "41%", values: [24,30,28,34,39,36,43,41] },
];

export default function Sensors() {
  return (
    <div className="feature-page">
      <div className="feature-page-head">
        <div><span className="eyebrow">SENSOR LAYER</span><h1>Connect the physical field.</h1></div>
        <p>This page is now designed as the IoT layer for AgriAI. The cards below are deliberately labelled demo telemetry until a real gateway or sensor feed is connected.</p>
      </div>

      <section className="sensor-banner">
        <span className="demo-chip">DEMO TELEMETRY · NOT LIVE HARDWARE</span>
        <h2>A place for soil, canopy and weather signals.</h2>
        <p>When hardware is connected, environmental readings can sit beside pest history and model risk — giving agronomists one operational view instead of separate dashboards.</p>
      </section>

      <div className="sensor-grid">
        {sensorCards.map((sensor) => (
          <article className="sensor-card" key={sensor.label}>
            <div className="sensor-card-top"><div><small>{sensor.label}</small><strong>{sensor.value}</strong></div><span className="sensor-state" /></div>
            <Sparkline values={sensor.values} />
          </article>
        ))}
      </div>

      <div className="feature-page-head" style={{ marginTop: 30, marginBottom: 14 }}>
        <div><span className="eyebrow">INTEGRATION BLUEPRINT</span><h1 style={{ fontSize: 30 }}>From sensor to decision.</h1></div>
      </div>

      <div className="pipeline">
        <div className="pipeline-step"><span>01 · EDGE</span><strong>Field sensors</strong><p>Temperature, humidity, moisture, traps or other crop-specific devices.</p></div>
        <div className="pipeline-step"><span>02 · INGEST</span><strong>Gateway / API</strong><p>Normalize readings, timestamps, field IDs and device health.</p></div>
        <div className="pipeline-step"><span>03 · FUSION</span><strong>AgriAI context</strong><p>Join environmental signals with pest history and field risk.</p></div>
        <div className="pipeline-step"><span>04 · ACTION</span><strong>Alerts & tasks</strong><p>Surface relevant observations to the field team without automating treatment decisions.</p></div>
      </div>

      <div className="integration-note"><strong>Current status:</strong> no live IoT source is connected in this FYP deployment. This interface is integration-ready presentation, not fabricated production telemetry.</div>
    </div>
  );
}
