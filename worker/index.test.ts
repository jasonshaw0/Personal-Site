import { test } from 'node:test'
import assert from 'node:assert/strict'
import worker from './index.ts'

test('forwards contact API requests unchanged', async () => {
  const request = new Request('https://www.jason-shaw.com/api/contact', { method: 'POST', body: 'example' })
  const env = { CONTACT: { fetch: async (received: Request) => { assert.equal(received, request); return new Response('contact', { status: 202 }) } }, ASSETS: { fetch: async () => assert.fail('API reached assets') } } as unknown as Env
  assert.equal((await worker.fetch(request, env)).status, 202)
})

test('preserves static routes, redirects, missing article status, and missing assets', async () => {
  for (const [pathname, status] of [['/', 200], ['/blog', 200], ['/blog/example', 200], ['/blog/example/', 307], ['/blog/private-draft', 404], ['/assets/missing.js', 404], ['/_blog/missing.css', 404], ['/unknown', 404]] as const) {
    const requests: string[] = []
    const env = { ASSETS: { fetch: async (request: Request) => { requests.push(new URL(request.url).pathname); return new Response('static', { status }) } } } as unknown as Env
    assert.equal((await worker.fetch(new Request(`https://www.jason-shaw.com${pathname}`), env)).status, status)
    assert.deepEqual(requests, [pathname], 'Must not fall back to the portfolio shell')
  }
})
