import { useEffect, useRef, useState } from 'react';
import { Editor } from './components/Editor';
import { Preview } from './components/Preview';
import { Tabs } from './components/Tabs';
import { Header } from './components/Header';
import { ActionRow } from './components/ActionRow';
import { Footer } from './components/Footer';
import { LoadFileButton } from './components/LoadFileButton';
import { OptionsBar } from './components/OptionsBar';
import { useSubmit } from './hooks/useSubmit';
import { usePoll } from './hooks/usePoll';
import { usePdfOptions } from './hooks/usePdfOptions';
import { detectType } from './utils/detectType';
import { loadFileAsText } from './utils/loadFile';

const MIN = 10;
const MAX = 50_000;
const VERSION = 'v1.0';
const FILE_ERROR_TTL_MS = 4000;

const App = () => {
  const [content, setContent] = useState('');
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [jobId, setJobId] = useState<string | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState<number | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragDepth = useRef(0);

  const detectedType = detectType(content);
  const submit = useSubmit();
  const poll = usePoll(jobId);
  const pdfOptions = usePdfOptions();

  const lengthValid = content.length >= MIN && content.length <= MAX;
  const canSubmit =
    lengthValid &&
    submit.state.phase !== 'submitting' &&
    submit.state.phase !== 'rate_limited' &&
    poll.phase !== 'polling';

  // Reset cooldown on phase transitions during render (React-blessed pattern)
  // so the effect below is purely a ticking side-effect.
  const submitState = submit.state;
  const [prevSubmitPhase, setPrevSubmitPhase] = useState(submitState.phase);
  if (submitState.phase !== prevSubmitPhase) {
    setPrevSubmitPhase(submitState.phase);
    // Seed with retryAfter (pure); the effect's interval refines it within 250ms.
    setCooldownLeft(submitState.phase === 'rate_limited' ? submitState.retryAfter : null);
  }

  useEffect(() => {
    if (submitState.phase !== 'rate_limited') return;
    const until = submitState.until;
    const id = window.setInterval(() => {
      const remainingMs = until - Date.now();
      setCooldownLeft(Math.max(0, Math.ceil(remainingMs / 1000)));
    }, 250);
    return () => window.clearInterval(id);
  }, [submitState]);

  // auto-clear file error after a few seconds
  useEffect(() => {
    if (!fileError) return;
    const id = window.setTimeout(() => setFileError(null), FILE_ERROR_TTL_MS);
    return () => window.clearTimeout(id);
  }, [fileError]);

  // Window-level safety net: if a drag is cancelled / leaves the document /
  // ends outside our surface, reset the drag state so the overlay can't get
  // stuck (covers Important #2: dragDepth drift on cross-element drags).
  useEffect(() => {
    const reset = () => {
      dragDepth.current = 0;
      setIsDragOver(false);
    };
    window.addEventListener('dragend', reset);
    return () => window.removeEventListener('dragend', reset);
  }, []);

  const handleSubmit = () => {
    if (!canSubmit) return;
    submit.submit(content, pdfOptions.options, (res) => setJobId(res.jobId));
  };

  const handlePickedFile = async (file: File) => {
    setFileError(null);
    const result = await loadFileAsText(file);
    if (!result.ok) {
      setFileError(result.error);
      return;
    }
    setContent(result.content);
    setActiveTab('editor');
  };

  const apiBaseUrl =
    (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3000';

  // Badge warns only when the count is genuinely outside the submit window
  // (over the cap). Under-MIN is left silent — the disabled Submit button is
  // already feedback enough and flashing amber on every first keystroke
  // reads as punitive.
  const charCount = content.length;
  const badgeWarn = charCount > MAX;
  const badgeText = `${charCount.toLocaleString()} · ${detectedType}`;

  return (
    <div className="shell">
      <Header apiBaseUrl={apiBaseUrl} version={VERSION} />

      <div className="tab-row">
        <Tabs active={activeTab} onChange={setActiveTab} />
        <div className="spacer" />
        <LoadFileButton onPick={handlePickedFile} />
        <span className={`badge${badgeWarn ? ' warn' : ''}`}>{badgeText}</span>
      </div>

      <OptionsBar pdf={pdfOptions} />

      <div
        className={`surface${isDragOver ? ' dragover' : ''}${poll.phase === 'polling' || submit.state.phase === 'submitting' ? ' surface--running' : ''}`}
        onDragEnter={(e) => {
          e.preventDefault();
          dragDepth.current += 1;
          setIsDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }}
        onDragLeave={() => {
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setIsDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          dragDepth.current = 0;
          setIsDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void handlePickedFile(file);
        }}
      >
        {activeTab === 'editor' ? (
          <Editor value={content} onChange={setContent} onSubmitShortcut={handleSubmit} />
        ) : (
          <Preview content={content} detectedType={detectedType} />
        )}
        {isDragOver && <div className="drop-overlay">Drop to load</div>}
      </div>

      <ActionRow
        pollState={poll}
        submitState={submit.state}
        canSubmit={canSubmit}
        cooldownSeconds={cooldownLeft}
        fileError={fileError}
        onSubmit={handleSubmit}
      />

      <Footer />
    </div>
  );
};

export default App;
