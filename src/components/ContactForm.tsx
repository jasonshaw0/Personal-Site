import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowUpRight, Check, LoaderCircle, RotateCcw } from 'lucide-react'
import { profile } from '../content'

export function ContactForm() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')
  const firstField = useRef<HTMLInputElement>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (status === 'sending') return
    const form = event.currentTarget
    const data = new FormData(form)
    setStatus('sending')
    setError('')
    try {
      const response = await fetch(profile.contactEndpoint, {
        method: 'POST',
        body: JSON.stringify(Object.fromEntries(data)),
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(20000),
      })
      const result: unknown = await response.json().catch(() => null)
      if (!response.ok || !result || typeof result !== 'object' || !('ok' in result) || result.ok !== true) {
        const detail = result && typeof result === 'object' && 'error' in result && typeof result.error === 'string' ? result.error : ''
        throw new Error(detail || 'Your message could not be sent. Please try again, or contact me through LinkedIn.')
      }
      setStatus('success')
      form.reset()
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error && err.name !== 'TimeoutError' && err.name !== 'TypeError' ? err.message : 'The connection was interrupted. Please try again, or contact me through LinkedIn.')
    }
  }

  if (status === 'success') return <div className="contact-success" role="status"><span className="success-icon"><Check size={28}/></span><h2>Message sent.</h2><p>Thanks for reaching out. I’ll get back to you soon.</p><button className="text-button" onClick={() => { setStatus('idle'); requestAnimationFrame(() => firstField.current?.focus()) }}>Write another message <RotateCcw size={15}/></button></div>

  return <form className="contact-form" onSubmit={submit} action={profile.contactEndpoint} method="POST" aria-label="Contact Jason Shaw">
    <div className="form-trap" aria-hidden="true"><label>Leave this empty<input name="_gotcha" tabIndex={-1} autoComplete="off"/></label></div>
    <div className="form-pair"><label><span>Your name <b>*</b></span><input ref={firstField} name="name" autoComplete="name" placeholder="Alex Morgan" required maxLength={120} disabled={status === 'sending'}/></label><label><span>Email address <b>*</b></span><input name="email" type="email" autoComplete="email" placeholder="alex@company.com" required maxLength={254} disabled={status === 'sending'}/></label></div>
    <label><span>What’s on your mind? <b>*</b></span><textarea name="message" placeholder="A project, a question, an interesting problem…" rows={3} required maxLength={8000} disabled={status === 'sending'}/></label>
    <div className="form-bottom"><span className="form-note">Direct to my inbox.</span><button className="metal-button" type="submit" disabled={status === 'sending'}>{status === 'sending' ? <>Sending <LoaderCircle className="spinner" size={17}/></> : <>Send message <ArrowUpRight size={18}/></>}</button></div>
    {status === 'error' && <p className="form-error" role="alert">{error} <a href={profile.linkedin} target="_blank" rel="noreferrer">Open LinkedIn <ArrowUpRight size={13}/></a></p>}
  </form>
}
