import type { JSX } from 'react';
import { useTheme } from '../../theme/useTheme';

export interface TweakRadioOption<T extends string> {
  value: T;
  label: string;
}

export interface TweakRadioProps<T extends string> {
  label: string;
  value: T;
  options: TweakRadioOption<T>[];
  onChange: (next: T) => void;
}

export function TweakRadio<T extends string>({
  label,
  value,
  options,
  onChange,
}: TweakRadioProps<T>): JSX.Element {
  const { theme, accent } = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12, color: theme.textMed, minWidth: 70 }}>{label}</span>
      <div
        style={{
          display: 'inline-flex',
          borderRadius: 6,
          border: `1px solid ${theme.border}`,
          background: theme.panelMuted,
          padding: 2,
          gap: 2,
        }}
      >
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              style={{
                padding: '4px 10px',
                border: 0,
                borderRadius: 4,
                background: active ? accent.value : 'transparent',
                color: active ? '#FFFFFF' : theme.textMed,
                fontFamily: 'inherit',
                fontSize: 11,
                cursor: 'pointer',
                fontWeight: active ? 600 : 500,
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
