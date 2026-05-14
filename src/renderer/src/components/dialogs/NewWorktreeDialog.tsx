import { useEffect, useState } from 'react';
import type { Project } from '@shared/project';
import { useTheme } from '../../theme/useTheme';

export function NewWorktreeDialog({
  project,
  onCancel,
  onCreated,
}: {
  project: Project;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const { theme } = useTheme();
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [newBranchName, setNewBranchName] = useState<string>('');
  const [baseBranch, setBaseBranch] = useState<string>('main');
  const [path, setPath] = useState<string>(`${project.path}-new-wt`);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    window.jide.worktrees
      .listBranches(project.id)
      .then((bs) => {
        setBranches(bs);
        if (bs[0]) setSelectedBranch(bs[0]);
        if (bs.includes('main')) setBaseBranch('main');
        else if (bs[0]) setBaseBranch(bs[0]);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  }, [project.id]);

  const submit = async (): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      if (mode === 'existing') {
        await window.jide.worktrees.add(project.id, { branch: selectedBranch, path });
      } else {
        await window.jide.worktrees.add(project.id, {
          branch: newBranchName,
          baseBranch,
          path,
        });
      }
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid="new-worktree-dialog"
      role="dialog"
      style={{
        position: 'fixed',
        inset: 0,
        background: theme.scrim,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 480,
          background: theme.panelBg,
          borderRadius: 10,
          padding: 20,
          boxShadow: theme.modalShadow,
          fontFamily: 'inherit',
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18, marginBottom: 12 }}>Nuevo worktree</h2>
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <label>
            <input
              type="radio"
              checked={mode === 'existing'}
              onChange={() => setMode('existing')}
            />{' '}
            Rama existente
          </label>
          <label>
            <input type="radio" checked={mode === 'new'} onChange={() => setMode('new')} /> Rama
            nueva
          </label>
        </div>

        {mode === 'existing' ? (
          <label style={{ display: 'block', marginBottom: 10 }}>
            Rama
            <select
              data-testid="dialog-branch-select"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              style={{ display: 'block', width: '100%', padding: 6, marginTop: 4 }}
            >
              {branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <label style={{ display: 'block', marginBottom: 10 }}>
              Nombre de la rama
              <input
                data-testid="dialog-new-branch"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                style={{ display: 'block', width: '100%', padding: 6, marginTop: 4 }}
                placeholder="feat/algo"
              />
            </label>
            <label style={{ display: 'block', marginBottom: 10 }}>
              Crear desde
              <select
                value={baseBranch}
                onChange={(e) => setBaseBranch(e.target.value)}
                style={{ display: 'block', width: '100%', padding: 6, marginTop: 4 }}
              >
                {branches.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        <label style={{ display: 'block', marginBottom: 14 }}>
          Path
          <input
            data-testid="dialog-path"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            style={{
              display: 'block',
              width: '100%',
              padding: 6,
              marginTop: 4,
              fontFamily: 'ui-monospace, monospace',
            }}
          />
        </label>

        {error && (
          <div
            data-testid="dialog-error"
            style={{
              background: theme.diffDelBg,
              color: theme.diffDelText,
              padding: 8,
              borderRadius: 6,
              marginBottom: 10,
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button
            type="button"
            data-testid="dialog-submit"
            onClick={() => void submit()}
            disabled={busy || (mode === 'new' && !newBranchName)}
          >
            {busy ? 'Creando…' : 'Crear'}
          </button>
        </div>
      </div>
    </div>
  );
}
