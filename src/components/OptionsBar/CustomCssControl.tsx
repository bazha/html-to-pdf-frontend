import { useState, type KeyboardEvent } from 'react';
import { CSS_MAX_LENGTH } from '../../types/pdfOptions';

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export const CustomCssControl = ({ value, onChange }: Props) => {
  const [expanded, setExpanded] = useState(value.length > 0);
  const count = value.length;
  const overCap = count > CSS_MAX_LENGTH;
  const nearCap = !overCap && count >= CSS_MAX_LENGTH * 0.9;

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      onChange(value.slice(0, start) + '  ' + value.slice(end));
      requestAnimationFrame(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      });
    }
  };

  if (!expanded) {
    return (
      <div className="opt-row">
        <span className="opt-label">CSS</span>
        <button
          type="button"
          className="opt-link"
          onClick={() => setExpanded(true)}
        >
          ▸ add stylesheet
        </button>
      </div>
    );
  }

  return (
    <div className="opt-row opt-row--stack">
      <div className="opt-row">
        <span className="opt-label">CSS</span>
        <button
          type="button"
          className="opt-link"
          onClick={() => setExpanded(false)}
        >
          ▾ hide
        </button>
      </div>
      <div className="opt-css-wrap">
        <textarea
          className="opt-css"
          rows={8}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="/* additional stylesheet sent with the PDF */"
          spellCheck={false}
          aria-label="Custom CSS"
        />
        <div
          className={`opt-css-count${overCap ? ' is-over' : ''}${nearCap ? ' is-near' : ''}`}
          aria-live="polite"
        >
          {count.toLocaleString()} / {CSS_MAX_LENGTH.toLocaleString()}
          {overCap && <span> · over cap</span>}
        </div>
      </div>
    </div>
  );
};
