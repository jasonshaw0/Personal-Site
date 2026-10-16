import { useEffect, useRef } from 'react'
import { ArrowUpRight, CircleHelp, Github, X } from 'lucide-react'
import { profile } from '../content'
import { Wordmark } from './Wordmark'

type Props<PageId extends string> = {
  pages: readonly { id: PageId; name: string }[]
  active: PageId
  open: boolean
  onOpenChange: (open: boolean) => void
  onNavigate: (id: PageId) => void
  onHelp: () => void
}

export function MobileNavigation<PageId extends string>({ pages, active, open, onOpenChange, onNavigate, onHelp }: Props<PageId>) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [open])

  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 600px)')
    const sync = () => { if (!mobile.matches) onOpenChange(false) }
    mobile.addEventListener('change', sync)
    return () => mobile.removeEventListener('change', sync)
  }, [onOpenChange])

  return <div className="mobile-navigation">
    <button className="mobile-menu-toggle" aria-label="Open navigation" aria-expanded={open} aria-controls="mobile-menu" aria-haspopup="dialog" onClick={() => onOpenChange(true)}>
      <span/><span/>
    </button>
    <dialog ref={dialogRef} id="mobile-menu" className="mobile-menu" aria-label="Site navigation"
      onCancel={event => { event.preventDefault(); onOpenChange(false) }}
      onClose={() => { if (!dialogRef.current?.open) onOpenChange(false) }}
      onKeyDown={event => {
        if (event.key !== 'Tab') return
        const targets = event.currentTarget.querySelectorAll<HTMLElement>('button, a[href]')
        const first = targets[0], last = targets[targets.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }}
      onClick={event => {
        if (event.target !== event.currentTarget) return
        const rect = event.currentTarget.getBoundingClientRect()
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onOpenChange(false)
      }}>
      <div className="mobile-menu-heading"><Wordmark/><button className="mobile-menu-close" aria-label="Close navigation" onClick={() => onOpenChange(false)}><X size={18} strokeWidth={1.4}/></button></div>
      <nav aria-label="Mobile navigation">{pages.map((page, index) => <button key={page.id} aria-current={active === page.id ? 'page' : undefined} onClick={() => { onOpenChange(false); onNavigate(page.id) }}><span className="mobile-menu-index">{String(index + 1).padStart(2, '0')}</span><span>{page.name}</span><ArrowUpRight size={15} strokeWidth={1.3}/></button>)}</nav>
      <div className="mobile-menu-footer"><a href={profile.github} target="_blank" rel="noreferrer"><Github size={14}/>GitHub<ArrowUpRight size={12}/></a><button onClick={() => { onOpenChange(false); onHelp() }}><CircleHelp size={13}/>Navigation help</button></div>
    </dialog>
  </div>
}
