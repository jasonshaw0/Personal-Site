import { handleContact } from './contact-handler'

const sender = 'portfolio@contact.jason-shaw.com'
const recipient = 'jj@mountmyfish.com'

export default {
  async fetch(request: Request, env: ContactEnv): Promise<Response> {
    return handleContact(request, env.CONTACT_RATE_LIMITER, async ({ name, email, message }) => {
      await env.CONTACT_EMAIL.send({
        from: { email: sender, name: 'Jason Shaw · Portfolio' },
        to: recipient,
        replyTo: email,
        subject: `Portfolio message from ${name}`,
        text: `From: ${name}\nEmail: ${email}\n\n${message}`,
      })
    })
  },
} satisfies ExportedHandler<ContactEnv>
