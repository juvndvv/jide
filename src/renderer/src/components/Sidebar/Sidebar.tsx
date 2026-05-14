import { useRef, useState } from 'react';
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
}: {
  projects: Project[];
  activeWorktreeId: string | null;
  onToggleProject: (id: string) => void;
  onSelectWorktree: (id: string) => void;
  onAddProject: () => void;
  onNewWorktree: () => void;
}) {
  const { theme, accent, density, sidebarSide } = useTheme();
  const borderSide = sidebarSide === 'left' ? 'borderRight' : 'borderLeft';
  const settingsRef = useRef<HTMLButtonElement>(null);
  const [tweaksOpen, setTweaksOpen] = useState(false);

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
      <div
        style={{
          padding: `12px ${density.gap * 2}px 10px`,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span
          style={{
            fontFamily: '"Bowlby One SC", Anton, Impact, sans-serif',
            fontSize: 22,
            color: accent.value,
            letterSpacing: -0.5,
          }}
        >
          jide
        </span>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: `4px ${density.gap}px 12px` }}>
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
          <SidebarRow icon="folder" onClick={onAddProject} kbd="⌘O">
            Añadir proyecto
          </SidebarRow>
          <SidebarRow
            icon="settings"
            kbd="⌘,"
            data-testid="sidebar-settings"
            anchorRef={settingsRef}
            onClick={() => setTweaksOpen((v) => !v)}
          >
            Ajustes
          </SidebarRow>
        </SidebarSection>
      </div>
      {tweaksOpen && (
        <TweaksPanel
          anchorRef={settingsRef}
          side={sidebarSide}
          onClose={() => setTweaksOpen(false)}
        />
      )}
    </aside>
  );
}
