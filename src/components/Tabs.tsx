interface Props {
  active: 'editor' | 'preview';
  onChange: (tab: 'editor' | 'preview') => void;
}

export const Tabs = ({ active, onChange }: Props) => (
  <div className="tabs" role="tablist">
    {(['editor', 'preview'] as const).map((tab) => (
      <button
        key={tab}
        role="tab"
        aria-selected={active === tab}
        className={active === tab ? 'active' : ''}
        onClick={() => onChange(tab)}
      >
        {tab === 'editor' ? 'Editor' : 'Preview'}
      </button>
    ))}
  </div>
);
