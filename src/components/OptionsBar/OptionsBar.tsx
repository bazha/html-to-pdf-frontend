import { useState } from 'react';
import type { UsePdfOptions } from '../../hooks/usePdfOptions';
import { DEFAULTS } from '../../types/pdfOptions';
import { summarize } from '../../utils/summarize';
import { PageFormatControl } from './PageFormatControl';

interface Props {
  pdf: UsePdfOptions;
}

const isDefault = (opts: typeof DEFAULTS): boolean =>
  JSON.stringify(opts) === JSON.stringify(DEFAULTS);

const EXPANDED_KEY = 'press.options.expanded';

export const OptionsBar = ({ pdf }: Props) => {
  const [expanded, setExpanded] = useState<boolean>(() => {
    try {
      return localStorage.getItem(EXPANDED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [confirmingReset, setConfirmingReset] = useState(false);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (!next) setConfirmingReset(false);
    try {
      localStorage.setItem(EXPANDED_KEY, next ? '1' : '0');
    } catch {
      // ignored
    }
  };

  const dirty = !isDefault(pdf.options);
  const summary = summarize(pdf.options);

  return (
    <section className={`options-bar${expanded ? ' is-expanded' : ''}`} aria-label="PDF options">
      <button
        type="button"
        className="options-bar__head"
        aria-expanded={expanded}
        onClick={toggle}
      >
        <span className={`options-bar__dot${dirty ? ' is-dirty' : ''}`} aria-hidden="true" />
        <span className="options-bar__title">Options</span>
        <span className="options-bar__summary">{summary}</span>
        <span className="options-bar__caret" aria-hidden="true">▾</span>
      </button>

      <div className="options-bar__body" aria-hidden={!expanded} inert={!expanded}>
        <div className="options-bar__inner">
          <PageFormatControl
            format={pdf.options.format}
            landscape={pdf.options.landscape}
            onFormatChange={(f) => pdf.set('format', f)}
            onOrientationChange={(l) => pdf.set('landscape', l)}
          />

          {/* future controls render here: Margins, Header, Footer, CSS */}

          <div className="options-bar__footer">
            {confirmingReset ? (
              <span className="options-bar__confirm">
                Reset all to defaults?
                <button
                  type="button"
                  className="options-bar__confirm-yes"
                  onClick={() => {
                    pdf.reset();
                    setConfirmingReset(false);
                  }}
                >
                  yes
                </button>
                <button
                  type="button"
                  className="options-bar__confirm-no"
                  onClick={() => setConfirmingReset(false)}
                >
                  cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="options-bar__reset"
                onClick={() => setConfirmingReset(true)}
                disabled={!dirty}
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
