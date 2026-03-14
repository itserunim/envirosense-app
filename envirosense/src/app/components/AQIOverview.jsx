import GaugeRing from "./GaugeRing";

/* AQI breakpoints (EPA-inspired) */
const AQI_LEVELS = [
  { max: 50,  label: "Good",                  color: "#22c55e", desc: "Air quality is excellent — enjoy outdoor activities freely." },
  { max: 100, label: "Moderate",               color: "#eab308", desc: "Acceptable air quality. Unusually sensitive individuals should limit prolonged exertion." },
  { max: 150, label: "Unhealthy (Sensitive)",  color: "#f97316", desc: "Sensitive groups may experience health effects. General public is less likely to be affected." },
  { max: 200, label: "Unhealthy",              color: "#ef4444", desc: "Everyone may begin to experience health effects. Sensitive groups should avoid outdoor exertion." },
  { max: 500, label: "Hazardous",              color: "#7c3aed", desc: "Health emergency conditions. The entire population is likely to be affected." },
];

function getLevel(aqi) {
  if (aqi === null) return { label: "Offline", color: "#9aafc7", desc: "Device is offline — waiting for connection..." };
  return AQI_LEVELS.find((l) => aqi <= l.max) ?? AQI_LEVELS[AQI_LEVELS.length - 1];
}

/**
 * AQIOverview — large card showing the composite Air Quality Index
 */
export default function AQIOverview({ aqi = null, lastUpdated = "", isOffline = false }) {
  const level      = getLevel(aqi);
  const percentage = aqi ? Math.min(100, (aqi / 300) * 100) : 0;

  /* Scale-bar gradient blends from green to the current status color */
  const scaleGradient = `linear-gradient(90deg, #22c55e 0%, ${level.color} 100%)`;

  return (
    <section className="neu-raised mx-4 p-5 flex items-center gap-5 mt-2">
      {/* ── Large gauge ── */}
      <div
        className="neu-pressed-circle flex-shrink-0 flex items-center justify-center"
        style={{ width: 146, height: 146 }}
      >
        <div className="relative flex items-center justify-center" style={{ width: 132, height: 132 }}>
          <GaugeRing percentage={percentage} color={level.color} size={132} strokeWidth={12} />

          <div className="absolute inset-0 flex flex-col items-center justify-center leading-none gap-0.5">
            <span
              className="font-black tabular-nums"
              style={{ fontSize: "2rem", color: "#31456a", lineHeight: 1 }}
            >
              {aqi !== null ? aqi : "--"}
            </span>
            <span
              className="font-bold uppercase tracking-widest"
              style={{ fontSize: "0.6rem", color: "#9aafc7" }}
            >
              AQI
            </span>
          </div>
        </div>
      </div>

      {/* ── Info panel ── */}
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        {/* Label */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#9aafc7" }}>
            Air Quality Index
          </p>
          <h2 className="font-extrabold text-lg leading-tight mt-0.5" style={{ color: level.color }}>
            {level.label}
          </h2>
        </div>

        {/* Description */}
        <p className="text-[11px] leading-relaxed" style={{ color: "#6b7fa3" }}>
          {level.desc}
        </p>

        {/* Scale bar - only show if online */}
        {!isOffline && (
          <div>
            <div className="neu-pressed-sm h-3 overflow-hidden" style={{ borderRadius: 6 }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${percentage}%`,
                  background: scaleGradient,
                  boxShadow: `0 0 8px ${level.color}88`,
                  transition: "width 0.9s cubic-bezier(0.4,0,0.2,1)",
                }}
              />
            </div>
          </div>
        )}

        {lastUpdated && (
          <p className="text-[10px]" style={{ color: "#b0bec5" }}>
            Updated {lastUpdated}
          </p>
        )}
      </div>
    </section>
  );
}