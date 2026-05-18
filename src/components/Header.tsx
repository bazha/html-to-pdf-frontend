import { ThemeSwitcher } from './ThemeSwitcher';

interface Props {
  apiBaseUrl: string;
  version: string;
}

export const Header = ({ apiBaseUrl, version }: Props) => {
  const host = apiBaseUrl.replace(/^https?:\/\//, '');
  return (
    <header className="masthead">
      <div className="brand">
        <div className="wordmark">
          Press<span className="dot">.</span>
        </div>
        <p className="tagline">
          <em>html &amp; markdown</em>
          <span className="arrow">→</span>
          pdf, rendered server-side and streamed back.
        </p>
      </div>
      <div className="masthead-meta">
        <span className="vol">
          <span className="roman">build</span>
          <span className="sep" />
          <span>{version}</span>
        </span>
        <span className="host">{host}</span>
        <ThemeSwitcher />
      </div>
    </header>
  );
};
