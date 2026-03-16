"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { TbLeaf, TbWind, TbDroplet, TbCloud, TbThermometer, TbGauge } from "react-icons/tb";

import Header from "./components/Header";
import DeviceStatusBar from "./components/DeviceStatusBar";
import AQIOverview from "./components/AQIOverview";
import SensorCard from "./components/SensorCard";

const SENSORS = [
  {
    id: "co2",
    name: "CO2",
    subtitle: "Carbon Dioxide",
    unit: "ppm",
    icon: TbLeaf,
    decimals: 0,
    displayRange: [400, 5000],
    thresholds: [800, 1500, 2500],
  },
  {
    id: "co",
    name: "CO",
    subtitle: "Carbon Monoxide",
    unit: "ppm",
    icon: TbWind,
    decimals: 1,
    displayRange: [0, 1000],
    thresholds: [4.0, 9.0, 35.0],
  },
  {
    id: "voc",
    name: "VOC",
    subtitle: "Volatile Organics",
    unit: "ppm",
    icon: TbDroplet,
    decimals: 1,
    displayRange: [0, 100],
    thresholds: [0.5, 1.0, 3.0],
  },
  {
    id: "pm25",
    name: "PM2.5",
    subtitle: "Dust Density",
    unit: "µg/m³",
    icon: TbCloud,
    decimals: 0,
    displayRange: [0, 1050],
    thresholds: [75, 150, 300],
  },
  {
    id: "temp",
    name: "Temperature",
    subtitle: "Ambient Temperature",
    unit: "°C",
    icon: TbThermometer,
    decimals: 1,
    displayRange: [-40, 85],
    thresholds: [18, 26, 32, 38],
  },
  {
    id: "pressure",
    name: "Pressure",
    subtitle: "Atmospheric Pressure",
    unit: "hPa",
    icon: TbGauge,
    decimals: 1,
    displayRange: [300, 1100],
    thresholds: [980, 995, 1025, 1040],
  },
];

// Initial values - will be overwritten by real data or N/A
const INITIAL_VALUES = {
  co2: "N/A",
  co: "N/A",
  voc: "N/A",
  pm25: "N/A",
  temp: "N/A",
  pressure: "N/A",
};

/** Derive status label from sensor id + current value */
function getStatus(id, value) {
  if (value === "N/A") return "offline";
  
  if (id === "temp") {
    if (value >= 18 && value <= 26) return "good";
    if ((value >= 10 && value < 18) || (value > 26 && value <= 32)) return "moderate";
    if ((value > 32 && value <= 38) || (value >= 5 && value < 10)) return "unhealthy";
    return "hazardous";
  }
  
  if (id === "pressure") {
    if (value >= 995 && value <= 1025) return "good";
    if ((value >= 980 && value < 995) || (value > 1025 && value <= 1040)) return "moderate";
    return "unhealthy";
  }
  
  const sensor = SENSORS.find(s => s.id === id);
  if (!sensor) return "offline";
  
  const [t1, t2, t3] = sensor.thresholds;
  
  if (value <= t1) return "good";
  if (value <= t2) return "moderate";
  if (value <= t3) return "unhealthy";
  return "hazardous";
}

/** Map value onto 0–100% of the sensor's display range */
function toPercent(id, value) {
  if (value === "N/A") return 0;
  
  const sensor = SENSORS.find(s => s.id === id);
  if (!sensor) return 0;
  
  const [min, max] = sensor.displayRange;
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}

