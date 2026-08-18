export default function FieldScene({ risk = 0, field = "FIELD NETWORK" }) {
  const riskPct = Math.max(0, Math.min(100, Math.round(Number(risk || 0) * 100)));

  return (
    <div className="field-scene" aria-label="Animated field intelligence visualization">
      <div className="field-sun" />
      <div className="field-horizon" />
      <div className="field-grid">
        {Array.from({ length: 14 }).map((_, i) => (
          <span key={i} style={{ "--row": i }} />
        ))}
      </div>
      <div className="field-scan-line" />
      <div className="field-particles" aria-hidden="true">
        {Array.from({ length: 18 }).map((_, i) => (
          <i
            key={i}
            style={{
              "--i": i,
              left: `${(i * 37) % 91}%`,
              top: `${16 + ((i * 29) % 70)}%`,
            }}
          />
        ))}
      </div>

      <div className="scene-card scene-card-top">
        <span>LIVE FIELD SCAN</span>
        <strong>{field}</strong>
      </div>

      <div className="scene-card scene-card-risk">
        <span>PEST RISK</span>
        <strong>{riskPct}%</strong>
        <div className="scene-meter"><i style={{ width: `${Math.max(4, riskPct)}%` }} /></div>
      </div>

      <div className="scene-orbit">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
