// jide — Design canvas composition. Hero (interactive) + state cards.
// State cards force specific overlays/themes so the user can see each
// significant state side-by-side.

function JideCanvas() {
  return (
    <DesignCanvas minScale={0.08} maxScale={2.2}>
      <DCSection id="prototipo" title="Prototipo"
        subtitle="Interactivo · ⌘K · ⌘T nueva sesión · ⌘N nuevo worktree · ⌘\ · ⌘O · ⌘⇧K · Esc"
        gap={64}>
        <DCArtboard id="live" label="Live · ⌘K para empezar" width={1500} height={960}
          style={{ background: "transparent", boxShadow: "none" }}>
          <Pad><JideAppRoot /></Pad>
        </DCArtboard>
      </DCSection>

      <DCSection id="estados" title="Estados"
        subtitle="Mismo prototipo, distintos momentos de la sesión"
        gap={56}>
        <DCArtboard id="default" label="A · Default · Light" width={1500} height={960} style={cardStyle}>
          <Pad><JideApp themeMode="light" accentKey="coral" sidebarSide="left"
            forceState={{ overlay: null, split: "v", viewer: false, activeId: "yu-billing" }} /></Pad>
        </DCArtboard>
        <DCArtboard id="dark" label="B · Default · Dark" width={1500} height={960} style={cardStyle}>
          <Pad dark><JideApp themeMode="dark" accentKey="coral" sidebarSide="left"
            forceState={{ overlay: null, split: "v", viewer: false, activeId: "yu-billing" }} /></Pad>
        </DCArtboard>
        <DCArtboard id="multi-session" label="C · Sesión paralela activa" width={1500} height={960} style={cardStyle}>
          <Pad><JideApp themeMode="light" accentKey="coral"
            forceState={{ overlay: null, split: "off", viewer: false,
              activeId: "yu-billing",
              activeSessionByWt: { "yu-billing": "yu-billing-s2" } }} /></Pad>
        </DCArtboard>
        <DCArtboard id="palette" label="D · ⌘K Command palette" width={1500} height={960} style={cardStyle}>
          <Pad><JideApp themeMode="light" accentKey="coral"
            forceState={{ overlay: "palette", split: "v", viewer: false, activeId: "yu-billing" }} /></Pad>
        </DCArtboard>
        <DCArtboard id="awaiting" label="E · Sesión esperando aprobación" width={1500} height={960} style={cardStyle}>
          <Pad><JideApp themeMode="light" accentKey="coral"
            forceState={{ overlay: null, split: "off", viewer: false,
              activeId: "yu-billing",
              activeSessionByWt: { "yu-billing": "yu-billing-s3" } }} /></Pad>
        </DCArtboard>
        <DCArtboard id="kill" label="F · Detener sesión" width={1500} height={960} style={cardStyle}>
          <Pad dark><JideApp themeMode="dark" accentKey="coral"
            forceState={{ overlay: "killConfirm", split: "v", viewer: false, activeId: "yu-billing" }} /></Pad>
        </DCArtboard>
        <DCArtboard id="new" label="G · Nuevo worktree" width={1500} height={960} style={cardStyle}>
          <Pad><JideApp themeMode="light" accentKey="coral"
            forceState={{ overlay: "newWorktree", split: "v", viewer: false, activeId: "ji-kbd" }} /></Pad>
        </DCArtboard>
        <DCArtboard id="viewer" label="H · Visor de archivos" width={1500} height={960} style={cardStyle}>
          <Pad><JideApp themeMode="light" accentKey="coral"
            forceState={{ overlay: null, split: "off", viewer: true, activeId: "yu-billing" }} /></Pad>
        </DCArtboard>
      </DCSection>

      <DCSection id="variantes" title="Variantes de layout"
        subtitle="Composiciones alternativas del mismo prototipo"
        gap={56}>
        <DCArtboard id="split-h" label="Terminal lateral" width={1500} height={960} style={cardStyle}>
          <Pad><JideApp themeMode="light" accentKey="coral"
            forceState={{ overlay: null, split: "h", viewer: false, activeId: "yu-billing" }} /></Pad>
        </DCArtboard>
        <DCArtboard id="right-sidebar" label="Sidebar a la derecha" width={1500} height={960} style={cardStyle}>
          <Pad><JideApp themeMode="light" accentKey="coral" sidebarSide="right"
            forceState={{ overlay: null, split: "v", viewer: false, activeId: "yu-billing" }} /></Pad>
        </DCArtboard>
        <DCArtboard id="violet" label="Acento violeta · Dark" width={1500} height={960} style={cardStyle}>
          <Pad dark><JideApp themeMode="dark" accentKey="violet"
            forceState={{ overlay: null, split: "v", viewer: false, activeId: "yu-billing" }} /></Pad>
        </DCArtboard>
        <DCArtboard id="emerald" label="Acento esmeralda · compact" width={1500} height={960} style={cardStyle}>
          <Pad><JideApp themeMode="light" accentKey="emerald" densityKey="compact"
            forceState={{ overlay: null, split: "v", viewer: true, activeId: "yu-billing" }} /></Pad>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

// Pad: gives the macOS window 30px of breathing room inside each artboard
// so the drop-shadow has space to settle. Background matches a desktop wash.
function Pad({ children, dark }) {
  return (
    <div style={{
      width: "100%", height: "100%",
      display: "flex", alignItems: "center", justifyContent: "center",
      background: dark
        ? "radial-gradient(120% 90% at 50% 30%, #2A2730 0%, #15131A 60%, #0A090E 100%)"
        : "radial-gradient(120% 90% at 50% 30%, #FAF8F4 0%, #ECE7DF 60%, #DDD7CD 100%)",
      padding: 30, boxSizing: "border-box",
    }}>{children}</div>
  );
}

const cardStyle = { background: "transparent", boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.04)" };

Object.assign(window, { JideCanvas });
