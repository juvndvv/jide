import type { Project, Worktree } from '@shared/project';
import { SidebarSection } from './SidebarSection';
import { SidebarRow } from './SidebarRow';
import { ProjectNode } from './ProjectNode';

export function Sidebar({
  projects,
  worktreesByProject,
  activeWorktreeId,
  onToggleProject,
  onSelectWorktree,
  onAddProject,
  onNewWorktree,
}: {
  projects: Project[];
  worktreesByProject: Record<string, Worktree[]>;
  activeWorktreeId: string | null;
  onToggleProject: (id: string) => void;
  onSelectWorktree: (id: string) => void;
  onAddProject: () => void;
  onNewWorktree: () => void;
}) {
  return (
    <aside
      data-testid="sidebar"
      style={{
        width: 260,
        flexShrink: 0,
        height: '100%',
        background: '#F6F4EF',
        borderRight: '1px solid #00000010',
        display: 'flex',
        flexDirection: 'column',
        fontSize: 13,
      }}
    >
      <div style={{ padding: '12px 14px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            fontFamily: '"Bowlby One SC", Anton, Impact, sans-serif',
            fontSize: 22,
            color: 'var(--jide-accent)',
            letterSpacing: -0.5,
          }}
        >
          jide
        </span>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 6px 12px' }}>
        <SidebarSection label="Proyectos">
          {projects.map((p) => (
            <ProjectNode
              key={p.id}
              project={p}
              worktrees={worktreesByProject[p.id] ?? []}
              activeWorktreeId={activeWorktreeId}
              onToggle={() => onToggleProject(p.id)}
              onSelectWorktree={onSelectWorktree}
            />
          ))}
        </SidebarSection>

        <SidebarSection label="Atajos" style={{ marginTop: 14 }}>
          <SidebarRow icon="plus" onClick={onNewWorktree} kbd="⌘N">
            Nuevo worktree
          </SidebarRow>
          <SidebarRow icon="folder" onClick={onAddProject} kbd="⌘O">
            Añadir proyecto
          </SidebarRow>
          <SidebarRow icon="settings" kbd="⌘,">
            Ajustes
          </SidebarRow>
        </SidebarSection>
      </div>
    </aside>
  );
}
