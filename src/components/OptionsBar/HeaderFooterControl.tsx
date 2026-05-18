import { useRef } from 'react';
import { HEADER_TEMPLATE_MAX_LENGTH } from '../../types/pdfOptions';
import { PlaceholderChips } from './PlaceholderChips';

interface Props {
  label: 'Header' | 'Footer';
  enabled: boolean;
  template: string;
  onEnabledChange: (enabled: boolean) => void;
  onTemplateChange: (t: string) => void;
}

export const HeaderFooterControl = ({
  label,
  enabled,
  template,
  onEnabledChange,
  onTemplateChange,
}: Props) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className="opt-row opt-row--stack">
      <div className="opt-row">
        <span className="opt-label">{label}</span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={`${label} enabled`}
          className={`opt-toggle${enabled ? ' is-on' : ''}`}
          onClick={() => onEnabledChange(!enabled)}
        >
          <span className="opt-toggle__knob" />
        </button>
        <input
          ref={inputRef}
          type="text"
          className="opt-text"
          value={template}
          onChange={(e) => onTemplateChange(e.target.value.slice(0, HEADER_TEMPLATE_MAX_LENGTH))}
          placeholder={label === 'Footer' ? '{pageNumber} / {totalPages}' : 'My Document'}
          disabled={!enabled}
          aria-label={`${label} template`}
          maxLength={HEADER_TEMPLATE_MAX_LENGTH}
        />
      </div>
      {enabled && (
        <PlaceholderChips
          inputRef={inputRef}
          onInsert={onTemplateChange}
        />
      )}
    </div>
  );
};
