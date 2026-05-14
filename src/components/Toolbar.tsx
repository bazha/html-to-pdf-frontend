interface Props {
  charCount: number;
  detectedType: 'html' | 'markdown';
  canSubmit: boolean;
  submitting: boolean;
  cooldownSeconds: number | null;
  onSubmit: () => void;
}

const MIN = 10;
const MAX = 50_000;

export const Toolbar = ({
  charCount, detectedType, canSubmit, submitting, cooldownSeconds, onSubmit,
}: Props) => {
  const counterClass =
    charCount < MIN ? 'counter under' : charCount > MAX ? 'counter over' : 'counter';
  const label = cooldownSeconds !== null
    ? `Wait ${cooldownSeconds}s`
    : submitting ? 'Working…' : 'Submit (⌘/Ctrl+↵)';
  return (
    <div className="toolbar">
      <strong>PDF Playground</strong>
      <span className={`pill ${counterClass}`}>
        {charCount} / {MAX}
      </span>
      <span className="pill">{detectedType}</span>
      <div className="spacer" />
      <button disabled={!canSubmit} onClick={onSubmit}>{label}</button>
    </div>
  );
};
