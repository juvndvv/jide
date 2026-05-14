// jide — status bar + overlays (command palette ⌘K, new worktree, kill confirm).

function StatusBar({ theme, accent, wt, project, splitOrientation, onToggleSplit, onOpenPalette, viewerOpen, onToggleViewer }) {
  return (
    <footer style={{
      display: "flex", alignItems: "center", gap: 0,
      height: 26, padding: "0 4px 0 0", flexShrink: 0,
      background: accent.value, color: "#fff",
      fontFamily: "Geist, ui-monospace, monospace", fontSize: 11.5,
      letterSpacing: 0,
    }}>
      <StatusItem icon="branch">{wt.branch}</StatusItem>
      <StatusItem icon="arrow-up">{wt.ahead}</StatusItem>
      <StatusItem icon="arrow-down">{wt.behind}</StatusItem>
      <StatusItem icon="diff">{wt.changes} cambios</StatusItem>
      <div style={{ flex: 1 }} />
      <StatusItem icon="claude">
        {wt.claude === "running" ? "claude · ejecutando" :
         wt.claude === "awaiting" ? "claude · esperando" :
         wt.claude === "idle" ? "claude · en reposo" : `claude · ${wt.claude}`}
      </StatusItem>
      <StatusItem icon="cli">$ {project.path}</StatusItem>
      <button onClick={onToggleSplit} style={statusBtn()}>
        <JIcon name={splitOrientation === "v" ? "split-v" : splitOrientation === "h" ? "split-h" : "terminal"} size={11} />
        Term <span style={{ opacity: 0.7, marginLeft: 2 }}>⌘\</span>
      </button>
      <button onClick={onToggleViewer} style={statusBtn(viewerOpen)}>
        <JIcon name="eye" size={11} />
        Visor <span style={{ opacity: 0.7, marginLeft: 2 }}>⌘O</span>
      </button>
      <button onClick={onOpenPalette} style={statusBtn()}>
        <JIcon name="command" size={11} />
        Comandos <span style={{ opacity: 0.7, marginLeft: 2 }}>⌘K</span>
      </button>
    </footer>
  );
}

function StatusItem({ icon, children }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "0 10px", height: "100%",
    }}>
      <JIcon name={icon} size={11} style={{ opacity: 0.85 }} />
      <span style={{ opacity: 0.95 }}>{children}</span>
    </span>
  );
}

function statusBtn(active) {
  return {
    display: "inline-flex", alignItems: "center", gap: 5,
    height: 22, padding: "0 9px", marginRight: 2,
    borderRadius: 4, border: 0,
    background: active ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.0)",
    color: "#fff", cursor: "pointer",
    fontFamily: "inherit", fontSize: 11.5,
  };
}

