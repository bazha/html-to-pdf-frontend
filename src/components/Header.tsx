interface Props {
  apiBaseUrl: string;
  version: string;
}

export const Header = ({ apiBaseUrl, version }: Props) => {
  const host = apiBaseUrl.replace(/^https?:\/\//, '');
  return (
    <header className="header">
      <div>
        <div className="wordmark">
          Press<span className="dot">.</span>
        </div>
        <div className="sub">
          html &amp; markdown <span style={{ color: 'var(--faint)' }}>→</span> pdf
        </div>
      </div>
      <div className="meta">
        <span className="pill">{host}</span>
        <span>{version}</span>
      </div>
    </header>
  );
};
