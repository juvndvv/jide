import { useRef } from 'react';
import type { Project } from '@shared/project';
import { useTheme } from '../../theme/useTheme';
import { SidebarSection } from './SidebarSection';
import { SidebarRow } from './SidebarRow';
import { ProjectBranch } from './ProjectBranch';
import { TweaksPanel } from '../Tweaks';

export function Sidebar({
  projects,
  activeWorktreeId,
  onToggleProject,
  onSelectWorktree,
  onAddProject,
  onNewWorktree,
  tweaksOpen,
  onToggleTweaks,
}: {
  projects: Project[];
  activeWorktreeId: string | null;
  onToggleProject: (id: string) => void;
  onSelectWorktree: (id: string) => void;
  onAddProject: () => void;
  onNewWorktree: () => void;
  tweaksOpen: boolean;
  onToggleTweaks: () => void;
}) {
  const { theme, density, sidebarSide } = useTheme();
  const borderSide = sidebarSide === 'left' ? 'borderRight' : 'borderLeft';
  const settingsRef = useRef<HTMLButtonElement>(null);

  return (
    <aside
      data-testid="sidebar"
      style={{
        width: density.side,
        flexShrink: 0,
        height: '100%',
        background: theme.sidebarBg,
        [borderSide]: `1px solid ${theme.borderHair}`,
        display: 'flex',
        flexDirection: 'column',
        fontSize: 13,
      }}
    >
      <div style={{ flex: 1, overflow: 'auto', padding: `12px ${density.gap}px` }}>
        <SidebarSection label="Proyectos">
          {projects.map((p) => (
            <ProjectBranch
              key={p.id}
              project={p}
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
          <SidebarRow icon="folder" onClick={onAddProject}>
            Añadir proyecto
          </SidebarRow>
          <SidebarRow
            icon="settings"
            kbd="⌘,"
            data-testid="sidebar-settings"
            anchorRef={settingsRef}
            onClick={onToggleTweaks}
          >
            Ajustes
          </SidebarRow>
        </SidebarSection>
      </div>
      {tweaksOpen && (
        <TweaksPanel
          anchorRef={settingsRef}
          side={sidebarSide}
          onClose={onToggleTweaks}
        />
      )}
    </aside>
  );
}
