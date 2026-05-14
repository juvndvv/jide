// jide — VS Code style tab bar for worktrees.
// Active tab has a thin accent top stripe; modified worktrees show a filled dot
// in place of the close X (until hover).

function TabBar({ theme, accent, density, tabs, projects, activeId, onSelect, onClose, onNew }) {
  return (
    <div style={{
      display: "flex", alignItems: "stretch",
      background: theme.tabbarBg,
      borderBottom: `1px solid ${theme.borderHair}`,
      height: density.tabH + 4, // top stripe space
      flexShrink: 0, overflow: "hidden",
    }}>
      <div style={{ display: "flex", alignItems: "stretch", flex: 1, overflow: "auto" }}>
        {tabs.map((t) => {
          const project = projects.find((p) => p.id === t.projectId);
          const wt = project?.worktrees.find((w) => w.id === t.worktreeId);
          if (!wt) return null;
          return (
            <Tab key={t.worktreeId}
              theme={theme} accent={accent} density={density}
              project={project} wt={wt}
              active={t.worktreeId === activeId}
              onSelect={() => onSelect(t.worktreeId, t.projectId)}
              onClose={() => onClose(t.worktreeId)} />
          );
        })}
        <button onClick={onNew} title="Nuevo worktree (⌘N)" style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          height: density.tabH, padding: "0 12px",
          border: 0, background: "transparent", color: theme.textMed,
          cursor: "pointer", marginTop: 4,
        }}>
          <JIcon name="plus" size={14} />
        </button>
      </div>
    </div>
  );
}

function Tab({ theme, accent, density, project, wt, active, onSelect, onClose }) {
  const [hover, setHover] = React.useState(false);
  const [hoverX, setHoverX] = React.useState(false);
  const modified = wt.changes > 0;
  const sessions = (typeof JIDE_CHATS !== "undefined" && JIDE_CHATS[wt.id]) || [];
  const sessionCount = sessions.length;
  const bg = active ? theme.panelBg : (hover ? theme.hoverBg : "transparent");
  const borderRight = `1px solid ${theme.borderHair}`;
  return (
    <div
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onClick={onSelect}
      style={{
        position: "relative", display: "inline-flex", alignItems: "center", gap: 8,
        height: density.tabH, padding: "0 10px 0 12px",
        marginTop: 4, // leaves space for top stripe
        background: bg, borderRight,
        cursor: "pointer",
        maxWidth: 260, minWidth: 130,
        fontFamily: "Geist, ui-monospace, monospace",
        fontSize: density.mono,
        color: active ? theme.text : theme.textMed,
        fontWeight: active ? 600 : 500,
      }}>
      {/* Active top stripe */}
      {active && (
        <span style={{
          position: "absolute", left: 0, right: 0, top: -4, height: 2,
          background: accent.value,
        }} />
      )}
      <StatusDot state={wt.claude} accent={accent} size={6} />
      <span style={{
        color: active ? theme.textMed : theme.textLow,
        fontWeight: 500, fontFamily: "Open Sauce One, sans-serif", fontSize: 11,
      }}>{project.name}</span>
      <span style={{ color: theme.textLow, fontWeight: 400 }}>/</span>
      <span style={{
        flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{wt.branch}</span>
      {sessionCount > 1 && (
        <span title={`${sessionCount} sesiones`} style={{
          fontFamily: "Geist, monospace", fontSize: 10,
          color: active ? accent.value : theme.textLow,
          fontWeight: 600, padding: "1px 5px", borderRadius: 4,
          background: active ? accent.value + "1F" : "transparent",
          lineHeight: 1.2,
        }}>{sessionCount}×</span>
      )}
      <button
        onMouseEnter={() => setHoverX(true)} onMouseLeave={() => setHoverX(false)}
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        title="Cerrar tab"
        style={{
          width: 18, height: 18, borderRadius: 4,
          border: 0, background: hoverX ? theme.selectedBg : "transparent",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          color: theme.textMed, cursor: "pointer", padding: 0,
        }}>
        {modified && !hoverX
          ? <span style={{ width: 7, height: 7, borderRadius: 999, background: theme.textMed, display: "inline-block" }} />
          : <JIcon name="x" size={11} />}
      </button>
    </div>
  );
}

Object.assign(window, { TabBar });
