export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname.startsWith('/api/')) return env.CONTACT.fetch(request)
    // Portfolio sections use hashes on /. Missing blog posts and assets must
    // retain their 404 status rather than return the portfolio's SPA shell.
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
