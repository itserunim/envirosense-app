/**
 * GaugeRing — SVG circular progress gauge
 * percentage : 0–100
 * color       : stroke color for the progress arc
 */
export default function GaugeRing({ percentage = 0, color = "#5b7ec9", size = 100, strokeWidth = 9 }) {
  const clamp  = Math.max(0, Math.min(100, percentage));
  const center = size / 2;
  const radius = center - strokeWidth / 2;         // keeps stroke inside the viewBox
  const circ   = 2 * Math.PI * radius;
  const offset = circ * (1 - clamp / 100);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label={`${Math.round(clamp)}%`}
      role="img"
    >
      {/* Background track */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="rgba(163, 177, 198, 0.35)"
        strokeWidth={strokeWidth}
      />

      {/* Progress arc — starts at 12 o'clock */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${center} ${center})`}
        style={{
          transition: "stroke-dashoffset 0.9s cubic-bezier(0.4,0,0.2,1), stroke 0.5s ease",
          filter: `drop-shadow(0 0 5px ${color}88)`,
        }}
      />
    </svg>
  );
}
