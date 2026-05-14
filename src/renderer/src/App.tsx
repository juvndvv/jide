import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { NewWorktreeDialog } from './components/dialogs/NewWorktreeDialog';
import { useProjects } from './shortcuts/useProjects';

export function App() {
  const { projects, add, toggleExpanded } = useProjects();
  const [activeWorktreeId, setActiveWorktreeId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [dialogOpenFor, setDialogOpenFor] = useState<string | null>(null);

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <Sidebar
        projects={projects}
        activeWorktreeId={activeWorktreeId}
        onToggleProject={toggleExpanded}
        onSelectWorktree={(id) => {
          setActiveWorktreeId(id);
          // The worktree id encodes the project root prefix (id = `${repoRoot}:${worktreePath}`).
          // For now, infer the project by matching the prefix; refined when persisted state grows.
          const matched = projects.find((p) => id.startsWith(`${p.path}:`));
          if (matched) setActiveProjectId(matched.id);
        }}
        onAddProject={() => void add()}
        onNewWorktree={() => {
          if (activeProjectId) setDialogOpenFor(activeProjectId);
          else if (projects[0]) setDialogOpenFor(projects[0].id);
        }}
      />

      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#00000040',
          fontFamily: 'ui-monospace, monospace',
          fontSize: 14,
        }}
      >
        {activeWorktreeId ?? 'Selecciona un worktree'}
      </main>

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
