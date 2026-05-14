// jide — main App: composes the macOS frame, sidebar, tabs, chat, terminal, viewer
// and overlays. Drives all interactive state. `forceState` lets us pin specific
// screens for the static state cards on the design canvas.

function JideApp({
  // tweakable defaults (driven by Tweaks panel)
  themeMode = "light", densityKey = "comfy", accentKey = "coral", sidebarSide = "left",
  // optional state pins for the canvas state cards
  forceState = null,
  // size for the inner content (defaults to a full-bleed prototype)
  width = 1440, height = 900,
}) {
  const theme = useTheme(themeMode);
  const accent = JIDE_ACCENTS[accentKey] || JIDE_ACCENTS.coral;
  const density = JIDE_DENSITY[densityKey] || JIDE_DENSITY.comfy;

  // ───── interactive state ─────
  const [projects, setProjects] = React.useState(() => JSON.parse(JSON.stringify(JIDE_PROJECTS)));
  const [tabs, setTabs] = React.useState(() => JIDE_INITIAL_TABS.slice());
  const [activeId, setActiveId] = React.useState("yu-billing");
  const [overlay, setOverlay] = React.useState(null);     // null | 'palette' | 'newWorktree' | 'killConfirm'
  const [split, setSplit] = React.useState("v");          // 'off' | 'v' (bottom) | 'h' (side)
  const [viewer, setViewer] = React.useState(false);
  const [viewerPath, setViewerPath] = React.useState("apps/api/prisma/migrations/20260514_billing/migration.sql");
  const [killTarget, setKillTarget] = React.useState(null);

  // Multi-session state: each worktree holds N Claude sessions.
  // sessionsByWt is keyed by worktreeId; activeSessionByWt remembers the
  // last-focused session per worktree so switching tabs feels stable.
  const [sessionsByWt, setSessionsByWt] = React.useState(() => JSON.parse(JSON.stringify(JIDE_CHATS)));
  const [activeSessionByWt, setActiveSessionByWt] = React.useState(() => {
    const m = {};
    Object.keys(JIDE_CHATS).forEach((wt) => { m[wt] = JIDE_CHATS[wt][0]?.id; });
    return m;
  });

  // Apply forced state overrides (for static state cards)
  React.useEffect(() => {
    if (!forceState) return;
    if (forceState.overlay !== undefined) setOverlay(forceState.overlay);
    if (forceState.split   !== undefined) setSplit(forceState.split);
    if (forceState.viewer  !== undefined) setViewer(forceState.viewer);
    if (forceState.activeId !== undefined) setActiveId(forceState.activeId);
    if (forceState.killTarget !== undefined) setKillTarget(forceState.killTarget);
    if (forceState.activeSessionByWt !== undefined) {
      setActiveSessionByWt((m) => ({ ...m, ...forceState.activeSessionByWt }));
    }
  }, [forceState]);

  const findWt = (id) => projects.flatMap((p) => p.worktrees).find((w) => w.id === id);
  const activeProject = projects.find((p) => p.worktrees.some((w) => w.id === activeId)) || projects[0];
  const activeWtRaw = findWt(activeId) || activeProject.worktrees[0];
  const wtSessions = sessionsByWt[activeWtRaw.id] || [];
  const activeWt = { ...activeWtRaw, claude: jideRollupClaude(wtSessions) };
  const activeSessionId = activeSessionByWt[activeWtRaw.id] || wtSessions[0]?.id;

  // ───── handlers ─────
  const selectWt = (wid, pid) => {
    setActiveId(wid);
    setTabs((t) => (t.some((x) => x.worktreeId === wid) ? t : [...t, { worktreeId: wid, projectId: pid }]));
  };
  const closeTab = (wid) => {
    setTabs((t) => t.filter((x) => x.worktreeId !== wid));
    if (activeId === wid) {
      const remaining = tabs.filter((x) => x.worktreeId !== wid);
      if (remaining.length) setActiveId(remaining[remaining.length - 1].worktreeId);
    }
  };
  const toggleProject = (pid) => setProjects((ps) => ps.map((p) => p.id === pid ? { ...p, expanded: !p.expanded } : p));
  const openPalette = () => setOverlay("palette");
  const openNew     = () => setOverlay("newWorktree");
  const toggleSplit = () => setSplit((s) => s === "off" ? "v" : s === "v" ? "h" : "off");
  const toggleViewer = () => setViewer((v) => !v);
  const killSession = () => setOverlay("killConfirm");

  // ───── session handlers ─────
  const selectSession = (sessionId) => {
    setActiveSessionByWt((m) => ({ ...m, [activeWtRaw.id]: sessionId }));
  };
  const closeSession = (sessionId) => {
    setSessionsByWt((m) => {
      const remaining = (m[activeWtRaw.id] || []).filter((s) => s.id !== sessionId);
      return { ...m, [activeWtRaw.id]: remaining };
    });
    setActiveSessionByWt((m) => {
      if (m[activeWtRaw.id] !== sessionId) return m;
      const next = (sessionsByWt[activeWtRaw.id] || []).filter((s) => s.id !== sessionId);
      return { ...m, [activeWtRaw.id]: next[next.length - 1]?.id };
    });
  };
  const newSession = () => {
    const id = `${activeWtRaw.id}-s${Date.now().toString(36).slice(-4)}`;
    const fresh = {
      id, title: "Sesi\u00f3n nueva",
      claude: "idle", since: "ahora", model: "sonnet-4.5",
      tokens: 0, ctxPct: 0, costUsd: 0,
      messages: [{ type: "system", text: "Nueva sesi\u00f3n Claude lanzada en este worktree" }],
    };
    setSessionsByWt((m) => ({ ...m, [activeWtRaw.id]: [...(m[activeWtRaw.id] || []), fresh] }));
    setActiveSessionByWt((m) => ({ ...m, [activeWtRaw.id]: id }));
  };

  // ───── global keyboard shortcuts ─────
  React.useEffect(() => {
    if (forceState) return; // pinned canvas cards don't capture keys
    const k = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k" && !e.shiftKey) { e.preventDefault(); setOverlay((o) => o === "palette" ? null : "palette"); }
      else if (mod && e.shiftKey && e.key.toLowerCase() === "k") { e.preventDefault(); killSession(); }
      else if (mod && e.key === "\\") { e.preventDefault(); toggleSplit(); }
      else if (mod && e.key.toLowerCase() === "o") { e.preventDefault(); toggleViewer(); }
      else if (mod && e.key.toLowerCase() === "n") { e.preventDefault(); openNew(); }
      else if (mod && e.key.toLowerCase() === "t") { e.preventDefault(); newSession(); }
      else if (e.key === "Escape") setOverlay(null);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [forceState, activeWtRaw.id]);

  // ───── palette dispatch ─────
  const onPalettePick = (it) => {
    setOverlay(null);
    if (it.id.startsWith("wt:")) { const wid = it.id.slice(3); const proj = projects.find((p) => p.worktrees.some((w) => w.id === wid)); selectWt(wid, proj?.id); }
    else if (it.id === "act:new-wt")      setOverlay("newWorktree");
    else if (it.id === "act:new-session") newSession();
    else if (it.id === "act:kill")        killSession();
    else if (it.id === "act:toggle-term") toggleSplit();
    else if (it.id === "act:viewer")      toggleViewer();
    else if (it.id.startsWith("f:"))      { setViewer(true); /* file content stays mock */ }
  };

  // ───── layout ─────
  // The mac chrome strip docks traffic lights into a 28-px-tall bar above the tab row.
  // The sidebar fills full height below that strip.
  const chromeStripH = 30;

  return (
    <MacFrame width={width} height={height} theme={theme}>
      {/* TOP CHROME STRIP — traffic lights + project breadcrumb */}
      <div style={{
        display: "flex", alignItems: "center", gap: 14,
        height: chromeStripH, padding: "0 16px",
        background: theme.appBg, flexShrink: 0,
        borderBottom: `1px solid ${theme.borderHair}`,
        WebkitAppRegion: "drag",
      }}>
        <TrafficLights />
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: theme.textMed, fontSize: 12 }}>
          <JIcon name="folder" size={12} />
          <span style={{ fontFamily: "Geist, monospace" }}>{activeProject.name}</span>
          <span style={{ color: theme.textLow }}>/</span>
          <span style={{ fontFamily: "Geist, monospace", color: theme.text, fontWeight: 600 }}>{activeWt.branch}</span>
          {activeWt.changes > 0 && (
            <span style={{
              marginLeft: 6, padding: "1px 6px", borderRadius: 4,
              background: theme.warning + "1F", color: theme.warning,
              fontFamily: "Geist, monospace", fontSize: 10.5, fontWeight: 600,
            }}>{activeWt.changes} cambios</span>
          )}
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={openPalette} title="Comandos (⌘K)" style={{
          height: 22, padding: "0 8px", display: "inline-flex", alignItems: "center", gap: 5,
          borderRadius: 5, border: `1px solid ${theme.border}`,
          background: theme.panelMuted, color: theme.textMed, cursor: "pointer",
          fontSize: 11,
        }}>
          <JIcon name="command" size={10} />
          <span>K</span>
        </button>
      </div>

      {/* BODY */}
      <div style={{ flex: 1, display: "flex", minHeight: 0, flexDirection: sidebarSide === "right" ? "row-reverse" : "row" }}>
        <Sidebar theme={theme} accent={accent} density={density} side={sidebarSide}
          projects={projects} activeTabId={activeId}
          onSelectWorktree={selectWt}
          onToggleProject={toggleProject}
          onNewWorktree={openNew}
          onOpenPalette={openPalette} />

        <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, background: theme.panelBg }}>
          <TabBar theme={theme} accent={accent} density={density}
            tabs={tabs} projects={projects} activeId={activeId}
            onSelect={selectWt} onClose={closeTab} onNew={openNew} />

          <div style={{ flex: 1, display: "flex", flexDirection: split === "v" ? "column" : "row", minWidth: 0, minHeight: 0 }}>
            <div style={{ flex: 1, display: "flex", minWidth: 0, minHeight: 0 }}>
              <ClaudeChat theme={theme} accent={accent} density={density}
                sessions={wtSessions} activeSessionId={activeSessionId}
                onSelectSession={selectSession}
                onCloseSession={closeSession}
                onNewSession={newSession}
                onAsk={(t) => {/* mock */}}
                onKill={killSession} />
              {viewer && (
                <FileViewerPanel theme={theme} accent={accent} density={density}
                  tree={JIDE_FILE_TREE} openPath={viewerPath}
                  content={JIDE_FILE_CONTENT[viewerPath]}
                  onSelect={(p) => setViewerPath(p)} onClose={() => setViewer(false)} />
              )}
            </div>
            {split !== "off" && (
              <TerminalPanel theme={theme} accent={accent} density={density}
                lines={JIDE_TERMINAL_LINES}
                orientation={split}
                onClose={() => setSplit("off")}
                onToggleOrientation={() => setSplit((s) => s === "v" ? "h" : "v")} />
            )}
          </div>

          <StatusBar theme={theme} accent={accent}
            wt={activeWt} project={activeProject}
            splitOrientation={split === "off" ? null : split}
            onToggleSplit={toggleSplit}
            onOpenPalette={openPalette}
            viewerOpen={viewer} onToggleViewer={toggleViewer} />
        </main>
      </div>

      {/* OVERLAYS */}
      {overlay === "palette" && (
        <CommandPalette theme={theme} accent={accent} groups={JIDE_PALETTE}
          onClose={() => setOverlay(null)} onPick={onPalettePick} />
      )}
      {overlay === "newWorktree" && (
        <NewWorktreeDialog theme={theme} accent={accent} projects={projects}
          onClose={() => setOverlay(null)} onCreate={() => setOverlay(null)} />
      )}
      {overlay === "killConfirm" && (
        <KillConfirmDialog theme={theme} accent={accent} wt={activeWt}
          onClose={() => setOverlay(null)} onConfirm={() => setOverlay(null)} />
      )}
    </MacFrame>
  );
}

Object.assign(window, { JideApp });
