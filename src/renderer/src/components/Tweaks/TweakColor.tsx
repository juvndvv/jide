import { ACCENTS, type AccentId } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

export interface TweakColorProps {
  label: string;
  value: AccentId;
  onChange: (next: AccentId) => void;
}

export function TweakColor({ label, value, onChange }: TweakColorProps): JSX.Element {
  const { theme } = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12, color: theme.textMed, minWidth: 70 }}>{label}</span>
      <div style={{ display: 'inline-flex', gap: 6 }}>
        {Object.values(ACCENTS).map((a) => {
          const active = a.id === value;
          return (
            <button
              key={a.id}
              type="button"
              aria-label={a.name}
              title={a.name}
              onClick={() => onChange(a.id)}
              style={{
                width: 22,
                height: 22,
                borderRadius: 999,
                padding: 0,
                border: active ? `2px solid ${theme.text}` : `1px solid ${theme.border}`,
                background: a.value,
                cursor: 'pointer',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
