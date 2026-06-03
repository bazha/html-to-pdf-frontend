interface Props {
    onInsertPageBreak: () => void
}

export const EditorToolbar = ({onInsertPageBreak}: Props) => (
    <div className="editor-toolbar" role="toolbar" aria-label="Editor actions">
        <button
            type="button"
            className="editor-toolbar__btn"
            onClick={onInsertPageBreak}
            aria-label="Insert page break"
        >
            ⤓ Page break
        </button>
    </div>
)
