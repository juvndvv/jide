// jide — sidebar: project tree, expandable, with worktrees nested.
// Tree pattern: project (folder) → worktrees (branches). Status dot per worktree.

function Sidebar({ theme, accent, density, projects, activeTabId, onSelectWorktree, onToggleProject, onNewWorktree, onOpenPalette, side = "left" }) {
  const borderSide = side === "left" ? "borderRight" : "borderLeft";
  return (
    <aside style={{
      width: density.side, flexShrink: 0, height: "100%",
      background: theme.sidebarBg, [borderSide]: `1px solid ${theme.borderHair}`,
      display: "flex", flexDirection: "column",
      paddingTop: 0, // header strip painted by App above this
      fontSize: density.font,
    }}>
      {/* Wordmark + search affordance */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: `12px 14px 10px ${side === "left" ? 14 : 14}px`,
        flexShrink: 0,
      }}>
        <span style={{
          fontFamily: "Bowlby One SC, Anton, Impact, sans-serif",
          fontSize: 22, lineHeight: 1, color: accent.value, letterSpacing: -0.5,
        }}>jide</span>
        <span style={{
          fontFamily: "Geist, ui-monospace, monospace", fontSize: 10,
          color: theme.textLow, letterSpacing: 0.3, marginTop: 6,
        }}>0.4.2</span>
        <div style={{ flex: 1 }} />
        <button onClick={onOpenPalette} title="Comandos (⌘K)" style={{
          height: 26, padding: "0 8px", display: "inline-flex", alignItems: "center", gap: 6,
          borderRadius: 6, border: `1px solid ${theme.border}`,
          background: theme.panelBg, color: theme.textMed, cursor: "pointer",
        }}>
          <JIcon name="search" size={12} />
          <Kbd theme={theme}>⌘K</Kbd>
        </button>
      </div>

      {/* Tree */}
      <div style={{ flex: 1, overflow: "auto", padding: `4px ${density.gap}px 12px` }}>
        <SidebarSection label="Proyectos" theme={theme}>
          {projects.map((p) => (
            <ProjectNode key={p.id} project={p} theme={theme} accent={accent} density={density}
              activeTabId={activeTabId}
              onToggle={() => onToggleProject(p.id)}
              onSelectWorktree={onSelectWorktree} />
          ))}
        </SidebarSection>

        <SidebarSection label="Atajos" theme={theme} style={{ marginTop: 14 }}>
          <SidebarRow theme={theme} icon="plus" onClick={onNewWorktree} kbd="⌘N">Nuevo worktree</SidebarRow>
          <SidebarRow theme={theme} icon="folder" kbd="⌘O">Añadir proyecto</SidebarRow>
          <SidebarRow theme={theme} icon="settings" kbd="⌘,">Ajustes</SidebarRow>
        </SidebarSection>
      </div>

      {/* Footer: claude CLI health */}
      <div style={{
        borderTop: `1px solid ${theme.borderHair}`, padding: "10px 14px",
        display: "flex", alignItems: "center", gap: 8, color: theme.textMed, fontSize: 11,
      }}>
        <StatusDot state="done" />
        <span style={{ fontFamily: "Geist, monospace", letterSpacing: 0 }}>claude</span>
        <span style={{ color: theme.textLow, fontFamily: "Geist, monospace" }}>v1.0.18</span>
        <div style={{ flex: 1 }} />
        <span style={{ color: theme.textLow }}>3 activas</span>
      </div>
    </aside>
  );
}

function SidebarSection({ label, theme, children, style }) {
  return (
    <div style={{ marginBottom: 8, ...(style || {}) }}>
      <div style={{
        padding: "8px 10px 4px", fontSize: 10.5, fontWeight: 600,
        letterSpacing: 0.6, textTransform: "uppercase", color: theme.textLow,
      }}>{label}</div>
      <div>{children}</div>
    </div>
  );
}

