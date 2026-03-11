"use client";

import { useState, useEffect, useRef } from "react";
import { TbLeaf, TbWind, TbDroplet, TbCloud, TbThermometer, TbGauge } from "react-icons/tb";

import Header          from "./components/Header";
import DeviceStatusBar from "./components/DeviceStatusBar";
import AQIOverview     from "./components/AQIOverview";
import SensorCard      from "./components/SensorCard";

const SENSORS = [
  {
    id: "co2",
    name: "CO2",
    subtitle: "Carbon Dioxide",
    unit: "ppm",
    icon: TbLeaf,
    decimals: 0,
    displayRange: [400, 2000],   // gauge range
    thresholds: [800, 1200, 2500], // good / moderate / unhealthy cutoffs
  },
  {
    id: "co",
    name: "CO",
    subtitle: "Carbon Monoxide",
    unit: "ppm",
    icon: TbWind,
    decimals: 1,
    displayRange: [0, 15],
    thresholds: [4.4, 9.4, 12.4],
  },
  {
    id: "voc",
    name: "VOC",
    subtitle: "Volatile Organics",
    unit: "ppb",
    icon: TbDroplet,
    decimals: 0,
    displayRange: [0, 600],
    thresholds: [220, 660, 2200],
  },
  {
    id: "pm25",
    name: "PM2.5",
    subtitle: "Fine Particles",
    unit: "µg/m³",
    icon: TbCloud,
    decimals: 1,
    displayRange: [0, 60],
    thresholds: [12, 35.4, 55.4],
  },
  {
    id: "temp",
    name: "Temperature",
    subtitle: "Ambient Temperature",
    unit: "°C",
    icon: TbThermometer,
    decimals: 1,
    displayRange: [0, 50],
    thresholds: [26, 32, 38],  // comfort / warm / hot
  },
  {
    id: "pressure",
    name: "Pressure",
    subtitle: "Atmospheric Pressure",
    unit: "hPa",
    icon: TbGauge,
    decimals: 1,
    displayRange: [970, 1050],
    thresholds: [1025, 1040, 1050],
  },
];

/* Realistic initial readings */
const INITIAL_VALUES = {
  co2:      412,
  co:       0.8,
  voc:      85,
  pm25:     7.2,
  temp:     24.5,
  pressure: 1013.2,
};

/** Clamp-bounded random walk */
function walk(v, step, min, max) {
  return Math.min(max, Math.max(min, v + (Math.random() - 0.5) * step * 2));
}

/** Derive status label from sensor id + current value */
function getStatus(id, value) {
  if (id === "temp") {
    if (value >= 18 && value <= 26) return "good";
    if ((value >= 10 && value < 18) || (value > 26 && value <= 32)) return "moderate";
    if ((value > 32 && value <= 38) || (value >= 5 && value < 10))  return "unhealthy";
    return "hazardous";
  }
  if (id === "pressure") {
    if (value >= 995 && value <= 1025) return "good";
    if ((value >= 980 && value < 995) || (value > 1025 && value <= 1040)) return "moderate";
    return "unhealthy";
  }
  const [t1, t2, t3] = SENSORS.find((s) => s.id === id)?.thresholds ?? [0, 0, 0];
  if (value <= t1) return "good";
  if (value <= t2) return "moderate";
  if (value <= t3) return "unhealthy";
  return "hazardous";
}

/** Map value onto 0â€“100% of the sensor's display range */
function toPercent(id, value) {
  const { displayRange: [min, max] } = SENSORS.find((s) => s.id === id);
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}

/** Simplified composite AQI (EPA PM2.5 breakpoints + CO/VOC influence) */
function calcAQI({ pm25, co, voc }) {
  const pm25Aqi =
    pm25 <= 12    ? (50  / 12)   * pm25
    : pm25 <= 35.4 ? 50  + ((pm25 - 12)    / 23.4)  * 50
    : pm25 <= 55.4 ? 100 + ((pm25 - 35.4)  / 20)    * 50
    : pm25 <= 150.4? 150 + ((pm25 - 55.4)  / 95)    * 50
    :                200 + ((pm25 - 150.4) / 100)   * 100;

  const coAqi =
    co <= 4.4  ? (50 / 4.4) * co
    : co <= 9.4  ? 50 + ((co - 4.4) / 5)   * 50
    : co <= 12.4 ? 100 + ((co - 9.4) / 3)  * 50
    :              150;

  const vocAqi =
    voc <= 220 ? (50 / 220) * voc
    : voc <= 660 ? 50 + ((voc - 220) / 440) * 50
    :              100;

  return Math.round(Math.max(pm25Aqi, coAqi * 0.6, vocAqi * 0.4));
}

