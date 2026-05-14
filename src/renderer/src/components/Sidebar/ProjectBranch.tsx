import type { Project } from '@shared/project';
import { useWorktrees } from '../../shortcuts/useWorktrees';
import { ProjectNode } from './ProjectNode';

export interface ProjectBranchProps {
  project: Project;
  activeWorktreeId: string | null;
  onToggle: () => void;
  onSelectWorktree: (id: string) => void;
}

export function ProjectBranch({
  project,
  activeWorktreeId,
  onToggle,
  onSelectWorktree,
}: ProjectBranchProps) {
  const { worktrees } = useWorktrees(project.id);
  return (
    <ProjectNode
      project={project}
      worktrees={worktrees}
      activeWorktreeId={activeWorktreeId}
      onToggle={onToggle}
      onSelectWorktree={onSelectWorktree}
    />
  );
}
