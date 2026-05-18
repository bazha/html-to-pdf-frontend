interface Props {
  active: 'editor' | 'preview';
  onChange: (tab: 'editor' | 'preview') => void;
}

const LABELS = { editor: 'Editor', preview: 'Preview' } as const;

export const Tabs = ({ active, onChange }: Props) => (
  <div className="tabs" role="tablist">
    {(['editor', 'preview'] as const).map((tab) => (
      <button
        key={tab}
        type="button"
        role="tab"
        aria-selected={active === tab}
        className={`tab${active === tab ? ' active' : ''}`}
        onClick={() => onChange(tab)}
      >
        {LABELS[tab]}
      </button>
    ))}
  </div>
);
