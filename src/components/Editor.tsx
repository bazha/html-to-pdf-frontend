import { useEffect, useRef } from 'react';

interface Props {
  value: string;
  onChange: (next: string) => void;
  onSubmitShortcut: () => void;
}

export const Editor = ({ value, onChange, onSubmitShortcut }: Props) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <textarea
      ref={ref}
      className="pane"
      style={{
        width: '100%',
        height: '100%',
        background: 'var(--bg)',
        color: 'var(--fg)',
        border: 0,
        outline: 'none',
        padding: '12px',
        fontFamily: 'var(--mono)',
        fontSize: 13,
        lineHeight: 1.55,
        resize: 'none',
      }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault();
          onSubmitShortcut();
        }
      }}
      placeholder="Paste HTML or Markdown here (10–50000 chars)…"
      spellCheck={false}
    />
  );
};