/** Composite AQI based on Arduino EnviroSense thresholds */
function calcAQI({ pm25, co2, voc }) {
  if (pm25 === "N/A" || co2 === "N/A" || voc === "N/A") return null;
  
  const co2Aqi =
    co2 <= 800 ? (50 / 800) * co2
    : co2 <= 1500 ? 50 + ((co2 - 800) / 700) * 50
    : co2 <= 2500 ? 100 + ((co2 - 1500) / 1000) * 50
    : 150 + ((co2 - 2500) / 2500) * 150;

  const vocAqi =
    voc <= 0.5 ? (50 / 0.5) * voc
    : voc <= 1.0 ? 50 + ((voc - 0.5) / 0.5) * 50
    : voc <= 3.0 ? 100 + ((voc - 1.0) / 2.0) * 50
    : 150 + ((voc - 3.0) / 97) * 150;

  const pm25Aqi =
    pm25 <= 75 ? (50 / 75) * pm25
    : pm25 <= 150 ? 50 + ((pm25 - 75) / 75) * 50
    : pm25 <= 300 ? 100 + ((pm25 - 150) / 150) * 50
    : pm25 <= 1050 ? 150 + ((pm25 - 300) / 750) * 50
    : 200 + ((pm25 - 1050) / 1000) * 100;

  return Math.round(Math.max(co2Aqi, vocAqi, pm25Aqi));
}

/** Derive a health recommendation message from the worst sensor status */
function getRecommendation(sensorList) {
  const allOffline = sensorList.every(s => s.value === "N/A");
  if (allOffline) {
    return { text: "Device is offline — waiting for connection...", color: "#9aafc7" };
  }
  
  const worst = sensorList.reduce((acc, s) => {
    if (s.value === "N/A") return acc;
    const rank = { good: 0, moderate: 1, unhealthy: 2, hazardous: 3 };
    return rank[s.status] > rank[acc] ? s.status : acc;
  }, "good");

  const recommendations = {
    hazardous: { text: "Hazardous conditions detected — seek clean air immediately.", color: "#ef4444" },
    unhealthy: { text: "Some readings are elevated — consider limiting outdoor exposure.", color: "#f97316" },
    moderate: { text: "Air quality is acceptable. Sensitive individuals should take caution.", color: "#eab308" },
    good: { text: "Air quality is excellent — enjoy your environment!", color: "#22c55e" }
  };
  
  return recommendations[worst] || recommendations.good;
}

