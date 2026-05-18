import type { PageFormat } from '../../types/pdfOptions';

interface Props {
  format: PageFormat;
  landscape: boolean;
  onFormatChange: (f: PageFormat) => void;
  onOrientationChange: (landscape: boolean) => void;
}

const FORMATS: PageFormat[] = ['A4', 'Letter', 'Legal', 'A3', 'A5'];

export const PageFormatControl = ({
  format,
  landscape,
  onFormatChange,
  onOrientationChange,
}: Props) => {
  const idx = landscape ? 1 : 0;
  return (
    <div className="opt-row">
      <span className="opt-label">Format</span>
      <select
        className="opt-select"
        value={format}
        onChange={(e) => onFormatChange(e.target.value as PageFormat)}
        aria-label="Page format"
      >
        {FORMATS.map((f) => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>
      <div className="segmented segmented--two" role="radiogroup" aria-label="Orientation">
        <span
          className="segmented__indicator"
          style={{ transform: `translateX(${idx * 100}%)` }}
          aria-hidden="true"
        />
        <button
          type="button"
          role="radio"
          aria-checked={!landscape}
          className={`segmented__opt${!landscape ? ' is-active' : ''}`}
          onClick={() => onOrientationChange(false)}
        >
          Portrait
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={landscape}
          className={`segmented__opt${landscape ? ' is-active' : ''}`}
          onClick={() => onOrientationChange(true)}
        >
          Landscape
        </button>
      </div>
    </div>
  );
};
