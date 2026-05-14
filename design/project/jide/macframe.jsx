// jide — minimal macOS window chrome.
// Dev tool, not Finder: no Liquid Glass sidebar; just the bezel + traffic lights.
// Content lives edge-to-edge inside; the app paints its own header strip with
// the traffic-light cutout on the left.

function MacFrame({ width = 1440, height = 900, theme, children, focused = true }) {
  return (
    <div style={{
      width, height, borderRadius: 12, overflow: "hidden",
      background: theme.appBg,
      boxShadow: focused
        ? "0 0 0 0.5px rgba(0,0,0,0.25), 0 24px 64px rgba(0,0,0,0.28), 0 4px 12px rgba(0,0,0,0.12)"
        : "0 0 0 0.5px rgba(0,0,0,0.2), 0 8px 24px rgba(0,0,0,0.18)",
      position: "relative", display: "flex", flexDirection: "column",
      fontFamily: "Open Sauce One, -apple-system, sans-serif",
      color: theme.text,
    }}>
      {children}
    </div>
  );
}

// Traffic lights — sit at top-left, padded so the app header strip can dock above them.
function TrafficLights({ inactive = false, style }) {
  const dot = (bg) => (
    <span style={{
      width: 12, height: 12, borderRadius: 999,
      background: inactive ? "#C4C2BE" : bg,
      boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.15)",
      display: "inline-block",
    }} />
  );
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", ...(style || {}) }}>
      {dot("#FF5F57")}{dot("#FEBC2E")}{dot("#28C840")}
    </div>
  );
}

Object.assign(window, { MacFrame, TrafficLights });