function ProjectNode({ project, theme, accent, density, activeTabId, onToggle, onSelectWorktree }) {
  const isOpen = project.expanded;
  const activeMatch = project.worktrees.some((w) => w.id === activeTabId);
  return (
    <div>
      <button onClick={onToggle} style={{
        width: "100%", display: "flex", alignItems: "center", gap: 6,
        padding: "5px 10px", height: density.row,
        border: 0, background: "transparent", color: theme.text,
        cursor: "pointer", borderRadius: 6, textAlign: "left",
        fontFamily: "inherit", fontSize: "inherit", fontWeight: 600,
      }}>
        <JIcon name={isOpen ? "chev-d" : "chev-r"} size={11} style={{ color: theme.textLow }} />
        <JIcon name={isOpen ? "folder-open" : "folder"} size={14}
          style={{ color: activeMatch ? accent.value : theme.textMed }} />
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{project.name}</span>
        <span style={{
          fontFamily: "Geist, monospace", fontSize: 11, color: theme.textLow,
          fontWeight: 500,
        }}>{project.worktrees.length}</span>
      </button>
      {isOpen && (
        <div style={{ paddingLeft: 0, marginBottom: 2 }}>
          {project.worktrees.map((w) => (
            <WorktreeRow key={w.id} w={w} theme={theme} accent={accent} density={density}
              active={w.id === activeTabId}
              onClick={() => onSelectWorktree(w.id, project.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function WorktreeRow({ w, theme, accent, density, active, onClick }) {
  const [hover, setHover] = React.useState(false);
  const sessions = (typeof JIDE_CHATS !== "undefined" && JIDE_CHATS[w.id]) || [];
  const sessionCount = sessions.length;
  const bg = active
    ? accent.value + "1F" // 12% accent tint
    : (hover ? theme.hoverBg : "transparent");
  const indicator = active ? accent.value : "transparent";
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 8,
        padding: "0 10px 0 28px", height: density.row,
        border: 0, background: bg, color: theme.text,
        cursor: "pointer", borderRadius: 6, textAlign: "left",
        fontFamily: "inherit", fontSize: "inherit",
        position: "relative",
      }}>
      <span style={{
        position: "absolute", left: 14, top: "20%", bottom: "20%", width: 2,
        background: indicator, borderRadius: 2,
      }} />
      <JIcon name="branch" size={12} style={{ color: active ? accent.value : theme.textLow }} />
      <span style={{
        fontFamily: "Geist, ui-monospace, monospace", fontSize: density.mono,
        flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        fontWeight: active ? 600 : 500,
        color: active ? theme.text : theme.text,
      }}>{w.branch}</span>
      {sessionCount > 1 && (
        <span title={`${sessionCount} sesiones Claude`} style={{
          fontFamily: "Geist, monospace", fontSize: 10, color: theme.textMed,
          fontWeight: 600, padding: "1px 5px", borderRadius: 4,
          background: active ? "transparent" : theme.panelMuted,
          border: `1px solid ${theme.borderHair}`,
          lineHeight: 1.2,
        }}>{sessionCount}×</span>
      )}
      {w.changes > 0 && (
        <span style={{
          fontFamily: "Geist, monospace", fontSize: 10, color: theme.textLow,
          fontWeight: 500,
        }}>{w.changes}</span>
      )}
      <StatusDot state={w.claude} accent={accent} />
    </button>
  );
}

function SidebarRow({ theme, icon, children, onClick, kbd }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 8,
        padding: "0 10px", height: 28,
        border: 0, background: hover ? theme.hoverBg : "transparent",
        color: theme.text, cursor: "pointer", borderRadius: 6, textAlign: "left",
        fontFamily: "inherit", fontSize: "inherit",
      }}>
      <JIcon name={icon} size={13} style={{ color: theme.textMed }} />
      <span style={{ flex: 1 }}>{children}</span>
      {kbd && <Kbd theme={theme}>{kbd}</Kbd>}
    </button>
  );
}

Object.assign(window, { Sidebar });
