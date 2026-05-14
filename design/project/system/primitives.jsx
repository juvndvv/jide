// Yurest Back Office — design-system primitives
// All inline styles; values come from /Colors-Typography & component frames in the source Figma.

const C = {
  primary: "#F95A5C", primaryLight: "#FF7173", primaryBg: "#FFF5F5",
  high: "#1F1F1F", medium: "#666666", low: "#8F8F8F", disabled: "#B8B8B8",
  white: "#FFFFFF", subtle: "#FAFAFA", muted: "#F5F5F5", strong: "#F0F0F0",
  borderSubtle: "#EBEBEB", border: "#DBDBDB",
  info: "#3B82F6", infoBg: "#EFF6FF", infoText: "#2563EB",
  success: "#10B981", successBg: "#ECFDF0", successText: "#028E5C",
  warning: "#F59E0B", warningBg: "#FFFBEB", warningText: "#D97706",
  error: "#ED5A46", errorBg: "#FEF3F2", errorText: "#DA3D28",
  violet: "#7C67F7", violetBg: "#F4F2FF",
};

function Button({ children, variant = "contained", color = "primary", size = "medium", icon, iconAfter, onClick, disabled, style }) {
  const sizes = {
    large:  { h: 48, px: 20, fs: 15, r: 12, gap: 8, ic: 20 },
    medium: { h: 40, px: 16, fs: 14, r: 10, gap: 6, ic: 18 },
    small:  { h: 32, px: 12, fs: 13, r: 8,  gap: 6, ic: 16 },
  }[size];
  const palettes = {
    primary: {
      contained: { bg: C.primary, fg: "#fff", hoverBg: C.primaryLight, border: "transparent" },
      outlined:  { bg: "#fff", fg: C.primary, hoverBg: C.primaryBg, border: C.primary },
      ghost:     { bg: "transparent", fg: C.primary, hoverBg: C.primaryBg, border: "transparent" },
    },
    neutral: {
      contained: { bg: C.high, fg: "#fff", hoverBg: "#3A3A3A", border: "transparent" },
      outlined:  { bg: "#fff", fg: C.high, hoverBg: C.muted, border: C.border },
      ghost:     { bg: "transparent", fg: C.high, hoverBg: C.muted, border: "transparent" },
    },
    danger: {
      contained: { bg: C.error, fg: "#fff", hoverBg: "#F47561", border: "transparent" },
      outlined:  { bg: "#fff", fg: C.error, hoverBg: C.errorBg, border: C.error },
      ghost:     { bg: "transparent", fg: C.error, hoverBg: C.errorBg, border: "transparent" },
    },
  };
  const p = palettes[color][variant];
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: sizes.gap,
        height: sizes.h, padding: `0 ${sizes.px}px`, borderRadius: sizes.r,
        background: disabled ? C.strong : (hover ? p.hoverBg : p.bg),
        color: disabled ? C.disabled : p.fg,
        border: `1px solid ${disabled ? C.borderSubtle : (variant === "outlined" ? p.border : "transparent")}`,
        fontFamily: "Open Sauce One, sans-serif", fontWeight: 600,
        fontSize: sizes.fs, lineHeight: 1, letterSpacing: "-0.005em",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 160ms ease, color 160ms ease",
        ...(style || {}),
      }}
    >
      {icon && <Icon name={icon} size={sizes.ic} />}
      {children}
      {iconAfter && <Icon name={iconAfter} size={sizes.ic} />}
    </button>
  );
}

function Tag({ children, color = "neutral", variant = "contained", icon }) {
  const palette = {
    primary: { bg: C.primaryBg, fg: C.primary },
    neutral: { bg: C.subtle,    fg: C.medium },
    success: { bg: C.successBg, fg: C.successText },
    warning: { bg: C.warningBg, fg: C.warningText },
    error:   { bg: C.errorBg,   fg: C.errorText },
    info:    { bg: C.infoBg,    fg: C.infoText },
    violet:  { bg: C.violetBg,  fg: C.violet },
  }[color];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 8px", borderRadius: 6,
      background: variant === "contained" ? palette.bg : "#fff",
      border: variant === "outlined" ? `1px solid ${palette.fg}` : "1px solid transparent",
      color: palette.fg, fontWeight: 600, fontSize: 12, lineHeight: "16px",
      letterSpacing: 0,
    }}>
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
}

function Switch({ checked, onChange, size = "medium", disabled }) {
  const dims = size === "large" ? { w: 56, h: 32, k: 28, off: 26 } : { w: 44, h: 24, k: 20, off: 22 };
  return (
    <span
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange?.(!checked)}
      style={{
        position: "relative", display: "inline-block",
        width: dims.w, height: dims.h, borderRadius: 9999,
        background: disabled ? C.borderSubtle : (checked ? C.primary : C.muted),
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 180ms ease",
      }}
    >
      <span style={{
        position: "absolute", top: 2, left: checked ? dims.off : 2,
        width: dims.k, height: dims.k, borderRadius: 9999,
        background: disabled ? C.muted : "#fff",
        boxShadow: "0 1px 2px rgba(31,31,31,0.12)",
        transition: "left 180ms ease",
      }} />
    </span>
  );
}

