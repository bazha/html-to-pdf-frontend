import {describe, it, expect, beforeAll, afterAll, afterEach} from 'vitest'
import {setupServer} from 'msw/node'
import {http, HttpResponse} from 'msw'
import {submitContent, pollJob} from './pdfClient'

const API = 'http://api.test'

const handlers = [
    http.post(`${API}/pdf`, async ({request}) => {
        const body = (await request.json()) as {content: string}
        if (body.content.length < 10) {
            return HttpResponse.json({error: 'Validation error: Content too short'}, {status: 400})
        }
        if (body.content.startsWith('RATE_LIMIT')) {
            return HttpResponse.json(
                {error: 'Too many PDF generation requests'},
                {status: 429, headers: {'Retry-After': '42'}},
            )
        }
        return HttpResponse.json(
            {message: 'ok', jobId: 'job-1', file: 'f.pdf', detectedType: 'html'},
            {status: 202},
        )
    }),
    http.get(`${API}/pdf/job-1/url`, () =>
        HttpResponse.json({status: 'completed', url: 'https://s3/x.pdf', cached: false}),
    ),
    http.get(`${API}/pdf/job-failed/url`, () =>
        HttpResponse.json({status: 'failed', reason: 'PDF generation failed'}, {status: 422}),
    ),
    http.get(`${API}/pdf/job-missing/url`, () =>
        HttpResponse.json({error: 'Job with ID job-missing not found'}, {status: 404}),
    ),
]

const server = setupServer(...handlers)
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('submitContent', () => {
    it('returns jobId on 202', async () => {
        const res = await submitContent('hello world long enough', API)
        expect(res.jobId).toBe('job-1')
        expect(res.detectedType).toBe('html')
    })

    it('throws ApiError(validation) on 400', async () => {
        await expect(submitContent('short', API)).rejects.toMatchObject({
            code: 'validation',
            message: expect.stringContaining('Content too short'),
        })
    })

    it('throws ApiError(rate_limit) with retryAfter on 429', async () => {
        await expect(submitContent('RATE_LIMIT_____', API)).rejects.toMatchObject({
            code: 'rate_limit',
            retryAfter: 42,
        })
    })

    it('sends options in the body when provided', async () => {
        let captured: {content?: string; options?: unknown} = {}
        server.use(
            http.post(`${API}/pdf`, async ({request}) => {
                captured = (await request.json()) as typeof captured
                return HttpResponse.json(
                    {message: 'ok', jobId: 'job-1', file: 'f.pdf', detectedType: 'html'},
                    {status: 202},
                )
            }),
        )
        const opts = {
            format: 'Letter',
            landscape: true,
            margin: {top: '10mm', right: '10mm', bottom: '10mm', left: '10mm'},
            displayHeaderFooter: false,
            headerTemplate: '',
            footerTemplate: '',
            printBackground: true,
        }
        await submitContent('hello world long enough', API, opts)
        expect(captured.content).toBe('hello world long enough')
        expect(captured.options).toEqual(opts)
    })

    it('omits options field when not provided', async () => {
        let captured: {content?: string; options?: unknown} = {}
        server.use(
            http.post(`${API}/pdf`, async ({request}) => {
                captured = (await request.json()) as typeof captured
                return HttpResponse.json(
                    {message: 'ok', jobId: 'job-1', file: 'f.pdf', detectedType: 'html'},
                    {status: 202},
                )
            }),
        )
        await submitContent('hello world long enough', API)
        expect(captured.content).toBe('hello world long enough')
        expect('options' in captured).toBe(false)
    })
})

describe('pollJob', () => {
    it('returns completed shape', async () => {
        const res = await pollJob('job-1', API)
        expect(res).toEqual({kind: 'completed', url: 'https://s3/x.pdf'})
    })

    it('returns failed shape on 422', async () => {
        const res = await pollJob('job-failed', API)
        expect(res).toEqual({kind: 'failed', reason: 'PDF generation failed'})
    })

    it('returns notFound on 404', async () => {
        const res = await pollJob('job-missing', API)
        expect(res).toEqual({kind: 'not_found'})
    })
})
