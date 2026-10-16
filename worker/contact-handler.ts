export type ContactMessage = { name: string; email: string; message: string }

const maximumBytes = 32768
const allowedOrigins = new Set([
  'https://jason-shaw.com', 'https://www.jason-shaw.com', 'https://contact.jason-shaw.com',
])

// Delivery is injected so validation and failure behavior can be tested without sending email.
export async function handleContact(
  request: Request,
  limiter: ContactEnv['CONTACT_RATE_LIMITER'],
  deliver: (message: ContactMessage) => Promise<void>,
): Promise<Response> {
  const origin = request.headers.get('Origin')
  const headers = new Headers({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Origin' })
  const json = (body: object, status = 200) => Response.json(body, { status, headers })
  const localOrigin = origin !== null && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
  if (origin && !allowedOrigins.has(origin) && !localOrigin) return json({ ok: false, error: 'This site cannot submit this form.' }, 403)
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Accept')
  }
  if (new URL(request.url).pathname !== '/api/contact') return json({ ok: false, error: 'Not found.' }, 404)
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (request.method !== 'POST') {
    headers.set('Allow', 'POST, OPTIONS')
    return json({ ok: false, error: 'Use POST to send a message.' }, 405)
  }
  const contentType = request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()
  if (contentType !== 'application/json') return json({ ok: false, error: 'Expected a JSON message.' }, 415)
  if (Number(request.headers.get('Content-Length')) > maximumBytes) return json({ ok: false, error: 'Your message is too large.' }, 413)

  try {
    const { success } = await limiter.limit({ key: request.headers.get('CF-Connecting-IP') || 'local' })
    if (!success) {
      headers.set('Retry-After', '60')
      return json({ ok: false, error: 'Too many attempts. Please wait a minute and try again.' }, 429)
    }
  } catch {
    console.error(JSON.stringify({ event: 'contact.rate_limit_unavailable' }))
    return json({ ok: false, error: 'The form is temporarily unavailable. Please try again shortly.' }, 503)
  }

  // Enforce the limit on the actual stream, including requests without Content-Length.
  let raw = ''
  let bytes = 0
  const reader = request.body?.getReader()
  const decoder = new TextDecoder()
  try {
    if (reader) {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        bytes += value.byteLength
        if (bytes > maximumBytes) {
          await reader.cancel()
          return json({ ok: false, error: 'Your message is too large.' }, 413)
        }
        raw += decoder.decode(value, { stream: true })
      }
      raw += decoder.decode()
    }
  } catch {
    return json({ ok: false, error: 'Your message could not be read. Please try again.' }, 400)
  } finally {
    reader?.releaseLock()
  }
  let data: unknown
  try { data = JSON.parse(raw) } catch { return json({ ok: false, error: 'Your message could not be read. Please try again.' }, 400) }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return json({ ok: false, error: 'Please complete all fields.' }, 400)
  const fields = data as Record<string, unknown>
  if (typeof fields._gotcha === 'string' && fields._gotcha) return json({ ok: true })
  const name = typeof fields.name === 'string' ? fields.name.trim() : ''
  const email = typeof fields.email === 'string' ? fields.email.trim() : ''
  const message = typeof fields.message === 'string' ? fields.message.trim() : ''
  if (!name || name.length > 120 || /[\r\n\x00-\x1f\x7f]/.test(name)) return json({ ok: false, error: 'Please enter a name of up to 120 characters.' }, 400)
  if (email.length > 254 || !/^[^\s<>@,;\x00-\x1f\x7f]+@[^\s<>@,;\x00-\x1f\x7f]+\.[^\s<>@,;\x00-\x1f\x7f]+$/.test(email)) return json({ ok: false, error: 'Please enter a valid email address.' }, 400)
  if (!message || message.length > 8000) return json({ ok: false, error: 'Please enter a message of up to 8,000 characters.' }, 400)
  try {
    await deliver({ name, email, message })
    return json({ ok: true })
  } catch {
    // Never log names, addresses, message content, or raw provider exceptions.
    console.error(JSON.stringify({ event: 'contact.delivery_failed' }))
    return json({ ok: false, error: 'Your message could not be sent. Please try again, or contact me through LinkedIn.' }, 502)
  }
}
