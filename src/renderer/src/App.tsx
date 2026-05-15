import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import { Sidebar } from './components/Sidebar';
import { NewWorktreeDialog } from './components/dialogs/NewWorktreeDialog';
import { TopChromeStrip } from './components/Chrome/TopChromeStrip';
import { StatusBar } from './components/StatusBar/StatusBar';
import { TabBar } from './components/TabBar';
import { WorktreeView } from './components/Worktree/WorktreeView';
import { useProjects } from './shortcuts/useProjects';
import { useAllWorktrees } from './shortcuts/useAllWorktrees';
import { useTabs } from './shortcuts/useTabs';
import { useTheme } from './theme/useTheme';
import { useGlobalShortcuts } from './shortcuts/useGlobalShortcuts';
import { useWorktreeLayout } from './shortcuts/useWorktreeLayout';
import { OpenFileProvider } from './components/Chat/OpenFileContext';

export function App(): JSX.Element {
  const { theme, sidebarSide } = useTheme();
  const { projects, add, toggleExpanded } = useProjects();
  const { worktreesById } = useAllWorktrees(projects);
  const { tabs, activeWorktreeId, open, close } = useTabs({ projects, worktreesById });
  const [dialogOpenFor, setDialogOpenFor] = useState<string | null>(null);
  const [maxSessions, setMaxSessions] = useState<number>(4);
  const [tweaksOpen, setTweaksOpen] = useState<boolean>(false);

  useEffect(() => {
    window.jide.settings
      .get('maxSessionsPerWorktree')
      .then(setMaxSessions)
      .catch((err: unknown) => {
        console.error('[jide] settings:get maxSessionsPerWorktree failed', err);
      });
  }, []);

  const activeTab = tabs.find((t) => t.worktreeId === activeWorktreeId) ?? null;
  const activeProject = activeTab ? (projects.find((p) => p.id === activeTab.projectId) ?? null) : null;
  const activeWt = activeWorktreeId ? (worktreesById.get(activeWorktreeId) ?? null) : null;

  const { layout, ops } = useWorktreeLayout(activeWorktreeId);

  const onOpenFile = useCallback(
    (toolPath: string) => {
      if (!activeWorktreeId) return;
      window.jide.files.openInViewer(activeWorktreeId, toolPath)
        .then((res) => {
          if (!res) {
            console.warn('[jide] tool message path outside worktree:', toolPath);
            return;
          }
          ops.openViewer(res.relPath);
        })
        .catch((err: unknown) => {
          console.error('[jide] files.openInViewer failed', err);
        });
    },
    [activeWorktreeId, ops],
  );

  const handlers = useMemo(
    () => ({
      onToggleTweaks: () => setTweaksOpen((v) => !v),
      onNewWorktree: () => {
        if (activeProject) setDialogOpenFor(activeProject.id);
        else if (projects[0]) setDialogOpenFor(projects[0].id);
      },
      onEscape: () => {
        if (dialogOpenFor) setDialogOpenFor(null);
        else if (tweaksOpen) setTweaksOpen(false);
      },
      onToggleTerminal: () => ops.cycleTerminal(),
      onToggleViewer: () => ops.toggleViewer(),
    }),
    [activeProject, projects, dialogOpenFor, tweaksOpen, ops],
  );

  useGlobalShortcuts(handlers);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: theme.appBg,
        color: theme.text,
      }}
    >
      <TopChromeStrip project={activeProject} worktree={activeWt} />
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: sidebarSide === 'right' ? 'row-reverse' : 'row',
          minHeight: 0,
        }}
      >
        <Sidebar
          projects={projects}
          activeWorktreeId={activeWorktreeId}
          onToggleProject={toggleExpanded}
          onSelectWorktree={(id) => {
            const matched = projects.find((p) => id.startsWith(`${p.path}:`));
            if (matched) open(id, matched.id);
          }}
          onAddProject={() => {
            add().catch((err: unknown) => {
              console.error('[jide] projects:add failed', err);
            });
          }}
          onNewWorktree={() => {
            if (activeProject) setDialogOpenFor(activeProject.id);
            else if (projects[0]) setDialogOpenFor(projects[0].id);
          }}
          tweaksOpen={tweaksOpen}
          onToggleTweaks={() => setTweaksOpen((v) => !v)}
        />
        <OpenFileProvider value={onOpenFile}>
          <main
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
              minHeight: 0,
              background: theme.panelBg,
            }}
          >
            <TabBar
              tabs={tabs}
              projects={projects}
              worktreesById={worktreesById}
              activeWorktreeId={activeWorktreeId}
              onSelect={(wid, pid) => open(wid, pid)}
              onClose={close}
              onNew={() => {
                if (activeProject) setDialogOpenFor(activeProject.id);
                else if (projects[0]) setDialogOpenFor(projects[0].id);
              }}
            />
            <WorktreeView
              worktreeId={activeWorktreeId}
              worktree={activeWt}
              shellName="zsh"
              maxSessionsPerWorktree={maxSessions}
              layout={layout}
              ops={ops}
            />
          </main>
        </OpenFileProvider>
      </div>
      <StatusBar
        project={activeProject}
        worktree={activeWt}
        terminalSplit={layout.terminal}
        onToggleTerminal={() => ops.cycleTerminal()}
      />

      {dialogOpenFor && (
        <NewWorktreeDialog
          project={projects.find((p) => p.id === dialogOpenFor) ?? projects[0]!}
          onCancel={() => setDialogOpenFor(null)}
          onCreated={() => setDialogOpenFor(null)}
        />
      )}
    </div>
  );
}
