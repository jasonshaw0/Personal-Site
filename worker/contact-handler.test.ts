import { test } from 'node:test'
import assert from 'node:assert/strict'
import { handleContact } from './contact-handler.ts'
import type { ContactMessage } from './contact-handler.ts'

const valid = { name: 'Test sender', email: 'sender@example.com', message: 'A contact form test.' }
const allowed = { limit: async () => ({ success: true }) }
const request = (data: unknown = valid, headers: Record<string, string> = {}, method = 'POST') => new Request('https://contact.jason-shaw.com/api/contact', {
  method, headers: { Origin: 'https://www.jason-shaw.com', 'Content-Type': 'application/json', ...headers },
  body: method === 'POST' ? JSON.stringify(data) : undefined,
})

test('delivers normalized fields and returns explicit success only after delivery', async () => {
  const sent: ContactMessage[] = []
  const response = await handleContact(request({ ...valid, name: '  Test sender  ', to: 'attacker@example.com' }), allowed, async message => { sent.push(message) })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { ok: true })
  assert.deepEqual(sent, [valid])
  assert.equal(response.headers.get('Cache-Control'), 'no-store')
})

test('rejects invalid data, whitespace-only fields, and header injection without delivery', async () => {
  let sent = 0
  for (const data of [null, [], { ...valid, name: '  ' }, { ...valid, name: 'A\r\nBcc: bad@example.com' }, { ...valid, email: 'a@example.com\r\nBcc:bad@example.com' }, { ...valid, email: 'invalid' }, { ...valid, message: '  ' }, { ...valid, message: 'x'.repeat(8001) }]) {
    const response = await handleContact(request(data), allowed, async () => { sent++ })
    assert.equal(response.status, 400)
  }
  assert.equal(sent, 0)
})

test('blocks other origins and methods, supports approved-origin preflight', async () => {
  const noSend = async () => assert.fail('Unexpected email')
  assert.equal((await handleContact(request(valid, { Origin: 'https://untrusted.example' }), allowed, noSend)).status, 403)
  assert.equal((await handleContact(request(valid, { Origin: 'http://localhost.evil.example:4173' }), allowed, noSend)).status, 403)
  assert.equal((await handleContact(request(valid, {}, 'GET'), allowed, noSend)).status, 405)
  assert.equal((await handleContact(request(valid, { 'Content-Type': 'text/plain' }), allowed, noSend)).status, 415)
  const preflight = await handleContact(request(valid, {}, 'OPTIONS'), allowed, noSend)
  assert.equal(preflight.status, 204)
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), 'https://www.jason-shaw.com')
  assert.equal((await handleContact(request(valid, { Origin: 'http://127.0.0.1:4174' }, 'OPTIONS'), allowed, noSend)).status, 204)
})

test('honeypot silently discards without emailing', async () => {
  const response = await handleContact(request({ ...valid, _gotcha: 'bot' }), allowed, async () => assert.fail('Unexpected email'))
  assert.deepEqual(await response.json(), { ok: true })
})

test('enforces size limits with and without Content-Length', async () => {
  const noSend = async () => assert.fail('Unexpected email')
  assert.equal((await handleContact(request(valid, { 'Content-Length': '40000' }), allowed, noSend)).status, 413)
  assert.equal((await handleContact(request({ ...valid, message: 'x'.repeat(40000) }), allowed, noSend)).status, 413)
})

test('malformed JSON never sends mail', async () => {
  const malformed = new Request('https://contact.jason-shaw.com/api/contact', { method: 'POST', body: '{', headers: { 'Content-Type': 'application/json' } })
  assert.equal((await handleContact(malformed, allowed, async () => assert.fail('Unexpected email'))).status, 400)
})

test('rate limiter prevents delivery and gives a retry interval', async () => {
  const response = await handleContact(request(), { limit: async () => ({ success: false }) }, async () => assert.fail('Unexpected email'))
  assert.equal(response.status, 429)
  assert.equal(response.headers.get('Retry-After'), '60')
})

test('delivery errors do not claim success or expose provider details', async () => {
  const response = await handleContact(request(), allowed, async () => { throw new Error('Private provider diagnostics') })
  assert.equal(response.status, 502)
  const body = await response.text()
  assert.ok(!body.includes('Private provider diagnostics'))
  assert.ok(body.includes('"ok":false'))
})