/** Derive a health recommendation message from the worst sensor status */
function getRecommendation(sensorList) {
  const worst = sensorList.reduce((acc, s) => {
    const rank = { good: 0, moderate: 1, unhealthy: 2, hazardous: 3 };
    return rank[s.status] > rank[acc] ? s.status : acc;
  }, "good");

  switch (worst) {
    case "hazardous": return { text: "Hazardous conditions detected — seek clean air immediately.", color: "#ef4444" };
    case "unhealthy": return { text: "Some readings are elevated — consider limiting outdoor exposure.", color: "#f97316" };
    case "moderate":  return { text: "Air quality is acceptable. Sensitive individuals should take caution.", color: "#eab308" };
    default:          return { text: "Air quality is excellent — enjoy your environment!", color: "#22c55e" };
  }
}

/** Format elapsed seconds to "Xh Ym" uptime string */
function formatUptime(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h}h ${m}m`;
}

export default function Home() {
  const [values,      setValues]      = useState(INITIAL_VALUES);
  const [trends,      setTrends]      = useState(
    Object.fromEntries(Object.keys(INITIAL_VALUES).map((k) => [k, "stable"]))
  );
  const [lastUpdated, setLastUpdated] = useState("just now");
  const [uptimeSecs,  setUptimeSecs]  = useState(0);
  const prevRef = useRef(INITIAL_VALUES);

  /* Live data simulation */
  useEffect(() => {
    const id = setInterval(() => {
      setValues((prev) => {
        const next = {
          co2:      walk(prev.co2,      18,  350, 1800),
          co:       walk(prev.co,       0.12, 0,  12),
          voc:      walk(prev.voc,       7,   0,  500),
          pm25:     walk(prev.pm25,     0.7,  0,  55),
          temp:     walk(prev.temp,     0.15, 10, 42),
          pressure: walk(prev.pressure, 0.25, 975, 1045),
        };

        const newTrends = {};
        for (const k of Object.keys(next)) {
          const d = next[k] - prev[k];
          const threshold = Math.abs(prev[k] || 1) * 0.008;
          newTrends[k] = Math.abs(d) < threshold ? "stable" : d > 0 ? "up" : "down";
        }
        setTrends(newTrends);
        prevRef.current = prev;

        const now = new Date();
        setLastUpdated(
          now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        );

        return next;
      });
    }, 3000);

    return () => clearInterval(id);
  }, []);

  /* Uptime counter */
  useEffect(() => {
    const id = setInterval(() => setUptimeSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  /* Derived data */
  const aqi = calcAQI(values);

  const enrichedSensors = SENSORS.map((cfg) => ({
    ...cfg,
    value:      values[cfg.id],
    percentage: toPercent(cfg.id, values[cfg.id]),
    status:     getStatus(cfg.id, values[cfg.id]),
    trend:      trends[cfg.id],
  }));

  const recommendation = getRecommendation(enrichedSensors);

  return (
    <div style={{ background: "var(--neu-bg)", minHeight: "100vh", paddingBottom: "1.5rem" }}>

      {/* Header */}
      <Header battery={78} connected />

      {/* Device status bar */}
      <DeviceStatusBar
        location="Outdoor"
        uptime={formatUptime(uptimeSecs)}
        syncing={false}
      />

      {/* AQI overview */}
      <AQIOverview aqi={aqi} lastUpdated={lastUpdated} />

      {/* Recommendation banner */}
      <div className="px-4 mt-4">
        <div
          className="neu-pressed px-4 py-3"
          style={{ borderRadius: 14 }}
        >
          <p className="text-xs font-medium leading-relaxed" style={{ color: recommendation.color }}>
            {recommendation.text}
          </p>
        </div>
      </div>

      {/* Section heading */}
      <div className="px-4 mt-5 mb-3">
        <h2
          className="text-[11px] font-bold uppercase tracking-widest"
          style={{ color: "#9aafc7" }}
        >
          Sensor Readings
        </h2>
      </div>

      {/* Sensor grid  (2 col mobile â†’ 3 col sm+) */}
      <div className="px-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {enrichedSensors.map((sensor, i) => (
          <SensorCard
            key={sensor.id}
            sensor={sensor}
            style={{ animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 mt-6">
        <div
          className="neu-pressed flex flex-col items-center justify-center py-3 gap-0.5"
          style={{ borderRadius: 14 }}
        >
          <p className="text-[11px] font-semibold" style={{ color: "#9aafc7" }}>
            EnviroSense v1.0
          </p>
          <p className="text-[10px]" style={{ color: "#b0bec5" }}>
            Readings update every 3s &middot; {lastUpdated}
          </p>
        </div>
      </div>
    </div>
  );
}
