import { useEffect, useId, useState } from 'react'
import type { PointerEvent } from 'react'
import { motion, useSpring, useTransform } from 'motion/react'
import type { MotionStyle } from 'motion/react'
import { useReducedMotionPreference } from '../hooks/useReducedMotionPreference'

// Shared projection, mounting pattern, and front-port positions across all parts.
const plane = 'matrix(.94 -.25 .65 .46 53 103)'
const mounts = [[19, 19], [281, 19], [19, 191], [281, 191]]

// Extrude the visible contour of the very same rounded rectangle as the top.
// Projecting its tangent points avoids square wall corners protruding past the rim.
function roundedSidePath(depth: number, x = 0, y = 0, width = 300, height = 210, radius = 16) {
  const points: [number, number][] = []
  const tangent = Math.atan2(.65, .94)
  function arc(cx: number, cy: number, start: number, end: number) {
    for (let step = 0; step <= 16; step++) {
      const angle = start + (end - start) * step / 16
      points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)])
    }
  }
  arc(x + radius, y + radius, Math.PI + tangent, Math.PI)
  arc(x + radius, y + height - radius, Math.PI, Math.PI / 2)
  arc(x + width - radius, y + height - radius, Math.PI / 2, tangent)
  const project = ([px, py]: [number, number], offset: number) =>
    `${(53 + .94 * px + .65 * py).toFixed(3)},${(103 - .25 * px + .46 * py + offset).toFixed(3)}`
  return `M${points.map(point => project(point, 0)).join('L')}L${points.toReversed().map(point => project(point, depth)).join('L')}Z`
}
const enclosureSide = roundedSidePath(28)
const displaySide = roundedSidePath(9)
const boardSide = roundedSidePath(5, 8, 8, 284, 194, 9)
const traces = [
  'M36 51h29l18 18h32', 'M36 57h26l19 19h34', 'M36 63h22l20 20h37',
  'M149 67V44l21-21h40', 'M156 67V47l18-18h36', 'M163 67V50l15-15h32',
  'M175 97h27l20-20h43', 'M175 104h30l20-20h40', 'M175 111h33l20-20h37',
  'M126 123v24l-22 22H57', 'M133 123v27l-25 25H57', 'M140 123v30l-28 28H57',
  'M161 123v29l23 23h51', 'M168 123v26l20 20h47', 'M175 123v23l17 17h43',
]