function Checkbox({ checked, onChange, disabled, indeterminate }) {
  return (
    <span
      role="checkbox"
      aria-checked={checked}
      onClick={() => !disabled && onChange?.(!checked)}
      style={{
        width: 20, height: 20, borderRadius: 6,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: disabled ? C.subtle : (checked || indeterminate ? C.primary : "#fff"),
        border: `1.5px solid ${disabled ? C.borderSubtle : (checked || indeterminate ? C.primary : C.border)}`,
        color: "#fff", fontSize: 13, cursor: disabled ? "not-allowed" : "pointer",
        flexShrink: 0,
      }}
    >
      {indeterminate ? <Icon name="minus" size={14} /> : (checked ? <Icon name="check" size={14} /> : null)}
    </span>
  );
}

function Avatar({ initials, src, size = 36, square, color = "primary", style }) {
  const palettes = {
    primary: { bg: "#FFECEC", fg: C.primary },
    blue:    { bg: C.infoBg, fg: C.infoText },
    green:   { bg: C.successBg, fg: C.successText },
    violet:  { bg: C.violetBg, fg: C.violet },
    gray:    { bg: C.muted, fg: C.medium },
  };
  const p = palettes[color] || palettes.primary;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: size, height: size, borderRadius: square ? 6 : 9999,
      background: p.bg, color: p.fg,
      fontFamily: "Open Sauce One, sans-serif", fontWeight: 600,
      fontSize: Math.round(size * 0.36), letterSpacing: 0,
      overflow: "hidden", flexShrink: 0,
      ...(style || {}),
    }}>
      {src ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials}
    </span>
  );
}

function Chip({ children, selected, icon, onClick }) {
  const [hover, setHover] = React.useState(false);
  const bg = selected ? C.primary : (hover ? C.muted : "#fff");
  const fg = selected ? "#fff" : C.high;
  const bd = selected ? C.primary : C.border;
  return (
    <button type="button" onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        height: 32, padding: "0 12px", borderRadius: 8,
        border: `1px solid ${bd}`, background: bg, color: fg,
        fontFamily: "Open Sauce One, sans-serif", fontWeight: 500,
        fontSize: 13, lineHeight: 1, cursor: "pointer",
        transition: "all 160ms ease",
      }}>
      {icon && <Icon name={icon} size={14} />}
      {children}
    </button>
  );
}

function Field({ label, value, onChange, placeholder, error, type = "text", icon }) {
  const [focus, setFocus] = React.useState(false);
  const borderColor = error ? C.error : (focus ? C.info : C.border);
  const borderWidth = (focus || error) ? 1.4 : 1;
  return (
    <div style={{ position: "relative", width: "100%" }}>
      <input
        type={type} value={value} placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={{
          width: "100%", height: 44, boxSizing: "border-box",
          borderRadius: 8, border: `${borderWidth}px solid ${borderColor}`,
          padding: icon ? "0 12px 0 38px" : "0 12px",
          fontFamily: "Open Sauce One, sans-serif", fontSize: 15, lineHeight: "22px",
          color: C.high, background: "#fff", outline: "none",
        }}
      />
      {icon && (
        <span style={{ position: "absolute", left: 12, top: 12, color: C.low }}>
          <Icon name={icon} size={20} />
        </span>
      )}
      {label && (
        <span style={{
          position: "absolute", top: -8, left: 12, padding: "0 6px",
          background: "#fff", fontSize: 10, lineHeight: "16px",
          fontWeight: 500, color: error ? C.error : C.high, letterSpacing: 0,
        }}>{label}</span>
      )}
      {error && (
        <div style={{ marginTop: 6, paddingLeft: 12, color: C.error, fontSize: 12 }}>{error}</div>
      )}
    </div>
  );
}

function Toast({ kind = "success", title, msg, onClose }) {
  const palette = {
    success: { strip: C.success, ic: "check-circle" },
    info:    { strip: C.info,    ic: "info" },
    warning: { strip: C.warning, ic: "warning" },
    error:   { strip: C.error,   ic: "x-circle" },
  }[kind];
  return (
    <div style={{
      display: "flex", borderRadius: 8, background: "#fff",
      boxShadow: "0 8px 24px rgba(31,31,31,0.08)", overflow: "hidden",
      minWidth: 340, maxWidth: 420,
    }}>
      <div style={{ width: 4, background: palette.strip, borderRadius: "0 2px 2px 0" }} />
      <div style={{ width: 44, display: "flex", alignItems: "center", justifyContent: "center", color: palette.strip }}>
        <Icon name={palette.ic} size={20} />
      </div>
      <div style={{ flex: 1, padding: "12px 12px 12px 4px" }}>
        <div style={{ fontWeight: 600, fontSize: 14, lineHeight: "20px", color: C.high }}>{title}</div>
        {msg && <div style={{ fontSize: 12, lineHeight: "16px", color: C.low, marginTop: 2 }}>{msg}</div>}
      </div>
      <button onClick={onClose}
        style={{ width: 36, border: 0, background: "transparent", color: C.low, cursor: "pointer" }}>
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}

function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 24, width: 520, padding: "24px 24px 20px", boxShadow: "0 16px 48px rgba(81,56,134,0.16)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 18, lineHeight: "26px" }}>{title}</div>
          <button onClick={onClose} style={{ border: 0, background: "transparent", color: C.low, cursor: "pointer" }}>
            <Icon name="x" size={20} />
          </button>
        </div>
        {children}
        {footer && <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 8 }}>{footer}</div>}
      </div>
    </div>
  );
}

Object.assign(window, { C, Button, Tag, Switch, Checkbox, Avatar, Chip, Field, Toast, Modal });
