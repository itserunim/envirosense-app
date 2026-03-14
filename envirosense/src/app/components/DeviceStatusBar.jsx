import { TbMapPin, TbRefresh, TbActivity, TbWifiOff } from "react-icons/tb";

/**
 * DeviceStatusBar — thin row showing location, live status, and uptime
 * @param {string} location - Location name (default: "Indoor")
 * @param {boolean} isOnline - Whether device is connected/online
 * @param {boolean} syncing - Whether device is connecting/syncing
 * @param {string} uptime - Formatted uptime string
 */
export default function DeviceStatusBar({ 
  location = "Indoor", 
  isOnline = false, 
  syncing = false, 
  uptime = "0h 0m" 
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 py-3">
      {/* Location */}
      <div className="neu-raised-sm flex items-center gap-1.5 px-3 py-2 flex-1 justify-center">
        <TbMapPin size={13} style={{ color: "#5b7ec9" }} />
        <span className="text-[11px] font-semibold truncate" style={{ color: "#6b7fa3" }}>
          {location}
        </span>
      </div>

      {/* Live/Offline indicator */}
      <div className="neu-raised-sm flex items-center gap-1.5 px-3 py-2 flex-1 justify-center">
        {isOnline ? (
          // Online state
          <>
            <TbActivity size={13} style={{ color: "#22c55e" }} />
            <span className="text-[11px] font-semibold" style={{ color: "#6b7fa3" }}>
              Live
            </span>
            <span
              className="animate-blink rounded-full flex-shrink-0"
              style={{ width: 6, height: 6, background: "#22c55e" }}
            />
          </>
        ) : (
          // Offline state
          <>
            <TbWifiOff size={13} style={{ color: "#ef4444" }} />
            <span className="text-[11px] font-semibold" style={{ color: "#6b7fa3" }}>
              Offline
            </span>
            <span
              className="rounded-full flex-shrink-0"
              style={{ width: 6, height: 6, background: "#ef4444" }}
            />
          </>
        )}
      </div>

      {/* Uptime */}
      <div className="neu-raised-sm flex items-center gap-1.5 px-3 py-2 flex-1 justify-center">
        <TbRefresh
          size={13}
          className={syncing ? "animate-spin-slow" : ""}
          style={{ color: syncing ? "#eab308" : "#9aafc7" }}
        />
        <span className="text-[11px] font-semibold tabular-nums truncate" style={{ color: "#6b7fa3" }}>
          {uptime}
        </span>
      </div>
    </div>
  );
}