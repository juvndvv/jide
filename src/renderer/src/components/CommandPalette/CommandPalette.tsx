import { Command } from 'cmdk';
import { useState, type JSX } from 'react';
import type { Project, Worktree } from '@shared/project';
import { Overlay } from '../../overlay/Overlay';
import { useTheme } from '../../theme/useTheme';
import { normalize } from './normalize';
import { PaletteActionsGroup } from './PaletteActionsGroup';
import { PaletteWorktreesGroup } from './PaletteWorktreesGroup';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  projects: Project[];
  worktreesById: ReadonlyMap<string, Worktree>;
  onOpenWorktree: (worktreeId: string, projectId: string) => void;
}

export function CommandPalette({
  open,
  onClose,
  projects,
  worktreesById,
  onOpenWorktree,
}: CommandPaletteProps): JSX.Element | null {
  const { theme } = useTheme();
  const [query, setQuery] = useState('');
  if (!open) return null;
  return (
    <Overlay
      id="palette"
      z={200}
      onClose={onClose}
      ariaLabel="Command palette"
      dataTestId="command-palette"
    >
      <div
        style={{
          width: 560,
          maxHeight: '70vh',
          background: theme.panelBg,
          borderRadius: 10,
          boxShadow: theme.modalShadow,
          overflow: 'hidden',
          color: theme.text,
          border: `1px solid ${theme.border}`,
        }}
      >
        <Command
          label="Command palette"
          filter={(value, search, keywords) => {
            const haystack = normalize([value, ...(keywords ?? [])].join(' '));
            return haystack.includes(normalize(search)) ? 1 : 0;
          }}
        >
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder="Buscar acciones, worktrees, archivos…"
            autoFocus
            style={{
              width: '100%',
              padding: '14px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: `1px solid ${theme.border}`,
              outline: 'none',
              color: theme.text,
              fontSize: 15,
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
          <Command.List
            style={{
              maxHeight: 420,
              overflow: 'auto',
              padding: 8,
            }}
          >
            <Command.Empty style={{ padding: 12, color: theme.textMed }}>
              Sin resultados.
            </Command.Empty>
            <PaletteActionsGroup onSelect={onClose} />
            <PaletteWorktreesGroup
              projects={projects}
              worktreesById={worktreesById}
              onOpen={onOpenWorktree}
              onSelect={onClose}
            />
            {/* PaletteFilesGroup arrives in Task 7 */}
          </Command.List>
        </Command>
      </div>
    </Overlay>
  );
}