/** Format elapsed seconds to "Xh Ym" uptime string */
function formatUptime(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h}h ${m}m`;
}

export default function Home() {
  const [values, setValues] = useState(INITIAL_VALUES);
  const [trends, setTrends] = useState({});
  const [lastUpdated, setLastUpdated] = useState("—");
  const [uptimeSecs, setUptimeSecs] = useState(0);
  const [deviceStatus, setDeviceStatus] = useState("offline");
  const [isWaking, setIsWaking] = useState(false);
  
  const pollingRef = useRef(null);
  const sensorPollingRef = useRef(null);

  // Fetch device status from API
  const fetchDeviceStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/envirosense?action=status');
      const data = await response.json();
      
      if (data.success && data.data) {
        const newStatus = data.data.online ? "online" : "offline";
        setDeviceStatus(newStatus);
        if (data.data.uptime) setUptimeSecs(data.data.uptime);
        
        // If device goes offline, clear values to N/A
        if (!data.data.online) {
          setValues(INITIAL_VALUES);
          setLastUpdated("—");
        }
      } else {
        setDeviceStatus("offline");
        setValues(INITIAL_VALUES);
        setLastUpdated("—");
      }
    } catch (error) {
      console.error('Failed to fetch device status:', error);
      setDeviceStatus("offline");
      setValues(INITIAL_VALUES);
      setLastUpdated("—");
    }
  }, []);

  // Fetch sensor data from API (every 3 seconds when online)
  const fetchSensorData = useCallback(async () => {
    if (deviceStatus !== "online") return;
    
    try {
      const response = await fetch('/api/envirosense?action=sensors');
      const data = await response.json();
      
      if (data.success && data.data) {
        setValues(prev => {
          // Calculate trends only if we have valid numbers
          const newTrends = {};
          Object.keys(data.data).forEach(key => {
            if (typeof prev[key] === 'number' && typeof data.data[key] === 'number') {
              const diff = data.data[key] - prev[key];
              const threshold = Math.abs(prev[key] || 1) * 0.008;
              newTrends[key] = Math.abs(diff) < threshold ? "stable" : diff > 0 ? "up" : "down";
            }
          });
          setTrends(newTrends);
          
          return { ...prev, ...data.data };
        });
        
        const now = new Date();
        setLastUpdated(
          now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        );
      }
    } catch (error) {
      console.error('Failed to fetch sensor data:', error);
    }
  }, [deviceStatus]);

  // Wake display
  const wakeDisplay = useCallback(async (sensorId = null) => {
    if (deviceStatus !== "online") return;
    
    setIsWaking(true);
    
    try {
      await fetch('/api/envirosense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'wakeDisplay',
          sensorId: sensorId
        })
      });
      
      setTimeout(() => setIsWaking(false), 500);
    } catch (error) {
      console.error('Failed to wake display:', error);
      setIsWaking(false);
    }
  }, [deviceStatus]);

  // Initial setup and polling
  useEffect(() => {
    fetchDeviceStatus();
    pollingRef.current = setInterval(fetchDeviceStatus, 10000);
    
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (sensorPollingRef.current) clearInterval(sensorPollingRef.current);
    };
  }, [fetchDeviceStatus]);

  // Handle sensor polling
  useEffect(() => {
    if (sensorPollingRef.current) clearInterval(sensorPollingRef.current);

    if (deviceStatus === "online") {
      // Online mode - fetch real data every 3 seconds
      fetchSensorData();
      sensorPollingRef.current = setInterval(fetchSensorData, 3000);
    } else {
      // Offline mode - ensure values are N/A
      setValues(INITIAL_VALUES);
      setLastUpdated("—");
    }
  }, [deviceStatus, fetchSensorData]);

  const aqi = calcAQI(values);
  
  const enrichedSensors = SENSORS.map(cfg => ({
    ...cfg,
    value: values[cfg.id],
    percentage: toPercent(cfg.id, values[cfg.id]),
    status: getStatus(cfg.id, values[cfg.id]),
    trend: trends[cfg.id] || "stable",
  }));

  const recommendation = getRecommendation(enrichedSensors);

  return (
    <div style={{ background: "var(--neu-bg)", minHeight: "100vh", paddingBottom: "1.5rem" }}>
      
      {/* Header */}
      <Header connected={deviceStatus === "online"} />

      {/* Device status bar */}
      <DeviceStatusBar
        location="Indoor"
        isOnline={deviceStatus === "online"}
        syncing={false}
        uptime={formatUptime(uptimeSecs)}
      />

      {/* AQI overview */}
      <AQIOverview 
        aqi={aqi} 
        lastUpdated={lastUpdated}
        isOffline={deviceStatus !== "online"}
      />

      {/* Recommendation banner */}
      <div className="px-4 mt-4">
        <div className="neu-pressed px-4 py-3" style={{ borderRadius: 14 }}>
          <p className="text-xs font-medium leading-relaxed" style={{ color: recommendation.color }}>
            {recommendation.text}
          </p>
        </div>
      </div>

      {/* Section heading */}
      <div className="px-4 mt-5 mb-3">
        <h2 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#9aafc7" }}>
          Sensor Readings {deviceStatus === "online" ? "(Click to wake OLED)" : "(Offline)"}
        </h2>
      </div>

      {/* Sensor grid */}
      <div className="px-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {enrichedSensors.map((sensor, i) => (
          <div
            key={sensor.id}
            onClick={() => deviceStatus === "online" && wakeDisplay(sensor.id)}
            className={deviceStatus === "online" ? "cursor-pointer hover:scale-105 transition-transform" : ""}
          >
            <SensorCard
              sensor={sensor}
              style={{ animationDelay: `${i * 60}ms` }}
            />
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 mt-6">
        <div className="neu-pressed flex flex-col items-center justify-center py-3 gap-0.5" style={{ borderRadius: 14 }}>
          <p className="text-[11px] font-semibold" style={{ color: "#9aafc7" }}>
            EnviroSense v1.0 &middot;
            <span style={{ 
              color: deviceStatus === "online" ? "#22c55e" : "#a3b1c6" 
            }}>
              {deviceStatus === "online" ? " ESP32-C3 Online" : " Offline"}
            </span>
          </p>
          <p className="text-[10px]" style={{ color: "#b0bec5" }}>
            {deviceStatus === "online" ? "Live data" : "No data"} &middot; updates every 3s &middot; {lastUpdated}
          </p>
        </div>
      </div>
    </div>
  );
}