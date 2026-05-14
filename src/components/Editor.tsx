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
      className="editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault();
          onSubmitShortcut();
        }
      }}
      placeholder="Write or paste html / markdown — 10 to 50,000 characters."
      spellCheck={false}
    />
  );
};
