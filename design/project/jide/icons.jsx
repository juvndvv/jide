// jide — icon set (Phosphor-style outline, 24×24 viewBox, currentColor).
// Curated for dev-tools surface: branches, terminals, files, sessions.

const JIDE_ICONS = {
  // wordmark "j" placeholder
  "logo-j":      <><path d="M14 4v9a5 5 0 0 1-10 0M14 4h4"/></>,
  // git / vc
  "branch":      <><circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="8" r="2"/><path d="M6 8v8M18 10c0 4-4 4-4 8"/></>,
  "git-commit":  <><circle cx="12" cy="12" r="3"/><path d="M3 12h6M15 12h6"/></>,
  "merge":       <><circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><circle cx="6" cy="18" r="2"/><path d="M6 8v8M6 8c0 6 6 6 10 10"/></>,
  // chrome / structure
  "sidebar":     <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></>,
  "split-h":     <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 13h18"/></>,
  "split-v":     <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/></>,
  "terminal":    <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M13 15h4"/></>,
  "folder":      <><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/></>,
  "folder-open": <><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1H3V7Z"/><path d="M3 9h18l-2 8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/></>,
  "file":        <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z"/><path d="M14 3v6h6"/></>,
  "file-code":   <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z"/><path d="M14 3v6h6"/><path d="m10 14-2 2 2 2M14 14l2 2-2 2"/></>,
  // chevrons
  "chev-r":      <><path d="m9 6 6 6-6 6"/></>,
  "chev-l":      <><path d="m15 6-6 6 6 6"/></>,
  "chev-d":      <><path d="m6 9 6 6 6-6"/></>,
  "chev-u":      <><path d="m6 15 6-6 6 6"/></>,
  // command / actions
  "command":     <><path d="M9 6a3 3 0 1 0-3 3h3V6Zm0 0v12m0 0a3 3 0 1 0 3-3H9v3Zm0-6h6M15 6a3 3 0 1 1 3 3h-3V6Zm0 12a3 3 0 1 1 3-3h-3v3Z"/></>,
  "plus":        <><path d="M12 5v14M5 12h14"/></>,
  "minus":       <><path d="M5 12h14"/></>,
  "x":           <><path d="M6 6l12 12M18 6 6 18"/></>,
  "check":       <><path d="m4 12 5 5L20 6"/></>,
  "search":      <><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></>,
  "settings":    <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></>,
  "bolt":        <><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/></>,
  "play":        <><path d="M6 4v16l14-8Z"/></>,
  "pause":       <><path d="M7 4v16M17 4v16"/></>,
  "stop":        <><rect x="6" y="6" width="12" height="12" rx="1"/></>,
  "circle":      <><circle cx="12" cy="12" r="4"/></>,
  "dot":         <><circle cx="12" cy="12" r="3"/></>,
  "warning":     <><path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v5M12 17.5v.5"/></>,
  "trash":       <><path d="M4 7h16M9 7V4h6v3M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/></>,
  "wrench":      <><path d="m14 6 4-4 4 4-4 4M14 6l-9 9a3 3 0 1 0 4 4l9-9M14 6l4 4"/></>,
  "eye":         <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
  "arrow-up":    <><path d="M12 19V5M5 12l7-7 7 7"/></>,
  "arrow-down":  <><path d="M12 5v14M5 12l7 7 7-7"/></>,
  "send":        <><path d="M3 12 21 3l-7 18-3-7-8-2Z"/></>,
  "user":        <><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></>,
  "claude":      <><circle cx="12" cy="12" r="9"/><path d="M8 9c0 5 4 7 8 7M16 9c0 5-4 7-8 7"/></>,
  "cli":         <><path d="m4 7 5 5-5 5M12 17h8"/></>,
  "kbd":         <><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.5M10 10h.5M14 10h.5M18 10h.5M6 14h12"/></>,
  "diff":        <><path d="M11 4v6h6M13 20v-6H7"/><path d="m7 10 4-6M17 14l-4 6"/></>,
  "more":        <><circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/></>,
};

function JIcon({ name, size = 16, color = "currentColor", stroke = 1.6, style }) {
  const body = JIDE_ICONS[name] || JIDE_ICONS["dot"];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      style={{ display: "inline-block", flexShrink: 0, verticalAlign: "middle", ...(style || {}) }}>
      {body}
    </svg>
  );
}

// Small status dot for claude session states.
function StatusDot({ state, accent, size = 7 }) {
  const colors = {
    running:  accent?.value || "#F95A5C",
    awaiting: "#F59E0B",
    idle:     "#B8B8B8",
    error:    "#ED5A46",
    done:     "#10B981",
    clean:    "transparent",
  };
  const pulse = state === "running";
  return (
    <span style={{
      display: "inline-block", width: size, height: size, borderRadius: 999,
      background: colors[state] || colors.idle,
      boxShadow: pulse ? `0 0 0 0 ${colors.running}77` : "none",
      animation: pulse ? "jidePulse 1.6s ease-out infinite" : "none",
      flexShrink: 0,
    }} />
  );
}

// Tiny kbd chip for showing shortcuts.
function Kbd({ children, theme }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      minWidth: 18, height: 18, padding: "0 5px", marginLeft: 2,
      borderRadius: 4, background: theme.panelMuted, color: theme.textMed,
      border: `1px solid ${theme.border}`, fontFamily: "Geist, ui-monospace, monospace",
      fontSize: 11, fontWeight: 500, lineHeight: 1, letterSpacing: 0,
    }}>{children}</span>
  );
}

Object.assign(window, { JIDE_ICONS, JIcon, StatusDot, Kbd });
