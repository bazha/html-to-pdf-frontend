import {
  MARGIN_PRESETS_ORDER,
  type Margins,
  type MarginPreset,
} from '../../types/pdfOptions';

interface Props {
  preset: MarginPreset;
  margins: Margins;
  onPresetChange: (p: MarginPreset) => void;
  onMarginChange: (side: keyof Margins, value: number) => void;
}

const PRESET_LABELS: Record<MarginPreset, string> = {
  normal: 'Normal',
  narrow: 'Narrow',
  wide:   'Wide',
  none:   'None',
  custom: 'Custom',
};

const SIDES: { key: keyof Margins; label: string }[] = [
  { key: 'top',    label: 'T' },
  { key: 'right',  label: 'R' },
  { key: 'bottom', label: 'B' },
  { key: 'left',   label: 'L' },
];

export const MarginsControl = ({ preset, margins, onPresetChange, onMarginChange }: Props) => {
  const disabled = preset === 'none';
  return (
    <div className="opt-row opt-row--stack">
      <div className="opt-row">
        <span className="opt-label">Margins</span>
        <div className="opt-chips" role="radiogroup" aria-label="Margin preset">
          {MARGIN_PRESETS_ORDER.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={preset === value}
              className={`opt-chip${preset === value ? ' is-active' : ''}`}
              onClick={() => onPresetChange(value)}
            >
              {PRESET_LABELS[value]}
            </button>
          ))}
        </div>
      </div>
      <div className="opt-margin-inputs">
        {SIDES.map(({ key, label }) => (
          <label key={key} className="opt-margin-field">
            <span className="opt-margin-label">{label}</span>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={margins[key]}
              disabled={disabled}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (!Number.isNaN(v)) onMarginChange(key, Math.max(0, Math.min(100, v)));
              }}
              aria-label={`Margin ${key} in mm`}
            />
          </label>
        ))}
        <span className="opt-margin-unit">mm</span>
      </div>
    </div>
  );
};
