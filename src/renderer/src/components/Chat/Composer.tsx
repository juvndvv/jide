import { useRef, useState, useEffect, type KeyboardEvent } from 'react';

export interface ComposerProps {
  /** Called when user presses Enter (without Shift). Empty text is ignored. */
  onSubmit: (text: string) => void;
  /** When true, the textarea is disabled (session not selected, or sending). */
  disabled?: boolean;
  /** Placeholder shown when the textarea is empty. */
  placeholder?: string;
}

export function Composer({ onSubmit, disabled, placeholder }: ComposerProps) {
  const [text, setText] = useState('');
  const ref = useRef<HTMLTextAreaElement | null>(null);

  // Autoresize: reset height to auto, then to scrollHeight so the box grows
  // with content; capped via maxHeight + overflow:auto on the element style.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, [text]);

  const submit = (): void => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setText('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div
      data-testid="composer"
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 8,
        padding: '8px 12px',
        borderTop: '1px solid #00000010',
        background: '#FFFFFF',
      }}
    >
      <textarea
        ref={ref}
        data-testid="composer-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        placeholder={placeholder ?? 'Type a prompt…'}
        rows={1}
        style={{
          flex: 1,
          resize: 'none',
          border: '1px solid #00000018',
          borderRadius: 8,
          padding: '8px 10px',
          fontFamily: 'inherit',
          fontSize: 13,
          lineHeight: 1.45,
          outline: 'none',
          background: disabled ? '#F6F4EF' : '#FFFFFF',
          color: '#1F1F1F',
          maxHeight: 200,
          overflow: 'auto',
        }}
      />
      <button
        type="button"
        data-testid="composer-send"
        onClick={() => submit()}
        disabled={disabled || !text.trim()}
        style={{
          height: 36,
          padding: '0 14px',
          borderRadius: 8,
          border: 'none',
          background: disabled || !text.trim() ? '#00000020' : '#D97757',
          color: '#FFFFFF',
          fontFamily: 'inherit',
          fontSize: 13,
          fontWeight: 600,
          cursor: disabled || !text.trim() ? 'default' : 'pointer',
        }}
      >
        Send
      </button>
    </div>
  );
}
