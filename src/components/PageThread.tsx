import { useEffect, useId } from 'react'
import { motion, useSpring, useTransform } from 'motion/react'

const stop = (index: number) => .08 + index * .28
function point(t: number, phase: number) {
  return { x: 36 + t * 528, y: 30 + Math.sin(t * Math.PI * 2 + phase * .52) * 5 }
}
function curve(phase: number, from = 0, to = 1) {
  return Array.from({ length: 49 }, (_, i) => {
    const p = point(from + (to - from) * i / 48, phase)
    return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`
  }).join(' ')
}

export function PageThread({ index, reduced }: { index: number; reduced: boolean }) {
  const gradient = useId()
  const position = useSpring(index, { stiffness: 58, damping: 21, mass: .9 })
  const tail = useSpring(index, { stiffness: 26, damping: 20, mass: 1 })
  const path = useTransform(position, value => curve(value))
  const trail = useTransform([position, tail], ([head, behind]: number[]) => {
    const end = stop(head)
    const start = Math.max(end - .22, Math.min(end + .22, stop(behind)))
    return curve(head, start, end)
  })
  const trailOpacity = useTransform([position, tail], ([head, behind]: number[]) => Math.min(.75, Math.abs(head - behind) * 1.8))
  const left = useTransform(position, value => `${point(stop(value), value).x / 600 * 100}%`)
  const top = useTransform(position, value => `${point(stop(value), value).y / 60 * 100}%`)
  const ticks = useTransform(position, value => [0, 1, 2, 3].map(index => {
    const p = point(stop(index), value)
    return `M${p.x} ${p.y - 6}v12`
  }).join(' '))

  useEffect(() => {
    if (reduced) {
      position.jump(index)
      tail.jump(index)
    } else {
      position.set(index)
      tail.set(index)
    }
  }, [index, reduced, position, tail])

  // This lives outside the page sections: the same filament and light persist
  // through navigation, including interrupted transitions and Back/Forward.
  return <div className="page-thread" aria-hidden="true" data-testid="page-thread" data-page={index + 1}>
    <svg viewBox="0 0 600 60" preserveAspectRatio="none" focusable="false">
      <defs><linearGradient id={gradient} x1="0" y1="0" x2="1" y2="0">
        <stop stopColor="#b8dccc" stopOpacity="0"/>
        <stop offset=".18" stopColor="#b8dccc" stopOpacity=".5"/>
        <stop offset=".82" stopColor="#b8dccc" stopOpacity=".5"/>
        <stop offset="1" stopColor="#b8dccc" stopOpacity="0"/>
      </linearGradient></defs>
      <motion.path className="thread-track" d={path} stroke={`url(#${gradient})`}/>
      <motion.path className="thread-stops" d={ticks}/>
      <motion.path className="thread-trail" d={trail} style={{ opacity: trailOpacity }}/>
    </svg>
    <motion.div className="thread-bead" style={{ left, top }}>
      <span className="thread-halo"/><span className="thread-ring"/><span className="thread-point"/>
    </motion.div>
  </div>
}
