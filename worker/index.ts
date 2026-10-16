export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname.startsWith('/api/')) return env.CONTACT.fetch(request)
    const response = await env.ASSETS.fetch(request)
    const url = new URL(request.url)
    if (response.status !== 404 || request.method !== 'GET' || url.pathname.startsWith('/assets/')) {
      return response
    }
    return env.ASSETS.fetch(new Request(new URL('/index.html', url), request))
  },
} satisfies ExportedHandler<Env>
