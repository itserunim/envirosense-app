"use client";

import { useState, useEffect, useRef } from "react";
import mqtt from "mqtt";
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
    displayRange: [400, 5000],   // gauge range (Arduino validation: 400–5000)
    thresholds: [800, 1500, 2500], // Arduino: <800 GOOD, <1500 MODERATE
  },
  {
    id: "co",
    name: "CO",
    subtitle: "Carbon Monoxide",
    unit: "ppm",
    icon: TbWind,
    decimals: 1,
    displayRange: [0, 1000],     // Arduino validation: 0–1000
    thresholds: [4.4, 9.4, 12.4],
  },
  {
    id: "voc",
    name: "VOC",
    subtitle: "Volatile Organics",
    unit: "ppm",
    icon: TbDroplet,
    decimals: 1,
    displayRange: [0, 100],      // Arduino MQ135 VOC: 0–100 ppm
    thresholds: [1.0, 3.0, 10.0], // Arduino: <1.0 GOOD, <3.0 MODERATE
  },
  {
    id: "pm25",
    name: "PM2.5",
    subtitle: "Dust Density",
    unit: "µg/m³",
    icon: TbCloud,
    decimals: 0,
    displayRange: [0, 1050],     // Arduino GP2Y1014: 0–5000, POOR cutoff 1050
    thresholds: [75, 150, 300],  // Arduino: <75 V.GOOD, <150 GOOD, <300 FAIR
  },
  {
    id: "temp",
    name: "Temperature",
    subtitle: "Ambient Temperature",
    unit: "°C",
    icon: TbThermometer,
    decimals: 1,
    displayRange: [-40, 85],    // Arduino BMP280 validation: -40–85
    thresholds: [26, 32, 38],   // comfort / warm / hot
  },
  {
    id: "pressure",
    name: "Pressure",
    subtitle: "Atmospheric Pressure",
    unit: "hPa",
    icon: TbGauge,
    decimals: 1,
    displayRange: [300, 1100],   // Arduino BMP280 validation: 300–1100
    thresholds: [1013, 1025, 1050],
  },
];

/* Realistic initial readings (matching Arduino baseline) */
const INITIAL_VALUES = {
  co2:      412,      // Arduino: MQ135 baseline ~400 + offset
  co:       0.8,
  voc:      0.5,      // Arduino VOC in ppm (MQ135 averaged)
  pm25:     50,       // Arduino GP2Y1014 dust density µg/m³
  temp:     28.5,     // Philippines typical (BMP280)
  pressure: 1013.2,
};

