// Inline SVG icon set — Phosphor-style outline icons, hand-crafted for the Yurest kit.
// All icons are 24×24 viewBox, 1.5–2px stroke, currentColor.
// (Replaces the phosphor web-font usage to avoid CDN font loading flakiness.)

const ICONS = {
  "house": <><path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-8.5Z"/></>,
  "receipt": <><path d="M5 3v18l2-1.5L9 21l2-1.5L13 21l2-1.5L17 21l2-1.5V3"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
  "package": <><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z"/><path d="m3 7.5 9 4.5m0 9V12m9-4.5L12 12M7.5 5.25l9 4.5"/></>,
  "fork-knife": <><path d="M7 2v8a3 3 0 0 0 3 3v9M4 2v6M10 2v6M17 2c-2 0-3 2-3 5s1 5 3 5h0v10"/></>,
  "thermometer": <><rect x="9" y="2" width="6" height="14" rx="3"/><circle cx="12" cy="18" r="3"/><path d="M12 8v8"/></>,
  "users-three": <><circle cx="9" cy="9" r="3"/><circle cx="17" cy="8" r="2.5"/><path d="M3 19c0-3 2.5-5 6-5s6 2 6 5M14 14c2.5 0 6 1.5 6 4"/></>,
  "chart-line-up": <><path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 6-7"/><path d="M15 7h5v5"/></>,
  "chat-circle-dots": <><path d="M21 12c0 5-4 9-9 9-1.6 0-3-.4-4.4-1.1L3 21l1.1-4.6A8.97 8.97 0 0 1 3 12c0-5 4-9 9-9s9 4 9 9Z"/><circle cx="8.5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="15.5" cy="12" r="1"/></>,
  "magnifying-glass": <><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></>,
  "bell": <><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 8H4c0-2 2-3 2-8Z"/><path d="M10 20a2 2 0 0 0 4 0"/></>,
  "gear-six": <><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></>,
  "caret-right": <><path d="m9 6 6 6-6 6"/></>,
  "caret-left": <><path d="m15 6-6 6 6 6"/></>,
  "caret-down": <><path d="m6 9 6 6 6-6"/></>,
  "caret-up-down": <><path d="m8 9 4-4 4 4M8 15l4 4 4-4"/></>,
  "plus": <><path d="M12 5v14M5 12h14"/></>,
  "minus": <><path d="M5 12h14"/></>,
  "x": <><path d="M6 6l12 12M18 6 6 18"/></>,
  "check": <><path d="m4 12 5 5L20 6"/></>,
  "check-circle": <><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></>,
  "info": <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 8v.5"/></>,
  "warning": <><path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v5M12 17.5v.5"/></>,
  "x-circle": <><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/></>,
  "download-simple": <><path d="M12 4v12M7 11l5 5 5-5M5 20h14"/></>,
  "arrow-right": <><path d="M4 12h16M14 6l6 6-6 6"/></>,
  "funnel": <><path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z"/></>,
  "calendar-blank": <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></>,
  "clock": <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  "map-pin": <><path d="M12 21c5-5 8-9 8-12a8 8 0 0 0-16 0c0 3 3 7 8 12Z"/><circle cx="12" cy="9" r="2.5"/></>,
  "currency-eur": <><path d="M18 6c-1.5-1.5-4-2-6-2-5 0-8 4-8 8s3 8 8 8c2 0 4.5-.5 6-2M4 10h11M4 14h11"/></>,
  "trash": <><path d="M4 7h16M9 7V4h6v3M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/></>,
  "trend-up": <><path d="M3 17 9 11l4 4 8-8"/><path d="M15 4h6v6"/></>,
  "printer": <><rect x="6" y="13" width="12" height="8" rx="1"/><path d="M6 17H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2M6 10V3h12v7"/></>,
  "flag": <><path d="M5 21V4M5 4h12l-2 4 2 4H5"/></>,
  "hourglass-medium": <><path d="M6 3h12v3l-4 6 4 6v3H6v-3l4-6-4-6V3Z"/></>,
  "arrows-clockwise": <><path d="M4 12a8 8 0 0 1 14-5l3-2v6h-6M20 12a8 8 0 0 1-14 5l-3 2v-6h6"/></>,
  "drop": <><path d="M12 3c4 5 7 9 7 13a7 7 0 0 1-14 0c0-4 3-8 7-13Z"/></>,
  "grains": <><path d="M12 4c-3 2-5 5-5 9s2 7 5 9c3-2 5-5 5-9s-2-7-5-9ZM12 4v18M7 8c1.5.5 3 1 5 1M17 8c-1.5.5-3 1-5 1M7 14c1.5.5 3 1 5 1M17 14c-1.5.5-3 1-5 1"/></>,
  "leaf": <><path d="M4 20c0-8 6-16 16-16-1 11-7 16-16 16Z"/><path d="M4 20 14 10"/></>,
  "wine": <><path d="M7 3h10v4a5 5 0 0 1-10 0V3Z"/><path d="M12 12v8M9 21h6"/></>,
  "fish": <><path d="M3 12s4-6 11-6 7 6 7 6-0 6-7 6-11-6-11-6Z"/><circle cx="17" cy="11" r="1"/><path d="M3 12 1 9M3 12l-2 3"/></>,
};

function Icon({ name, size = 20, color = "currentColor", stroke = 1.6, style }) {
  const body = ICONS[name] || ICONS["x"];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", flexShrink: 0, verticalAlign: "middle", ...(style || {}) }}
    >
      {body}
    </svg>
  );
}

Object.assign(window, { Icon, ICONS });
