import { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatPanel } from './components/Chat';
import { NewWorktreeDialog } from './components/dialogs/NewWorktreeDialog';
import { TopChromeStrip } from './components/Chrome/TopChromeStrip';
import { StatusBar } from './components/StatusBar/StatusBar';
import { useProjects } from './shortcuts/useProjects';
import { useTheme } from './theme/useTheme';

export function App(): JSX.Element {
  const { theme, sidebarSide } = useTheme();
  const { projects, add, toggleExpanded } = useProjects();
  const [activeWorktreeId, setActiveWorktreeId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [dialogOpenFor, setDialogOpenFor] = useState<string | null>(null);
  const [maxSessions, setMaxSessions] = useState<number>(4);

  useEffect(() => {
    window.jide.settings
      .get('maxSessionsPerWorktree')
      .then(setMaxSessions)
      .catch((err: unknown) => {
        console.error('[jide] settings:get maxSessionsPerWorktree failed', err);
      });
  }, []);

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;

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
      <TopChromeStrip project={activeProject} worktree={null} />
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
            setActiveWorktreeId(id);
            const matched = projects.find((p) => id.startsWith(`${p.path}:`));
            if (matched) setActiveProjectId(matched.id);
          }}
          onAddProject={() => {
            add().catch((err: unknown) => {
              console.error('[jide] projects:add failed', err);
            });
          }}
          onNewWorktree={() => {
            if (activeProjectId) setDialogOpenFor(activeProjectId);
            else if (projects[0]) setDialogOpenFor(projects[0].id);
          }}
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
          <ChatPanel worktreeId={activeWorktreeId} maxSessionsPerWorktree={maxSessions} />
        </main>
      </div>
      <StatusBar project={activeProject} worktree={null} />

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
