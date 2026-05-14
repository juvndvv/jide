import type { JSX } from 'react';
import type { Project, Worktree } from '@shared/project';
import type { TabRef } from '@shared/settings';
import { useTheme } from '../../theme/useTheme';
import { JIcon } from '../icons/JIcon';
import { Tab } from './Tab';

interface TabBarProps {
  tabs: TabRef[];
  projects: Project[];
  worktreesById: ReadonlyMap<string, Worktree>;
  activeWorktreeId: string | null;
  onSelect: (worktreeId: string, projectId: string) => void;
  onClose: (worktreeId: string) => void;
  onNew: () => void;
}

export function TabBar({
  tabs,
  projects,
  worktreesById,
  activeWorktreeId,
  onSelect,
  onClose,
  onNew,
}: TabBarProps): JSX.Element {
  const { theme, density } = useTheme();

  return (
    <div
      role="tablist"
      data-testid="tab-bar"
      style={{
        display: 'flex',
        alignItems: 'stretch',
        background: theme.tabbarBg,
        borderBottom: `1px solid ${theme.borderHair}`,
        height: density.tabH + 4,
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          flex: 1,
          overflow: 'auto',
        }}
      >
        {tabs.map((t) => {
          const worktree = worktreesById.get(t.worktreeId);
          const project = projects.find((p) => p.id === t.projectId);
          if (!worktree || !project) return null;
          return (
            <Tab
              key={t.worktreeId}
              project={project}
              worktree={worktree}
              active={t.worktreeId === activeWorktreeId}
              onSelect={() => onSelect(t.worktreeId, t.projectId)}
              onClose={() => onClose(t.worktreeId)}
            />
          );
        })}
      </div>

      <button
        aria-label="Nuevo worktree"
        onClick={onNew}
        style={{
          height: density.tabH,
          padding: '0 12px',
          border: 0,
          background: 'transparent',
          color: theme.textMed,
          marginTop: 4,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <JIcon name="plus" size={14} />
      </button>
    </div>
  );
}
