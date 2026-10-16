import { useEffect, useRef } from 'react'
import { ArrowDown, ArrowRight, X } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'

export const navigationTipKey = 'jason-shaw.navigation-tip.v1'

export function needsNavigationTip() {
  try { return localStorage.getItem(navigationTipKey) !== 'seen' } catch { return true }
}

export function NavigationIntro({ onDismiss }: { onDismiss: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    const timer = window.setTimeout(onDismiss, 1900)
    return () => { window.clearTimeout(timer); dialog?.close() }
  }, [onDismiss])

  return <motion.dialog ref={dialogRef} className="navigation-intro" aria-labelledby="navigation-intro-title" aria-describedby="navigation-intro-description"
    initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} transition={{duration: reduced ? .1 : .22}}
    onCancel={event => { event.preventDefault(); onDismiss() }}
    onClick={event => { if (event.target === event.currentTarget) onDismiss() }}
    onWheel={event => { event.stopPropagation(); if (Math.abs(event.deltaY) > 15) onDismiss() }}>
    <button className="intro-close" aria-label="Skip navigation tip" onClick={onDismiss}>Skip <X size={17}/></button>
    <div className="intro-content">
      <div className="intro-study" aria-hidden="true">
        <div className="intro-layer-stack">{[0, 1, 2, 3].map(index => <motion.span key={index}
          initial={false} animate={reduced ? {} : {y: [0, -13, 0], opacity: [.35, .85, .35]}}
          transition={{duration: 1.45, delay: index * .12, ease: 'easeInOut'}} style={{top: index * 20, rotateX: 35, rotateZ: -23, transformPerspective: 400}}><i/><i/><i/></motion.span>)}</div>
        <motion.span className="intro-scroll-arrow" animate={reduced ? {} : {y: [0, 8, 0]}} transition={{duration: 1.25, repeat: 1, ease: 'easeInOut'}}><ArrowDown size={23} strokeWidth={1.3}/></motion.span>
      </div>
      <h2 id="navigation-intro-title">One page at a time.</h2>
      <p id="navigation-intro-description">Scroll or swipe to explore.<br/>The arrows work, too.</p>
      <button className="intro-enter" autoFocus onClick={onDismiss}>Got it <ArrowRight size={16}/></button>
      <div className="intro-timer" aria-hidden="true"><motion.span initial={{scaleX: 1}} animate={{scaleX: 0}} transition={{duration: 1.9, ease: 'linear'}}/></div>
    </div>
  </motion.dialog>
}
