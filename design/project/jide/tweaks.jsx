// jide — Tweaks panel: theme, density, accent, sidebar position.
// Drives JideAppRoot below via setTweak.

const JIDE_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "density": "comfy",
  "accent": "coral",
  "sidebarSide": "left"
}/*EDITMODE-END*/;

function JideTweaks() {
  const [t, setTweak] = useTweaks(JIDE_TWEAK_DEFAULTS);
  // Broadcast to JideAppRoot via window event (avoids prop-drilling through DesignCanvas).
  React.useEffect(() => {
    window.dispatchEvent(new CustomEvent("jide:tweaks", { detail: t }));
  }, [t.theme, t.density, t.accent, t.sidebarSide]);

  // Accent option swatches (single colors).
  const accentOptions = Object.values(JIDE_ACCENTS).map((a) => a.value);
  const accentByValue = (v) => Object.values(JIDE_ACCENTS).find((a) => a.value === v)?.id || "coral";

  return (
    <TweaksPanel title="Tweaks · jide">
      <TweakSection label="Tema" />
      <TweakRadio label="Modo" value={t.theme} options={["light", "dark"]}
        onChange={(v) => setTweak("theme", v)} />
      <TweakColor label="Acento" value={JIDE_ACCENTS[t.accent].value} options={accentOptions}
        onChange={(v) => setTweak("accent", accentByValue(v))} />

      <TweakSection label="Layout" />
      <TweakRadio label="Densidad" value={t.density} options={["compact", "comfy"]}
        onChange={(v) => setTweak("density", v)} />
      <TweakRadio label="Sidebar" value={t.sidebarSide} options={["left", "right"]}
        onChange={(v) => setTweak("sidebarSide", v)} />
    </TweaksPanel>
  );
}

// Root wrapper that listens to the tweaks event and re-renders JideApp.
function JideAppRoot(props) {
  const [t, setT] = React.useState(JIDE_TWEAK_DEFAULTS);
  React.useEffect(() => {
    const on = (e) => setT((p) => ({ ...p, ...e.detail }));
    window.addEventListener("jide:tweaks", on);
    return () => window.removeEventListener("jide:tweaks", on);
  }, []);
  return (
    <JideApp
      themeMode={t.theme}
      densityKey={t.density}
      accentKey={t.accent}
      sidebarSide={t.sidebarSide}
      {...props}
    />
  );
}

Object.assign(window, { JideTweaks, JideAppRoot, JIDE_TWEAK_DEFAULTS });
