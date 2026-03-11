"use client";

import { useEffect, useState } from "react";
import { TbWifi, TbBluetooth, TbBattery, TbBattery1, TbBattery2, TbBattery3, TbBattery4 } from "react-icons/tb";

function BatteryIcon({ level }) {
  const props = { size: 16 };
  if (level >= 85) return <TbBattery4 {...props} />;
  if (level >= 60) return <TbBattery3 {...props} />;
  if (level >= 35) return <TbBattery2 {...props} />;
  if (level >= 10) return <TbBattery1 {...props} />;
  return <TbBattery {...props} />;
}

export default function Header({ battery = 78, connected = true }) {
  const [time, setTime] = useState("");

  useEffect(() => {
    const fmt = () =>
      new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
    setTime(fmt());
    const id = setInterval(() => setTime(fmt()), 30_000);
    return () => clearInterval(id);
  }, []);

  const batteryColor = battery < 20 ? "#ef4444" : battery < 40 ? "#f97316" : "#6b7fa3";

  return (
    <header className="flex items-center justify-between px-5 pt-5 pb-3">
      {/* ── Brand ── */}
      <div className="flex items-center gap-3">
        {/* Logo mark */}
        <div
          className="neu-raised-circle flex items-center justify-center"
          style={{ width: 44, height: 44 }}
        >
          <img src="/envirosense-logo.png" alt="EnviroSense" width="40" height="40" />
        </div>

        <div>
          <h1 className="font-black text-base leading-tight" style={{ color: "#31456a" }}>
            EnviroSense
          </h1>
          <p className="text-[11px] font-medium" style={{ color: "#9aafc7" }}>
            Wearable Air Quality Monitoring Device
          </p>
        </div>
      </div>

      {/* ── Status strip ── */}
      <div
        className="neu-pressed flex items-center gap-2.5 px-3 py-2"
        style={{ borderRadius: 14 }}
      >
        <span className="text-xs font-semibold tabular-nums" style={{ color: "#6b7fa3" }}>
          {time}
        </span>

        <TbWifi
          size={15}
          style={{ color: connected ? "#22c55e" : "#a3b1c6" }}
          aria-label={connected ? "Connected" : "Disconnected"}
        />

        <TbBluetooth
          size={15}
          style={{ color: connected ? "#3b82f6" : "#a3b1c6" }}
          aria-label="Bluetooth"
        />

        <div
          className="flex items-center gap-1"
          style={{ color: batteryColor }}
          aria-label={`Battery ${battery}%`}
        >
          <BatteryIcon level={battery} />
          <span className="text-[11px] font-medium tabular-nums">{battery}%</span>
        </div>
      </div>
    </header>
  );
}
