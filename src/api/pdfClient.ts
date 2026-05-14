export type ApiErrorCode = 'validation' | 'rate_limit' | 'http' | 'network';

export class ApiError extends Error {
  public readonly code: ApiErrorCode;
  public readonly status?: number;
  public readonly retryAfter?: number;
  public readonly body?: unknown;

  constructor(
    code: ApiErrorCode,
    message: string,
    status?: number,
    retryAfter?: number,
    body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
    this.body = body;
  }
}

export interface SubmitResult {
  jobId: string;
  file: string;
  detectedType: 'html' | 'markdown';
}

export type PollResult =
  | { kind: 'active'; state: string }
  | { kind: 'completed'; url: string }
  | { kind: 'failed'; reason: string }
  | { kind: 'not_found' };

const ACTIVE_STATES = new Set([
  'waiting',
  'active',
  'delayed',
  'prioritized',
  'waiting-children',
]);

const getBaseUrl = (override?: string): string =>
  override ?? import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export const submitContent = async (
  content: string,
  baseUrl?: string,
): Promise<SubmitResult> => {
  let res: Response;
  try {
    res = await fetch(`${getBaseUrl(baseUrl)}/pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
  } catch (err) {
    console.error('[PdfClient][submitContent] network', err);
    throw new ApiError('network', 'Cannot reach API');
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.status === 202) {
    const jobId = typeof body.jobId === 'string' ? body.jobId : '';
    const file = typeof body.file === 'string' ? body.file : '';
    const detectedType = body.detectedType === 'markdown' ? 'markdown' : 'html';
    if (!jobId || !file) {
      console.error('[PdfClient][submitContent] malformed 202 body', body);
      throw new ApiError('http', 'Malformed 202 response (missing jobId or file)', 202, undefined, body);
    }
    return { jobId, file, detectedType };
  }
  if (res.status === 400) {
    throw new ApiError(
      'validation',
      String(body.error ?? 'Validation failed'),
      400,
      undefined,
      body,
    );
  }
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('Retry-After')) || undefined;
    throw new ApiError(
      'rate_limit',
      String(body.error ?? 'Rate limited'),
      429,
      retryAfter,
      body,
    );
  }
  console.error('[PdfClient][submitContent] http', res.status, body);
  throw new ApiError('http', `Unexpected status ${res.status}`, res.status, undefined, body);
};

export const pollJob = async (jobId: string, baseUrl?: string): Promise<PollResult> => {
  let res: Response;
  try {
    res = await fetch(`${getBaseUrl(baseUrl)}/pdf/${encodeURIComponent(jobId)}/url`);
  } catch (err) {
    console.error('[PdfClient][pollJob] network', err);
    throw new ApiError('network', 'Cannot reach API');
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.status === 404) return { kind: 'not_found' };
  if (res.status === 422) {
    return { kind: 'failed', reason: String(body.reason ?? 'PDF generation failed') };
  }
  if (res.status === 429) {
    throw new ApiError('rate_limit', 'Rate limited (poll)', 429);
  }
  if (res.status !== 200) {
    console.error('[PdfClient][pollJob] http', res.status, body);
    throw new ApiError('http', `Unexpected status ${res.status}`, res.status, undefined, body);
  }
  if (body.status === 'completed' && typeof body.url === 'string') {
    return { kind: 'completed', url: body.url };
  }
  if (typeof body.status === 'string' && ACTIVE_STATES.has(body.status)) {
    return { kind: 'active', state: body.status };
  }
  return { kind: 'active', state: String(body.status ?? 'unknown') };
};
