import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { motion, useSpring } from 'motion/react'
import type { MotionStyle } from 'motion/react'
import type { Project } from '../content'
import { useReducedMotionPreference } from '../hooks/useReducedMotionPreference'

// Original illustrations, built from editable CSS and SVG.
export function SystemSculpture() {
  const reduced = useReducedMotionPreference()
  const bounds = useRef<DOMRect | null>(null)
  const [engaged, setEngaged] = useState(false)
  const spring = { stiffness: 110, damping: 22, mass: .8 }
  const tiltX = useSpring(0, spring)
  const tiltY = useSpring(0, spring)
  const spread = useSpring('0px', { stiffness: 80, damping: 19 })
  const lightX = useSpring('50%', spring)
  const lightY = useSpring('45%', spring)

  function reset() {
    setEngaged(false)
    bounds.current = null
    tiltX.set(0)
    tiltY.set(0)
    spread.set('0px')
    lightX.set('50%')
    lightY.set('45%')
  }

  useEffect(() => {
    if (!reduced) return
    setEngaged(false)
    tiltX.jump(0)
    tiltY.jump(0)
    spread.jump('0px')
    lightX.jump('50%')
    lightY.jump('45%')
  }, [reduced, tiltX, tiltY, spread, lightX, lightY])

  function track(event: PointerEvent<HTMLDivElement>) {
    if (reduced || event.pointerType !== 'mouse') return
    const rect = bounds.current ?? event.currentTarget.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
    tiltX.set((.5 - y) * 12)
    tiltY.set((x - .5) * 16)
    lightX.set(`${x * 100}%`)
    lightY.set(`${y * 100}%`)
  }

  return (
    <motion.div className="system-study" aria-label="Animated three-dimensional stack connecting interface, logic, and physical layers" role="img"
      data-engaged={engaged}
      style={{ '--stack-spread': spread, '--light-x': lightX, '--light-y': lightY } as MotionStyle}
      onPointerEnter={event => {
        if (reduced || event.pointerType !== 'mouse') return
        bounds.current = event.currentTarget.getBoundingClientRect()
        setEngaged(true)
        spread.set('20px')
        track(event)
      }} onPointerMove={track} onPointerLeave={reset} onPointerCancel={reset}>
      <div className="study-aura" aria-hidden="true"/>
      <div className="study-cross cross-one" /><div className="study-cross cross-two" />
      <svg className="study-guides" viewBox="0 0 520 430" fill="none" aria-hidden="true">
        <path d="M53 298 260 412 473 295M53 298V171M473 295V162M260 412v-75" stroke="currentColor" strokeDasharray="2 5" />
        <path d="M31 316 238 430M495 315 280 430M56 85h84M383 85h81" stroke="currentColor" />
        <circle cx="56" cy="85" r="2" fill="currentColor"/><circle cx="464" cy="85" r="2" fill="currentColor"/>
      </svg>
      <motion.div className="assembly-reactor" style={{ rotateX: tiltX, rotateY: tiltY }} aria-hidden="true">
        <div className="assembly">
          <div className="assembly-orbit"><span/><span/></div>
          <div className="stack-signal signal-one"/><div className="stack-signal signal-two"/><div className="stack-signal signal-three"/>
          <div className="system-layer layer-bottom"><div className="layer-inner"><svg className="layer-circuit" viewBox="0 0 100 100" fill="none"><path d="M0 25h24l16 16h60M15 100V72l20-20V0M0 75h52l18-18h30M76 0v26L60 42v58"/><circle cx="24" cy="25" r="2"/><circle cx="70" cy="57" r="2"/></svg></div><i/><i/><i/><i/></div>
          <div className="system-layer layer-middle"><div className="layer-inner"><svg className="layer-circuit" viewBox="0 0 100 100" fill="none"><path d="M0 20h30l20 20h50M20 100V70l20-20V0M0 80h60l20-20h20M80 0v25L60 45v55"/><circle cx="30" cy="20" r="2"/><circle cx="80" cy="60" r="2"/></svg></div><i/><i/><i/><i/></div>
          <div className="system-layer layer-top"><div className="layer-inner"><div className="interface-grid"/></div><i/><i/><i/><i/></div>
          <div className="system-core"><span/><span/><span/><span/><span/><span/></div>
        </div>
      </motion.div>
      <div className="study-label label-interface"><span>01</span> Interface</div>
      <div className="study-label label-logic"><span>02</span> Logic</div>
      <div className="study-label label-physical"><span>03</span> Physical</div>
      <span className="study-caption">FIG. 01 &nbsp; / &nbsp; A SYSTEM IN LAYERS</span>
    </motion.div>
  )
}