export function HeroComputer({ active }: { active: boolean }) {
  const id = useId().replace(/:/g, '')
  const reduced = useReducedMotionPreference()
  const [hovered, setHovered] = useState(false)
  const [canHover, setCanHover] = useState(() => window.matchMedia('(hover: hover) and (pointer: fine)').matches)
  const expanded = reduced || !canHover || (active && hovered)
  const progress = useSpring(expanded ? 1 : 0, { stiffness: 95, damping: 22, mass: .85, restDelta: .0001, restSpeed: .001 })
  const amount = useTransform(() => Math.max(0, Math.min(1, progress.get())))
  const displayY = useTransform(() => 140 - 129 * (1 - (1 - amount.get()) ** 1.18))
  const boardY = useTransform(() => 145 - 16 * amount.get() ** 1.4)
  const enclosureY = useTransform(() => 149 + 97 * amount.get() ** 1.25)
  const groundY = useTransform(() => enclosureY.get() - 246)
  const shadowScale = useTransform(amount, [0, 1], [.82, 1])
  const shadowOpacity = useTransform(amount, [0, 1], [.6, 1])
  const guideOpacity = useTransform(amount, [0, .2, 1], [0, 0, .28])
  const labelOpacity = useTransform(amount, [0, .55, .9, 1], [0, 0, 1, 1])
  const labelX = useTransform(amount, [.55, 1], [5, 0])
  const spring = { stiffness: 130, damping: 24 }
  const tiltX = useSpring(0, spring)
  const tiltY = useSpring(0, spring)
  const lightX = useSpring('45%', spring)
  const lightY = useSpring('30%', spring)
  const paint = (name: string) => `url(#${id}-${name})`

  useEffect(() => {
    const target = expanded ? 1 : 0
    if (reduced || !canHover || !active) progress.jump(target)
    else progress.set(target)
  }, [expanded, reduced, canHover, active, progress])

  useEffect(() => {
    const media = window.matchMedia('(hover: hover) and (pointer: fine)')
    const sync = () => setCanHover(media.matches)
    media.addEventListener('change', sync)
    sync()
    return () => media.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (active && !reduced && canHover) return
    setHovered(false)
    tiltX.jump(0)
    tiltY.jump(0)
    lightX.jump('45%')
    lightY.jump('30%')
  }, [active, reduced, canHover, tiltX, tiltY, lightX, lightY])

  function track(event: PointerEvent<HTMLDivElement>) {
    if (reduced || !active || !canHover || event.pointerType !== 'mouse') return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
    tiltX.set((.5 - y) * 3)
    tiltY.set((x - .5) * 4)
    lightX.set(`${x * 100}%`)
    lightY.set(`${y * 100}%`)
  }

  function reset() {
    setHovered(false)
    tiltX.set(0)
    tiltY.set(0)
    lightX.set('45%')
    lightY.set('30%')
  }

  return <div className="hero-computer" data-expanded={expanded} data-active={active}
    onPointerEnter={event => {
      if (reduced || !active || !canHover || event.pointerType !== 'mouse') return
      setHovered(true)
      track(event)
    }} onPointerMove={track} onPointerLeave={reset} onPointerCancel={reset}>
    <motion.div className="computer-scene"
      style={{ rotateX: tiltX, rotateY: tiltY, '--computer-light-x': lightX, '--computer-light-y': lightY } as MotionStyle}>
      <svg className="computer-drawing" viewBox="0 0 620 510" role="img" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}>
        <title id={`${id}-title`}>A system in layers</title>
        <desc id={`${id}-description`}>A compact computer connects three layers: Interface, Logic, and Physical. Its display, circuit board, and enclosure separate on mouse hover. Touch and reduced-motion views show the layers already separated.</desc>
        <defs>
          <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="300" y2="210" gradientUnits="userSpaceOnUse">
            <stop stopColor="#d3ded8"/><stop offset=".18" stopColor="#829794"/><stop offset=".48" stopColor="#39494c"/><stop offset=".8" stopColor="#202d31"/><stop offset="1" stopColor="#82938e"/>
          </linearGradient>
          <linearGradient id={`${id}-side`} x1="60" y1="0" x2="465" y2="0" gradientUnits="userSpaceOnUse"><stop stopColor="#5a7069"/><stop offset=".3" stopColor="#3c514b"/><stop offset=".38" stopColor="#293d37"/><stop offset="1" stopColor="#334842"/></linearGradient>
          <linearGradient id={`${id}-well`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#131d20"/><stop offset=".65" stopColor="#263536"/><stop offset="1" stopColor="#4a5e59"/></linearGradient>
          <linearGradient id={`${id}-board`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#6c9181"/><stop offset=".45" stopColor="#3d6758"/><stop offset="1" stopColor="#243f38"/></linearGradient>
          <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#1e3331"/><stop offset=".5" stopColor="#0b1719"/><stop offset="1" stopColor="#142725"/></linearGradient>
          <linearGradient id={`${id}-reflection`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#e2fff3" stopOpacity=".14"/><stop offset=".48" stopColor="#d3f2e8" stopOpacity=".025"/><stop offset=".49" stopColor="#d3f2e8" stopOpacity="0"/></linearGradient>
          <radialGradient id={`${id}-shadow`}><stop stopColor="#000" stopOpacity=".65"/><stop offset="1" stopColor="#000" stopOpacity="0"/></radialGradient>
          <radialGradient id={`${id}-screen-light`}><stop stopColor="#a3d6bb" stopOpacity=".12"/><stop offset="1" stopColor="#a3d6bb" stopOpacity="0"/></radialGradient>
        </defs>
        <g aria-hidden="true">
          <g className="computer-drafting" fill="none" stroke="#91aca2" strokeWidth=".7">
            <path d="M34 62h59m-29-4v8M480 62h59m-29-4v8"/>
            <path d="M35 42v9m-4-4h8M569 436v9m-4-4h8"/>
          </g>
          <motion.g className="computer-ground" style={{ y: groundY }}>
            <motion.ellipse className="computer-shadow" cx="268" cy="458" rx="223" ry="39" fill={paint('shadow')} style={{ scaleX: shadowScale, opacity: shadowOpacity }}/>
            <path d="M39 426l202 68 242-72" fill="none" stroke="#91aca2" strokeWidth=".7" opacity=".18"/>
          </motion.g>
          <g className="computer-object">
            <motion.g className="computer-alignment" stroke="#a0c5b2" strokeWidth=".7" strokeDasharray="2 6" style={{ opacity: guideOpacity }}>
              {mounts.map(([x, y]) => <path key={`${x}-${y}`} d={`M${53 + .94 * x + .65 * y} ${103 - .25 * x + .46 * y + 26}v250`}/>)}
            </motion.g>
            {/* Enclosure: explicit side walls, recessed tray, and aligned cutouts. */}
            <motion.g className="computer-enclosure" style={{ y: enclosureY }}>
              <g fill="#0a1114" stroke="#32413f" strokeWidth="1">
                <path d="m103 167 24 17v9l-24-17z"/><path d="m230 220 25-7v9l-25 7z"/><path d="m401 174 23-6v9l-23 6z"/>
              </g>
              <path className="computer-rounded-wall" d={enclosureSide} fill={paint('side')} stroke="#70877b" strokeWidth=".65" strokeLinejoin="round"/>
              <g className="computer-vents" stroke="#0a1416" strokeWidth="3" strokeLinecap="round">
                {Array.from({length: 11}, (_, i) => <path key={i} d={`M${66 + i * 8} ${121 + i * 5.66}v10`}/>)}
              </g>
              <g transform="matrix(.94 -.25 0 1 189.5 205.6)">
                <rect x="32" y="0" width="32" height="10" rx="2" fill="#090f12" stroke="#80918a" strokeWidth=".8"/>
                <rect x="36" y="3" width="24" height="3" rx="1" fill="#61766b"/>
                <rect x="85" y="-1" width="23" height="12" rx="1" fill="#090f12" stroke="#70847b"/>
                <rect x="88" y="3" width="17" height="4" fill="#52685e"/>
                <path d="M149 0h28l-3 10h-22z" fill="#090f12" stroke="#70847b"/>
                <circle cx="228" cy="5" r="4" fill="#0a1315" stroke="#70847b"/>
              </g>
              <g transform={plane}>
                <rect width="300" height="210" rx="16" fill={paint('metal')} stroke="#a8b8ad" strokeWidth="1"/>
                <rect x="9" y="9" width="282" height="192" rx="10" fill={paint('well')} stroke="#172425" strokeWidth="2"/>
                <path d="M29 31H271V180H29Z" fill="none" stroke="#799284" strokeOpacity=".2"/>
                <g stroke="#91aa98" strokeOpacity=".22" fill="none"><path d="M47 42v117h42m123-117v117h38M100 27v149h75"/></g>
                {mounts.map(([x, y]) => <g key={`${x}-${y}`}><circle cx={x} cy={y} r="7.5" fill="#8a9d8c" stroke="#bdd0bb"/><circle cx={x} cy={y} r="3.3" fill="#152326" stroke="#3e5550"/></g>)}
                <text x="151" y="191" textAnchor="middle" className="computer-etch">JS–01 / ENCLOSURE</text>
              </g>
            </motion.g>
            {/* Mainboard: each front connector shares its chassis port's x position. */}
            <motion.g className="computer-mainboard" style={{ y: boardY }}>
              <path d={boardSide} fill="#213d30" stroke="#799b7c" strokeWidth=".7" strokeLinejoin="round"/>
              <g transform={plane}>
                <rect x="8" y="8" width="284" height="194" rx="9" fill={paint('board')} stroke="#a3c3a5" strokeWidth="1.2"/>
                <rect x="13" y="13" width="274" height="184" rx="6" fill="none" stroke="#a6c2a0" strokeOpacity=".3"/>
                <g className="computer-traces" fill="none" stroke="#bad1a3" strokeWidth="1.1" opacity=".55">{traces.map(d => <path key={d} d={d}/>)}</g>
                <g fill="#c5cf9c">{[[65,51],[210,23],[265,77],[57,169],[235,175],[35,145],[252,135],[86,30]].map(([x,y]) => <g key={`${x}-${y}`}><circle cx={x} cy={y} r="2.5"/><circle cx={x} cy={y} r="1.1" fill="#345e4a"/></g>)}</g>
                <g className="computer-small-parts">
                  {[36,49,62,75].map(x => <g key={x}><rect x={x} y="104" width="7" height="17" rx="1" fill="#192b29" stroke="#80967c" strokeWidth=".6"/><path d={`M${x} 106h7m-7 13h7`} stroke="#c0c7ab" strokeWidth="2"/></g>)}
                  {[207,224,241].map(x => <g key={x}><rect x={x} y="119" width="10" height="16" rx="1" fill="#839a83" stroke="#c1caaa" strokeWidth=".7"/><rect x={x+2} y="121" width="6" height="12" fill="#253d33"/></g>)}
                  {[[92,39],[98,39],[104,39],[248,48],[254,48],[260,48],[49,139],[55,139],[61,139]].map(([x,y]) => <rect key={`${x}-${y}`} x={x} y={y} width="3" height="7" rx=".5" fill="#c1bc8a" stroke="#e0d7b4" strokeWidth=".5"/>)}
                </g>
                <g fill="#172623" stroke="#9db294" strokeWidth=".7">
                  <rect x="211" y="45" width="53" height="20" rx="2"/><rect x="211" y="72" width="53" height="20" rx="2"/>
                  {Array.from({length: 9}, (_, i) => <path key={i} d={`M${215+i*5} 42v3m0 20v3m0 1v3m0 20v3`} stroke="#c2c8a5" strokeWidth="2"/>)}
                </g>
                <g className="computer-processor">
                  <rect x="109" y="63" width="72" height="66" rx="3" fill="#203e31" stroke="#91b08c"/>
                  {Array.from({length: 10}, (_, i) => <path key={i} d={`M${116+i*6} 60v5m0 62v5M106 ${69+i*6}h5m68 0h5`} stroke="#c5ccb0" strokeWidth="2"/>)}
                  <rect x="117" y="70" width="56" height="52" rx="3" fill="#101d1c" stroke="#b0bda4"/>
                  <rect x="122" y="75" width="46" height="42" rx="2" fill="#364d43" stroke="#647e66"/>
                  <text x="145" y="99" textAnchor="middle" className="computer-chip-name">JS / 01</text>
                  <circle cx="125" cy="111" r="1.5" fill="#b5c5aa"/>
                </g>
                <g className="computer-io" stroke="#b8c5b4" strokeWidth="1">
                  <rect x="32" y="182" width="32" height="20" rx="2" fill="#99a99c"/><rect x="36" y="195" width="24" height="7" rx="1" fill="#172725"/>
                  <rect x="85" y="182" width="23" height="20" rx="1" fill="#829587"/><rect x="88" y="194" width="17" height="8" fill="#1c3029"/>
                  <rect x="149" y="182" width="28" height="20" rx="1" fill="#99a99c"/><path d="M153 195h20l-2 7h-16z" fill="#182b27"/>
                  <rect x="221" y="184" width="14" height="18" rx="2" fill="#2b4135"/><circle cx="228" cy="197" r="4" fill="#111e1b"/>
                </g>
                <rect x="92" y="17" width="65" height="10" rx="1" fill="#192d26" stroke="#9cb38e"/>
                {Array.from({length: 12}, (_, i) => <path key={i} d={`M${96+i*5} 19v6`} stroke="#c7c49b" strokeWidth="1.5"/>)}
                {mounts.map(([x,y]) => <g key={`${x}-${y}`}><circle cx={x} cy={y} r="5.6" fill="#b2bf8e"/><circle cx={x} cy={y} r="2.8" fill="#172e29"/></g>)}
                <circle className="computer-board-led" cx="268" cy="166" r="3"/>
                <text x="30" y="159" className="computer-silkscreen">JS–01</text>
                <text x="187" y="151" className="computer-silkscreen">MAINBOARD / REV. A</text>
              </g>
            </motion.g>
            {/* Display: glass inset into the same mounting footprint. */}
            <motion.g className="computer-display" style={{ y: displayY }}>
              <path className="computer-rounded-wall" d={displaySide} fill={paint('side')} stroke="#85988b" strokeWidth=".65" strokeLinejoin="round"/>
              <g transform={plane}>
                <rect width="300" height="210" rx="16" fill={paint('metal')} stroke="#b8c7bc" strokeWidth="1.2"/>
                <rect x="20" y="24" width="260" height="160" rx="8" fill="#101b1d" stroke="#bdd0be" strokeOpacity=".6" strokeWidth="1.2"/>
                <rect x="24" y="28" width="252" height="152" rx="5" fill={paint('glass')}/>
                <g className="computer-screen-content" fill="#c4e0c8">
                  <rect x="25" y="29" width="250" height="150" rx="5" fill={paint('screen-light')}/>
                  <text x="43" y="53" className="computer-screen-header">JS–01</text>
                  <circle cx="253" cy="48" r="2.5" fill="#bcdebf"/>
                  <path d="M43 64h213" stroke="#a3cbb1" strokeOpacity=".25" strokeWidth=".7"/>
                  <text x="43" y="100" className="computer-screen-state">SYSTEM READY</text>
                  <text x="43" y="124" className="computer-screen-subtitle">INTERFACE / LOGIC / PHYSICAL</text>
                  <text x="43" y="157" className="computer-screen-prompt">&gt;</text>
                  <path className="computer-cursor" d="M59 151v8" stroke="#c4e0c8" strokeWidth="7"/>
                </g>
                <rect x="24" y="28" width="252" height="152" rx="5" fill={paint('reflection')} pointerEvents="none"/>
                <g fill="#1b2d2c" stroke="#9aada0" strokeWidth=".8">
                  {mounts.map(([x,y]) => <g key={`${x}-${y}`}><circle cx={x} cy={y} r="3"/><path d={`m${x-1.5} ${y}h3`} stroke="#b8c4b4"/></g>)}
                </g>
                <text x="32" y="199" className="computer-etch">PERSONAL COMPUTER</text>
                <g transform="translate(256 197)" stroke="#c2d3c3" strokeWidth="1.5" fill="none"><path d="M0-5v5m-3-3a5 5 0 1 0 6 0"/></g>
                <circle className="computer-bezel-led" cx="272" cy="197" r="1.7"/>
              </g>
            </motion.g>
          </g>
          <motion.g className="computer-callouts" fill="#aab9b2" fontFamily="var(--mono)" fontSize="9" style={{ opacity: labelOpacity, x: labelX }}>
            <g><path d="M450 133h36l14-10h12"/><circle cx="450" cy="133" r="2"/><text x="524" y="126"><tspan className="computer-label-number">01</tspan> Interface</text></g>
            <g><path d="M451 253h34l15-5h12"/><circle cx="451" cy="253" r="2"/><text x="524" y="251"><tspan className="computer-label-number">02</tspan> Logic</text></g>
            <g><path d="M454 387h31l15-8h12"/><circle cx="454" cy="387" r="2"/><text x="524" y="382"><tspan className="computer-label-number">03</tspan> Physical</text></g>
          </motion.g>
        </g>
      </svg>
      <div className="computer-light" aria-hidden="true"/>
    </motion.div>
    <div className="computer-footer">
      <span className="computer-caption">FIG. 01 <span>/</span> A SYSTEM IN LAYERS</span>
    </div>
  </div>
}
