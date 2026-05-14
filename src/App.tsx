import { useEffect, useState } from 'react';
import { Editor } from './components/Editor';
import { Preview } from './components/Preview';
import { Tabs } from './components/Tabs';
import { Toolbar } from './components/Toolbar';
import { StatusBar } from './components/StatusBar';
import { useSubmit } from './hooks/useSubmit';
import { usePoll } from './hooks/usePoll';
import { detectType } from './utils/detectType';

const MIN = 10;
const MAX = 50_000;

const App = () => {
  const [content, setContent] = useState('');
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [jobId, setJobId] = useState<string | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState<number | null>(null);

  const detectedType = detectType(content);
  const submit = useSubmit();
  const poll = usePoll(jobId);

  const lengthValid = content.length >= MIN && content.length <= MAX;
  const canSubmit =
    lengthValid &&
    submit.state.phase !== 'submitting' &&
    submit.state.phase !== 'rate_limited' &&
    poll.phase !== 'polling';

  // Drive the visible cooldown counter when rate-limited.
  useEffect(() => {
    if (submit.state.phase !== 'rate_limited') {
      setCooldownLeft(null);
      return;
    }
    const until = (submit.state as { until: number }).until;
    const tick = () => {
      const remainingMs = until - Date.now();
      const left = Math.max(0, Math.ceil(remainingMs / 1000));
      setCooldownLeft(left);
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [submit.state]);

  const handleSubmit = () => {
    if (!canSubmit) return;
    submit.submit(content, (res) => setJobId(res.jobId));
  };

  return (
    <div className="app">
      <Toolbar
        charCount={content.length}
        detectedType={detectedType}
        canSubmit={canSubmit}
        submitting={submit.state.phase === 'submitting'}
        cooldownSeconds={cooldownLeft}
        onSubmit={handleSubmit}
      />
      <Tabs active={activeTab} onChange={setActiveTab} />
      {activeTab === 'editor'
        ? <Editor value={content} onChange={setContent} onSubmitShortcut={handleSubmit} />
        : <Preview content={content} detectedType={detectedType} />
      }
      <StatusBar pollState={poll} submitState={submit.state} />
    </div>
  );
};

export default App;
