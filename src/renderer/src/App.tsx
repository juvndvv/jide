import { useEffect, useMemo, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatPanel } from './components/Chat';
import { NewWorktreeDialog } from './components/dialogs/NewWorktreeDialog';
import { TopChromeStrip } from './components/Chrome/TopChromeStrip';
import { StatusBar } from './components/StatusBar/StatusBar';
import { TabBar } from './components/TabBar';
import { useProjects } from './shortcuts/useProjects';
import { useAllWorktrees } from './shortcuts/useAllWorktrees';
import { useTabs } from './shortcuts/useTabs';
import { useTheme } from './theme/useTheme';
import { useGlobalShortcuts } from './shortcuts/useGlobalShortcuts';

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
    }),
    [activeProject, projects, dialogOpenFor, tweaksOpen],
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
          <ChatPanel worktreeId={activeWorktreeId} maxSessionsPerWorktree={maxSessions} />
        </main>
      </div>
      <StatusBar project={activeProject} worktree={activeWt} />

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
