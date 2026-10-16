import { useEffect, useRef } from 'react'
import type { PointerEvent } from 'react'
import { motion, useSpring } from 'motion/react'
import type { MotionStyle } from 'motion/react'
import type { Project } from '../content'
import { useReducedMotionPreference } from '../hooks/useReducedMotionPreference'
import { ProjectArt } from './TechnicalArt'

export function ProjectScene({ project, selected }: { project: Project; selected: boolean }) {
  const reduced = useReducedMotionPreference()
  const bounds = useRef<DOMRect | null>(null)
  const spring = { stiffness: 125, damping: 24, mass: .7 }
  const tiltX = useSpring(0, spring)
  const tiltY = useSpring(0, spring)
  const lightX = useSpring('50%', spring)
  const lightY = useSpring('35%', spring)

  function reset() {
    bounds.current = null
    tiltX.set(0)
    tiltY.set(0)
    lightX.set('50%')
    lightY.set('35%')
  }

  useEffect(() => {
    if (selected && !reduced) return
    bounds.current = null
    tiltX.jump(0)
    tiltY.jump(0)
    lightX.jump('50%')
    lightY.jump('35%')
  }, [selected, reduced, tiltX, tiltY, lightX, lightY])

  function track(event: PointerEvent<HTMLDivElement>) {
    if (reduced || !selected || event.pointerType !== 'mouse' || event.buttons) return
    const rect = bounds.current ??= event.currentTarget.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
    tiltX.set((.5 - y) * 5)
    tiltY.set((x - .5) * 7)
    lightX.set(`${x * 100}%`)
    lightY.set(`${y * 100}%`)
  }

  return <motion.div className="project-image project-scene" data-visual={project.visual}
    style={{ '--scene-light-x': lightX, '--scene-light-y': lightY } as MotionStyle}
    onPointerMove={track} onPointerLeave={reset} onPointerCancel={reset} onPointerDown={reset}>
    <div className="scene-grid" aria-hidden="true"/>
    <motion.div className="scene-plane" style={{ rotateX: tiltX, rotateY: tiltY }}>
      <ProjectArt variant={project.visual}/>
    </motion.div>
    <div className="scene-light" aria-hidden="true"/>
    <div className="scene-caption" aria-hidden="true"><span className="scene-mark"/>{project.category}</div>
    <span className="project-number" aria-hidden="true">/{project.id}</span>
    <div className="scene-baseline" aria-hidden="true"><span/><i/><span/></div>
  </motion.div>
}
