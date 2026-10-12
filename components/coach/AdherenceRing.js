export default function AdherenceRing({ logged, scheduled, flagged }) {
  const pct = scheduled > 0 ? Math.min(logged / scheduled, 1) : 0;
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ position: "relative", width: 44, height: 44, flexShrink: 0 }}>
        <svg width="44" height="44" viewBox="0 0 44 44" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="22" cy="22" r={radius} fill="none" stroke="var(--line)" strokeWidth="4" />
          {scheduled > 0 && (
            <circle
              cx="22" cy="22" r={radius}
              fill="none" stroke="var(--moss-deep)" strokeWidth="4"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
            />
          )}
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 700, color: "var(--ink)",
        }}>
          {scheduled > 0 ? `${logged}/${scheduled}` : "—"}
        </div>
      </div>

      {flagged > 0 && (
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: "var(--rust)", color: "var(--card)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 700, flexShrink: 0,
        }}>
          {flagged}
        </div>
      )}
    </div>
  );
}
