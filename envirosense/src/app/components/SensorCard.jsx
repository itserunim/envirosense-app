import GaugeRing from "./GaugeRing";

/* Status visual configuration */
const STATUS_CFG = {
  good:      { label: "Good",     color: "#22c55e", bg: "rgba(34,197,94,0.13)"  },
  moderate:  { label: "Moderate", color: "#eab308", bg: "rgba(234,179,8,0.13)"  },
  unhealthy: { label: "Caution",  color: "#f97316", bg: "rgba(249,115,22,0.13)" },
  hazardous: { label: "Danger",   color: "#ef4444", bg: "rgba(239,68,68,0.13)"  },
  offline:   { label: "Offline",  color: "#9aafc7", bg: "rgba(163,177,198,0.13)" },
};

const TREND_SYMBOL = { up: "↑", down: "↓", stable: "→" };
const TREND_COLOR  = { up: "#f97316", down: "#22c55e", stable: "#9aafc7" };

/**
 * SensorCard
 * sensor = { id, name, subtitle, value, unit, percentage, status, icon, trend, decimals }
 */
export default function SensorCard({ sensor, style = {} }) {
  const {
    name,
    subtitle,
    value,
    unit,
    percentage,
    status,
    icon: Icon,
    trend = "stable",
    decimals = 0,
  } = sensor;

  const cfg          = STATUS_CFG[status] ?? STATUS_CFG.offline;
  const isOffline    = value === "N/A";
  const displayValue = isOffline ? "—" : typeof value === "number" ? value.toFixed(decimals) : String(value);

  /* Shrink font for long values */
  const valueFontSize = displayValue.length > 4 ? "0.75rem" : "1rem";

  return (
    <div
      className="neu-raised p-4 flex flex-col gap-3 animate-fadeUp"
      style={style}
    >
      {/* ── Row: icon + status badge ── */}
      <div className="flex items-center justify-between">
        <div
          className="neu-raised-circle flex items-center justify-center"
          style={{ width: 38, height: 38 }}
        >
          <Icon size={18} style={{ color: cfg.color }} />
        </div>

        <span
          className="text-[11px] font-semibold px-2 py-0.5 rounded-full tracking-wide"
          style={{ color: cfg.color, background: cfg.bg }}
        >
          {cfg.label}
        </span>
      </div>

      {/* ── Gauge ring ── */}
      <div className="flex justify-center">
        {/* Inset circular well */}
        <div
          className="neu-pressed-circle flex items-center justify-center"
          style={{ width: 112, height: 112 }}
        >
          {/* SVG gauge sits inside the well */}
          <div className="relative flex items-center justify-center" style={{ width: 100, height: 100 }}>
            {!isOffline ? (
              <>
                <GaugeRing percentage={percentage} color={cfg.color} size={100} strokeWidth={9} />
                {/* Centered value overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center leading-tight">
                  <span
                    className="font-bold tabular-nums"
                    style={{ fontSize: valueFontSize, color: "#31456a" }}
                  >
                    {displayValue}
                  </span>
                  <span className="text-[10px] font-medium" style={{ color: "#9aafc7" }}>
                    {unit}
                  </span>
                </div>
              </>
            ) : (
              // Offline state - show just the value without gauge
              <div className="flex flex-col items-center justify-center">
                <span
                  className="font-bold tabular-nums"
                  style={{ fontSize: "1.5rem", color: "#9aafc7" }}
                >
                  {displayValue}
                </span>
                <span className="text-[10px] font-medium" style={{ color: "#9aafc7" }}>
                  {unit}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Row: name + trend (only show trend if online) ── */}
      <div className="flex items-end justify-between gap-1">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight truncate" style={{ color: "#31456a" }}>
            {name}
          </p>
          <p className="text-[11px] leading-tight truncate mt-0.5" style={{ color: "#9aafc7" }}>
            {subtitle}
          </p>
        </div>
        {!isOffline && (
          <span
            className="text-base font-bold flex-shrink-0"
            style={{ color: TREND_COLOR[trend] ?? "#9aafc7" }}
            aria-label={trend}
          >
            {TREND_SYMBOL[trend] ?? "→"}
          </span>
        )}
      </div>
    </div>
  );
}