import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import App from './App';

const API = 'http://api.test';

let pollHits = 0;
const server = setupServer(
  http.post(`${API}/pdf`, () =>
    HttpResponse.json(
      { message: 'ok', jobId: 'job-1', file: 'f.pdf', detectedType: 'markdown' },
      { status: 202 },
    ),
  ),
  http.get(`${API}/pdf/job-1/url`, () => {
    pollHits += 1;
    if (pollHits < 2) return HttpResponse.json({ status: 'active' });
    return HttpResponse.json({ status: 'completed', url: 'https://s3/x.pdf' });
  }),
);

beforeAll(() => {
  server.listen();
  vi.stubEnv('VITE_API_BASE_URL', API);
});
afterEach(() => {
  pollHits = 0;
  server.resetHandlers();
});
afterAll(() => {
  server.close();
  vi.unstubAllEnvs();
});

describe('App full flow', () => {
  it('submit → poll → download link visible', async () => {
    const user = userEvent.setup();
    render(<App />);
    const editor = screen.getByPlaceholderText(/Write or paste/i);
    await user.type(editor, '# Hello world test content');
    const submit = screen.getByRole('button', { name: /^Press/i });
    await user.click(submit);
    const link = await screen.findByRole(
      'link',
      { name: /download pdf/i },
      { timeout: 8000 },
    );
    expect(link).toHaveAttribute('href', 'https://s3/x.pdf');
  });

  it('loads a file into the editor on pick', async () => {
    const user = userEvent.setup();
    render(<App />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['# from disk\n\nhello world from a file'], 'hello.md', {
      type: 'text/markdown',
    });
    await user.upload(input, file);
    const editor = screen.getByPlaceholderText(/Write or paste/i) as HTMLTextAreaElement;
    expect(editor.value).toContain('# from disk');
    expect(editor.value).toContain('hello world from a file');
  });

  it('loads a file dropped onto the editor surface', async () => {
    render(<App />);
    const surface = document.querySelector('.surface') as HTMLElement;
    const editor = screen.getByPlaceholderText(/Write or paste/i) as HTMLTextAreaElement;
    const file = new File(['# dropped\n\nhello via drop'], 'dropped.md', {
      type: 'text/markdown',
    });
    const dataTransfer = { files: [file], types: ['Files'] };

    fireEvent.dragEnter(surface, { dataTransfer });
    expect(surface.classList.contains('dragover')).toBe(true);
    expect(screen.getByText('Drop to load')).toBeInTheDocument();

    fireEvent.drop(surface, { dataTransfer });

    await waitFor(() => expect(editor.value).toContain('# dropped'));
    expect(surface.classList.contains('dragover')).toBe(false);
  });
});