// ==================== MQTT CONFIG ====================
const MQTT_URL    = "wss://broker.hivemq.com:8884/mqtt";
const MQTT_KEY_MAP = {
  "envirosense/co2":         "co2",
  "envirosense/co":          "co",
  "envirosense/voc":         "voc",
  "envirosense/dust":        "pm25",
  "envirosense/temperature": "temp",
  "envirosense/pressure":    "pressure",
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

/** Composite AQI based on Arduino EnviroSense thresholds (CO2, VOC, Dust) */
function calcAQI({ pm25, co2, voc }) {
  // CO2-based (Arduino: <800 GOOD, <1500 MODERATE, else POOR)
  const co2Aqi =
    co2 <= 800  ? (50 / 800) * co2
    : co2 <= 1500 ? 50  + ((co2 - 800)  / 700)  * 50
    : co2 <= 2500 ? 100 + ((co2 - 1500) / 1000) * 50
    :               150 + ((co2 - 2500) / 2500) * 150;

  // VOC-based (Arduino: <1.0 GOOD, <3.0 MODERATE, else POOR)
  const vocAqi =
    voc <= 1.0 ? (50 / 1.0) * voc
    : voc <= 3.0  ? 50  + ((voc - 1.0) / 2.0) * 50
    : voc <= 10.0 ? 100 + ((voc - 3.0) / 7.0) * 50
    :               150 + ((voc - 10)  / 90)  * 150;

  // Dust-based (Arduino: <75 V.GOOD, <150 GOOD, <300 FAIR, <1050 POOR)
  const dustAqi =
    pm25 <= 75   ? (50 / 75) * pm25
    : pm25 <= 150  ? 50  + ((pm25 - 75)  / 75)  * 50
    : pm25 <= 300  ? 100 + ((pm25 - 150) / 150) * 50
    : pm25 <= 1050 ? 150 + ((pm25 - 300) / 750) * 50
    :                200 + ((pm25 - 1050) / 1000) * 100;

  return Math.round(Math.max(co2Aqi, vocAqi, dustAqi));
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
  const [values,       setValues]       = useState(INITIAL_VALUES);
  const [trends,       setTrends]       = useState(
    Object.fromEntries(Object.keys(INITIAL_VALUES).map((k) => [k, "stable"]))
  );
  const [lastUpdated,  setLastUpdated]  = useState("just now");
  const [uptimeSecs,   setUptimeSecs]   = useState(0);
  const [mqttStatus,   setMqttStatus]   = useState("connecting"); // "connecting" | "live" | "offline"
  const prevRef        = useRef(INITIAL_VALUES);
  const mqttLiveRef    = useRef(false); // true while MQTT is delivering data

  /* ── MQTT real-time sync ── */
  useEffect(() => {
    const client = mqtt.connect(MQTT_URL, {
      clientId:        `envirosense-web-${Math.random().toString(16).slice(2, 10)}`,
      clean:           true,
      reconnectPeriod: 5000,
      connectTimeout:  10000,
    });

    client.on("connect", () => {
      mqttLiveRef.current = true;
      setMqttStatus("live");
      Object.keys(MQTT_KEY_MAP).forEach((t) => client.subscribe(t));
      client.subscribe("envirosense/heartbeat");
    });

    client.on("reconnect",   () => { mqttLiveRef.current = false; setMqttStatus("connecting"); });
    client.on("disconnect",  () => { mqttLiveRef.current = false; setMqttStatus("offline");    });
    client.on("error",       () => { mqttLiveRef.current = false; setMqttStatus("offline");    });

    client.on("message", (topic, message) => {
      const payload = message.toString();

      /* Heartbeat → real device uptime */
      if (topic === "envirosense/heartbeat") {
        try {
          const hb = JSON.parse(payload);
          if (hb.uptime !== undefined) setUptimeSecs(Number(hb.uptime));
        } catch (_) {}
        return;
      }

      const key = MQTT_KEY_MAP[topic];
      if (!key) return;
      const val = parseFloat(payload);
      if (isNaN(val)) return;

      /* Update value */
      setValues((prev) => ({ ...prev, [key]: val }));

      /* Update trend for this key */
      setTrends((prev) => {
        const oldVal    = prevRef.current[key] ?? val;
        const d         = val - oldVal;
        const threshold = Math.abs(oldVal || 1) * 0.008;
        const trend     = Math.abs(d) < threshold ? "stable" : d > 0 ? "up" : "down";
        return { ...prev, [key]: trend };
      });

      prevRef.current = { ...prevRef.current, [key]: val };

      const now = new Date();
      setLastUpdated(
        now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );
    });

    return () => client.end(true);
  }, []);

  /* ── Simulation fallback (paused while MQTT is live) ── */
  useEffect(() => {
    const id = setInterval(() => {
      if (mqttLiveRef.current) return; // MQTT is active — skip simulation
      setValues((prev) => {
        const next = {
          co2:      walk(prev.co2,      18,   400,  2000),
          co:       walk(prev.co,       0.12, 0,    15),
          voc:      walk(prev.voc,      0.05, 0,    10),
          pm25:     walk(prev.pm25,     5,    0,    600),
          temp:     walk(prev.temp,     0.15, 20,   40),
          pressure: walk(prev.pressure, 0.25, 990,  1030),
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
    }, 2000);
    return () => clearInterval(id);
  }, []);

  /* ── Uptime counter (runs only when MQTT heartbeat not supplying it) ── */
  useEffect(() => {
    const id = setInterval(() => {
      if (mqttLiveRef.current) return;
      setUptimeSecs((s) => s + 1);
    }, 1000);
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
      <Header battery={78} connected={mqttStatus === "live"} />

      {/* Device status bar */}
      <DeviceStatusBar
        location={mqttStatus === "live" ? "Live Device" : "Simulation"}
        uptime={formatUptime(uptimeSecs)}
        syncing={mqttStatus === "connecting"}
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
            EnviroSense v1.0 &middot;
            <span style={{ color: mqttStatus === "live" ? "#22c55e" : mqttStatus === "connecting" ? "#eab308" : "#a3b1c6" }}>
              {mqttStatus === "live" ? " MQTT Live" : mqttStatus === "connecting" ? " MQTT Connecting…" : " Simulation"}
            </span>
          </p>
          <p className="text-[10px]" style={{ color: "#b0bec5" }}>
            Readings update every 2s &middot; {lastUpdated}
          </p>
        </div>
      </div>
    </div>
  );
}