// ─── Command palette (⌘K) ───────────────────────────────────────────────
function CommandPalette({ theme, accent, groups, onClose, onPick }) {
  const [q, setQ] = React.useState("");
  const [sel, setSel] = React.useState(0);
  const inputRef = React.useRef(null);
  React.useEffect(() => { inputRef.current?.focus(); }, []);

  const flat = [];
  groups.forEach((g) => {
    const items = g.items.filter((it) =>
      !q || it.title.toLowerCase().includes(q.toLowerCase()) || (it.hint || "").toLowerCase().includes(q.toLowerCase())
    );
    if (items.length) flat.push({ kind: "group", group: g, items });
  });
  const flatItems = flat.flatMap((s) => s.items);
  const selIdx = Math.min(sel, Math.max(0, flatItems.length - 1));

  return (
    <Overlay theme={theme} onClose={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 620, maxHeight: 480,
        display: "flex", flexDirection: "column",
        background: theme.panelBg, color: theme.text,
        borderRadius: 14, border: `1px solid ${theme.border}`,
        boxShadow: theme.modalShadow,
        overflow: "hidden",
        fontFamily: "inherit",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 16px", borderBottom: `1px solid ${theme.borderHair}`,
        }}>
          <JIcon name="search" size={15} style={{ color: theme.textLow }} />
          <input ref={inputRef} value={q}
            onChange={(e) => { setQ(e.target.value); setSel(0); }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(flatItems.length - 1, s + 1)); }
              if (e.key === "ArrowUp")   { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
              if (e.key === "Enter")     { e.preventDefault(); const it = flatItems[selIdx]; if (it) onPick(it); }
            }}
            placeholder="Buscar worktrees, archivos, acciones…"
            style={{
              flex: 1, border: 0, outline: 0, background: "transparent",
              color: theme.text, fontFamily: "inherit", fontSize: 15,
            }} />
          <Kbd theme={theme}>esc</Kbd>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: "6px 8px 8px" }}>
          {flat.length === 0 ? (
            <div style={{ padding: 20, color: theme.textLow, textAlign: "center", fontSize: 13 }}>
              Sin resultados para "{q}"
            </div>
          ) : flat.map((s) => (
            <div key={s.group.group}>
              <div style={{
                padding: "8px 10px 4px", fontSize: 10.5, fontWeight: 600,
                letterSpacing: 0.6, textTransform: "uppercase", color: theme.textLow,
              }}>{s.group.group}</div>
              {s.items.map((it) => {
                const idx = flatItems.indexOf(it);
                const active = idx === selIdx;
                return (
                  <button key={it.id}
                    onMouseEnter={() => setSel(idx)}
                    onClick={() => onPick(it)} style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 10px", borderRadius: 7,
                    border: 0, background: active ? accent.value + "14" : "transparent",
                    color: theme.text, cursor: "pointer",
                    fontFamily: "inherit", fontSize: 13, textAlign: "left",
                  }}>
                    <JIcon name={
                      s.group.icon === "branch" ? "branch" :
                      s.group.icon === "file"   ? "file"   :
                      s.group.icon === "bolt"   ? "bolt"   : "dot"
                    } size={13} style={{ color: active ? accent.value : theme.textMed }} />
                    <span style={{ flex: 1, fontFamily: s.group.group === "Archivos" ? "Geist, monospace" : "inherit" }}>{it.title}</span>
                    {it.hint && <span style={{ color: theme.textLow, fontSize: 11 }}>{it.hint}</span>}
                    {it.shortcut && <Kbd theme={theme}>{it.shortcut}</Kbd>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div style={{
          padding: "8px 14px", borderTop: `1px solid ${theme.borderHair}`,
          display: "flex", alignItems: "center", gap: 14,
          fontSize: 11, color: theme.textLow,
          background: theme.panelMuted,
        }}>
          <span><Kbd theme={theme}>↑↓</Kbd> navegar</span>
          <span><Kbd theme={theme}>⏎</Kbd> abrir</span>
          <span><Kbd theme={theme}>esc</Kbd> cerrar</span>
          <div style={{ flex: 1 }} />
          <span>{flatItems.length} resultados</span>
        </div>
      </div>
    </Overlay>
  );
}

// ─── New worktree dialog ──────────────────────────────────────────────
function NewWorktreeDialog({ theme, accent, projects, onClose, onCreate }) {
  const [proj, setProj] = React.useState(projects[0]?.id);
  const [src, setSrc]   = React.useState("main");
  const [name, setName] = React.useState("feat/");
  const project = projects.find((p) => p.id === proj);
  return (
    <Overlay theme={theme} onClose={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={modalStyle(theme, 540)}>
        <ModalHeader theme={theme} title="Nuevo worktree" icon="branch" accent={accent} onClose={onClose} />
        <div style={{ padding: "16px 22px 4px", display: "flex", flexDirection: "column", gap: 14 }}>
          <Row label="Proyecto" theme={theme}>
            <Select theme={theme} value={proj} onChange={setProj}
              options={projects.map((p) => ({ value: p.id, label: p.name }))} />
          </Row>
          <Row label="Rama origen" theme={theme}>
            <Select theme={theme} value={src} onChange={setSrc}
              options={(project?.worktrees || []).map((w) => ({ value: w.branch, label: w.branch }))} />
          </Row>
          <Row label="Nueva rama" theme={theme}>
            <Input theme={theme} value={name} onChange={setName} mono placeholder="feat/mi-rama" />
          </Row>
          <Row label="Ruta" theme={theme}>
            <div style={{
              padding: "9px 12px", borderRadius: 8,
              background: theme.codeBg, border: `1px solid ${theme.borderHair}`,
              fontFamily: "Geist, monospace", fontSize: 12.5, color: theme.textMed,
            }}>{(project?.path || "~/code")}-worktrees/{(name || "untitled").replace(/[\/]/g, "-")}</div>
          </Row>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, color: theme.textMed, fontSize: 13 }}>
            <input type="checkbox" defaultChecked style={{ accentColor: accent.value }} />
            <span>Lanzar Claude Code al crear</span>
          </label>
        </div>
        <ModalFooter theme={theme}>
          <button onClick={onClose} style={btnSecondary(theme)}>Cancelar</button>
          <button onClick={onCreate} style={btnPrimary(accent)}>
            Crear worktree <Kbd theme={{...theme, panelMuted: "rgba(255,255,255,0.16)", textMed: "#fff", border: "rgba(255,255,255,0.25)"}}>⏎</Kbd>
          </button>
        </ModalFooter>
      </div>
    </Overlay>
  );
}

// ─── Kill confirm dialog ──────────────────────────────────────────────
function KillConfirmDialog({ theme, accent, wt, onClose, onConfirm }) {
  return (
    <Overlay theme={theme} onClose={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={modalStyle(theme, 500)}>
        <ModalHeader theme={theme} title="Detener sesión Claude" icon="warning" accent={{ ...accent, value: theme.warning }} onClose={onClose} />
        <div style={{ padding: "12px 22px 4px" }}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: theme.text }}>
            La sesión está <strong>activa</strong> y aplicando una migración a la base de datos. Si la detienes ahora:
          </p>
          <ul style={{
            margin: "10px 0 0", padding: 0, listStyle: "none",
            display: "flex", flexDirection: "column", gap: 6,
            fontSize: 13, color: theme.textMed,
          }}>
            <li style={{ display: "flex", gap: 8 }}>
              <span style={{ color: theme.warning }}>•</span>
              <span>el worktree quedará en estado intermedio (5 archivos modificados sin confirmar)</span>
            </li>
            <li style={{ display: "flex", gap: 8 }}>
              <span style={{ color: theme.warning }}>•</span>
              <span>el comando <code style={inlineCode(theme)}>pnpm prisma migrate dev</code> seguirá en background hasta terminar</span>
            </li>
            <li style={{ display: "flex", gap: 8 }}>
              <span style={{ color: theme.warning }}>•</span>
              <span>se perderá el contexto actual de la conversación</span>
            </li>
          </ul>
          <div style={{
            marginTop: 14, padding: "10px 12px",
            background: theme.codeBg, border: `1px solid ${theme.borderHair}`, borderRadius: 8,
            fontFamily: "Geist, monospace", fontSize: 12.5, color: theme.textMed,
          }}>
            <span style={{ color: theme.text, fontWeight: 600 }}>{wt.branch}</span>
            <span style={{ color: theme.textLow }}> · </span>
            <span>3 ahead · 0 behind · 5 modified</span>
          </div>
        </div>
        <ModalFooter theme={theme}>
          <button onClick={onClose} style={btnSecondary(theme)}>Cancelar</button>
          <button onClick={onConfirm} style={{
            ...btnPrimary({ value: theme.error, light: "#F47561" }),
          }}>
            <JIcon name="stop" size={12} />
            Forzar detención
          </button>
        </ModalFooter>
      </div>
    </Overlay>
  );
}

// ─── modal primitives ────────────────────────────────────────────────
function Overlay({ theme, onClose, children }) {
  return (
    <div onClick={onClose} style={{
      position: "absolute", inset: 0, zIndex: 100,
      background: theme.scrim,
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      paddingTop: "12vh",
    }}>{children}</div>
  );
}

function ModalHeader({ theme, title, icon, accent, onClose }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "16px 22px 8px",
    }}>
      <span style={{
        width: 28, height: 28, borderRadius: 8,
        background: (accent.darkBg || accent.bgDim || accent.bg),
        color: accent.value,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <JIcon name={icon} size={14} />
      </span>
      <span style={{ fontSize: 17, fontWeight: 600, color: theme.text }}>{title}</span>
      <div style={{ flex: 1 }} />
      <button onClick={onClose} style={{
        width: 24, height: 24, borderRadius: 6,
        border: 0, background: "transparent", color: theme.textMed,
        display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
      }}>
        <JIcon name="x" size={14} />
      </button>
    </div>
  );
}

function ModalFooter({ theme, children }) {
  return (
    <div style={{
      display: "flex", gap: 8, justifyContent: "flex-end",
      padding: "16px 22px 18px", marginTop: 12,
      borderTop: `1px solid ${theme.borderHair}`,
      background: theme.panelMuted,
    }}>{children}</div>
  );
}

function modalStyle(theme, width) {
  return {
    width, maxHeight: "76vh", display: "flex", flexDirection: "column",
    background: theme.panelBg, color: theme.text,
    borderRadius: 14, border: `1px solid ${theme.border}`,
    boxShadow: theme.modalShadow,
    overflow: "hidden",
  };
}

function Row({ label, theme, children }) {
  return (
    <div>
      <label style={{
        display: "block", fontSize: 11.5, fontWeight: 500,
        color: theme.textMed, marginBottom: 5,
        letterSpacing: 0.2,
      }}>{label}</label>
      {children}
    </div>
  );
}

function Select({ theme, value, onChange, options }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{
      width: "100%", height: 38, padding: "0 10px",
      background: theme.inputBg, color: theme.text,
      border: `1px solid ${theme.border}`, borderRadius: 8,
      outline: 0, fontFamily: "Geist, monospace", fontSize: 13,
      appearance: "none",
      backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='${encodeURIComponent(theme.textMed)}' d='M0 0h10L5 6z'/></svg>")`,
      backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center",
      paddingRight: 32,
    }}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Input({ theme, value, onChange, placeholder, mono }) {
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{
      width: "100%", height: 38, boxSizing: "border-box", padding: "0 12px",
      background: theme.inputBg, color: theme.text,
      border: `1px solid ${theme.border}`, borderRadius: 8,
      outline: 0,
      fontFamily: mono ? "Geist, monospace" : "inherit", fontSize: 13,
    }} />
  );
}

function btnPrimary(accent) {
  return {
    height: 36, padding: "0 14px",
    display: "inline-flex", alignItems: "center", gap: 6,
    borderRadius: 8, background: accent.value, color: "#fff",
    border: 0, cursor: "pointer",
    fontFamily: "inherit", fontSize: 13, fontWeight: 600,
  };
}
function btnSecondary(theme) {
  return {
    height: 36, padding: "0 14px",
    borderRadius: 8, background: "transparent", color: theme.text,
    border: `1px solid ${theme.border}`, cursor: "pointer",
    fontFamily: "inherit", fontSize: 13, fontWeight: 500,
  };
}
function inlineCode(theme) {
  return {
    fontFamily: "Geist, monospace", fontSize: 12,
    padding: "1px 5px", borderRadius: 4,
    background: theme.codeBg, border: `1px solid ${theme.borderHair}`,
    color: theme.text,
  };
}

Object.assign(window, { StatusBar, CommandPalette, NewWorktreeDialog, KillConfirmDialog });
