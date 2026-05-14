import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    const editor = screen.getByPlaceholderText(/Paste HTML or Markdown/);
    await user.type(editor, '# Hello world test content');
    const submit = screen.getByRole('button', { name: /Submit/i });
    await user.click(submit);
    const link = await screen.findByRole(
      'link',
      { name: /download PDF/i },
      { timeout: 8000 },
    );
    expect(link).toHaveAttribute('href', 'https://s3/x.pdf');
  });
});