export function ProjectArt({ variant }: { variant: Project['visual'] }) {
  return <div className={`project-art project-study art-${variant}`} aria-hidden="true">
    <span className="art-corner top-left"/><span className="art-corner bottom-right"/>
    {variant === 'cad' && <div className="cad-visual">
      <span className="visual-kicker">SOURCE → GEOMETRY → EVIDENCE</span>
      <svg viewBox="0 0 480 240" fill="none"><g stroke="currentColor" strokeWidth="1.2"><path d="m130 85 126-65 116 65-126 68Z"/><path d="M130 85v75l116 66 126-66V85M246 153v73M155 98v48l91 51 101-51V98"/><ellipse cx="252" cy="84" rx="28" ry="15"/><path d="M224 84v28m56-28v28M214 39V7m72 31V7M214 13h72M100 84H71m29 75H71m8-75v75M389 85h31m-31 75h31m-8-75v75" opacity=".5"/></g><g fill="currentColor"><circle cx="155" cy="86" r="3"/><circle cx="256" cy="35" r="3"/><circle cx="345" cy="85" r="3"/><circle cx="246" cy="134" r="3"/></g></svg>
      <div className="evidence-line"><span>✓ Solid geometry</span><span>✓ Dimensions</span><span>✓ Clearances</span></div>
    </div>}
    {variant === 'resources' && <div className="resource-visual">
      <div className="resource-index"><span className="visual-kicker">EGN 3000L / USF</span><strong>Build.<br/>Learn.<br/>Repeat.</strong><span className="resource-footnote">THE FOUNDATIONS<br/>RESOURCE HUB</span></div>
      <div className="resource-chapters">{[['01', 'Programming', 'Arduino & microcontrollers'], ['02', 'Electronics', 'From circuits to systems'], ['03', 'Fabrication', 'From CAD to 3D print']].map(([id, title, detail]) => <div key={id}><span>{id}</span><section><strong>{title}</strong><small>{detail}</small></section><b>↗</b></div>)}</div>
    </div>}
    {variant === 'crossplay' && <div className="crossplay-visual">
      <div className="word-board">{Array.from({length: 49}, (_, i) => {
        const letter = i >= 21 && i <= 27 ? 'CROSSES'[i - 21] : i === 10 ? 'P' : i === 17 ? 'L' : i === 31 ? 'Y' : ''
        return <span key={i} className={letter ? 'word-tile' : i % 8 === 0 ? 'premium-tile' : ''}>{letter}</span>
      })}</div>
      <div className="solver-caption"><span className="visual-kicker">CROSSPLAY SOLVER</span><strong>Every play.<br/>Every point.</strong><div><span>01 / Recognize</span><span>02 / Solve</span><span>03 / Inspect</span></div><small>LOCAL VISION + DETERMINISTIC SEARCH</small></div>
    </div>}
    {variant === 'dates' && <div className="dates-visual">
      <span className="visual-kicker">EXACT UPLOAD DATES FOR YOUTUBE</span>
      <div className="date-comparison"><span className="relative-date">6 years ago</span><span className="date-arrow">↓</span><strong>Apr 22, 2020</strong></div>
      <div className="date-features"><span>Browse normally.</span><span>Know exactly when.</span></div>
    </div>}
    <span className="art-label">PROJECT ILLUSTRATION</span>
  </div>
}
