import {useState} from 'react'
import {STORAGE_KEYS} from '../../constants'
import type {UsePdfOptions} from '../../hooks/usePdfOptions'
import {DEFAULTS} from '../../types/pdfOptions'
import {safeGetItem, safeSetItem} from '../../utils/storage'
import {optionsEqual} from '../../utils/optionsEqual'
import {summarize} from '../../utils/summarize'
import {PageFormatControl} from './PageFormatControl'
import {MarginsControl} from './MarginsControl'
import {HeaderFooterControl} from './HeaderFooterControl'
import {CustomCssControl} from './CustomCssControl'

interface Props {
    pdf: UsePdfOptions
}

export const OptionsBar = ({pdf}: Props) => {
    const [expanded, setExpanded] = useState<boolean>(
        () => safeGetItem(STORAGE_KEYS.optionsExpanded) === '1',
    )
    const [confirmingReset, setConfirmingReset] = useState(false)

    const toggle = () => {
        const next = !expanded
        setExpanded(next)
        if (!next) setConfirmingReset(false)
        safeSetItem(STORAGE_KEYS.optionsExpanded, next ? '1' : '0')
    }

    const dirty = !optionsEqual(pdf.options, DEFAULTS)
    const summary = summarize(pdf.options)

    return (
        <section
            className={`options-bar${expanded ? ' is-expanded' : ''}`}
            aria-label="PDF options"
        >
            <button
                type="button"
                className="options-bar__head"
                aria-expanded={expanded}
                onClick={toggle}
            >
                <span
                    className={`options-bar__dot${dirty ? ' is-dirty' : ''}`}
                    aria-hidden="true"
                />
                <span className="options-bar__title">Options</span>
                <span className="options-bar__summary">{summary}</span>
                <span className="options-bar__caret" aria-hidden="true">
                    ▾
                </span>
            </button>

            <div className="options-bar__body" aria-hidden={!expanded} inert={!expanded}>
                <div className="options-bar__inner">
                    <PageFormatControl
                        format={pdf.options.format}
                        landscape={pdf.options.landscape}
                        onFormatChange={(f) => pdf.set('format', f)}
                        onOrientationChange={(l) => pdf.set('landscape', l)}
                    />

                    <MarginsControl
                        preset={pdf.options.marginPreset}
                        margins={pdf.options.margins}
                        onPresetChange={(p) => pdf.set('marginPreset', p)}
                        onMarginChange={pdf.setMargin}
                    />

                    <HeaderFooterControl
                        label="Header"
                        enabled={pdf.options.header.enabled}
                        template={pdf.options.header.template}
                        onEnabledChange={(e) =>
                            pdf.set('header', {...pdf.options.header, enabled: e})
                        }
                        onTemplateChange={(t) =>
                            pdf.set('header', {...pdf.options.header, template: t})
                        }
                    />
                    <HeaderFooterControl
                        label="Footer"
                        enabled={pdf.options.footer.enabled}
                        template={pdf.options.footer.template}
                        onEnabledChange={(e) =>
                            pdf.set('footer', {...pdf.options.footer, enabled: e})
                        }
                        onTemplateChange={(t) =>
                            pdf.set('footer', {...pdf.options.footer, template: t})
                        }
                    />

                    <CustomCssControl value={pdf.options.css} onChange={(v) => pdf.set('css', v)} />

                    <div className="options-bar__footer">
                        {confirmingReset ? (
                            <span className="options-bar__confirm">
                                Reset all to defaults?
                                <button
                                    type="button"
                                    className="options-bar__confirm-yes"
                                    onClick={() => {
                                        pdf.reset()
                                        setConfirmingReset(false)
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
    )
}
