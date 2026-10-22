import type { CSSProperties } from 'react'
import type { Project } from '../content'

// Original project illustrations, built from editable CSS and SVG.
export function ProjectArt({ variant }: { variant: Project['visual'] }) {
  return <div className={`project-art project-study art-${variant}`} aria-hidden="true">
    <span className="art-corner top-left"/><span className="art-corner bottom-right"/>
    {variant === 'cad' && <div className="cad-visual">
      <span className="visual-kicker">SOURCE → GEOMETRY → EVIDENCE</span>
      <svg className="cad-object" viewBox="0 0 480 260" fill="none">
        <defs><linearGradient id="cad-top" x1="130" y1="35" x2="355" y2="145" gradientUnits="userSpaceOnUse"><stop stopColor="#a6c4bb" stopOpacity=".38"/><stop offset=".5" stopColor="#a6c4bb" stopOpacity=".08"/><stop offset="1" stopColor="#a6c4bb" stopOpacity=".23"/></linearGradient></defs>
        <ellipse className="cad-shadow" cx="248" cy="231" rx="132" ry="13" fill="#090e10" opacity=".6"/>
        <g className="cad-dimensions" stroke="currentColor" strokeWidth=".8" opacity=".4"><path d="M100 99H71m29 75H71m8-75v75M389 100h31m-31 75h31m-8-75v75M75 95l8 8m-8 67 8 8m325-82 8 8m-8 67 8 8"/><path d="m118 197 126 68 138-70M118 197v-14m264 12v-14" strokeDasharray="3 5"/></g>
        <g className="cad-body" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"><path d="m130 100 116 68v73l-116-66Z" fill="#3e5754" fillOpacity=".45"/><path d="m246 168 126-68v75l-126 66Z" fill="#1c3030" fillOpacity=".9"/><path d="m130 100 126-65 116 65-126 68Z" fill="url(#cad-top)"/><path d="M155 113v48l91 51 101-51v-48" opacity=".45"/><ellipse cx="252" cy="99" rx="28" ry="15" fill="#142120"/><path d="M224 99v28m56-28v28" opacity=".45"/></g>
        <g className="cad-lid" stroke="currentColor" strokeWidth="1"><path d="m130 76 126-65 116 65-126 68Z" fill="url(#cad-top)"/><ellipse cx="252" cy="75" rx="28" ry="15"/><path d="M130 76v9l116 68 126-68v-9M246 144v9" opacity=".65"/><g className="cad-pins" fill="#c0e3d2"><circle cx="155" cy="77" r="2.5"/><circle cx="256" cy="26" r="2.5"/><circle cx="345" cy="76" r="2.5"/><circle cx="246" cy="125" r="2.5"/></g></g>
        <g className="cad-connectors" stroke="currentColor" strokeWidth=".7" strokeDasharray="2 4" opacity=".4"><path d="M130 85v15m116 53v15m126-83v15"/></g>
      </svg>
      <div className="evidence-line"><span>✓ Solid geometry</span><span>✓ Dimensions</span><span>✓ Clearances</span></div>
    </div>}
    {variant === 'resources' && <div className="resource-visual">
      <div className="resource-index"><span className="visual-kicker">EGN 3000L / USF</span><strong>Build.<br/>Learn.<br/>Repeat.</strong><span className="resource-footnote">THE FOUNDATIONS<br/>RESOURCE HUB</span></div>
      <div className="resource-chapters">{[['01', 'Programming', 'Arduino & microcontrollers'], ['02', 'Electronics', 'From circuits to systems'], ['03', 'Fabrication', 'From CAD to 3D print']].map(([id, title, detail]) => <div key={id}><span>{id}</span><section><strong>{title}</strong><small>{detail}</small></section><b>↗</b></div>)}</div>
    </div>}
    {variant === 'crossplay' && <div className="crossplay-visual">
      <div className="word-board">{Array.from({length: 49}, (_, i) => {
        const letter = i >= 21 && i <= 27 ? 'CROSSES'[i - 21] : i === 10 ? 'R' : i === 17 ? 'O' : i === 31 ? 'E' : ''
        return <span key={i} style={{ '--tile-delay': `${(i % 7) * 35}ms` } as CSSProperties} className={letter ? 'word-tile' : i % 8 === 0 ? 'premium-tile' : ''}>{letter}</span>
      })}</div>
      <div className="solver-caption"><span className="visual-kicker">CROSSPLAY SOLVER</span><strong>Every play.<br/>Every point.</strong><div><span>01 / Recognize</span><span>02 / Solve</span><span>03 / Inspect</span></div><small>LOCAL VISION + DETERMINISTIC SEARCH</small></div>
    </div>}
    {variant === 'dates' && <div className="dates-visual">
      <span className="visual-kicker">EXACT UPLOAD DATES FOR YOUTUBE</span>
      <div className="date-comparison"><span className="relative-date">6 years ago</span><span className="date-arrow">↓</span><div className="date-display"><div className="date-display-header"><span>UPLOAD DATE</span><span>YYYY / MM / DD</span></div><strong>Apr 22, 2020</strong><div className="date-ruler">{Array.from({length: 25}, (_, index) => <i key={index} className={index === 17 ? 'date-tick-active' : ''}/>)}</div></div></div>
      <div className="date-features"><span>Browse normally.</span><span>Know exactly when.</span></div>
    </div>}
    {variant === 'atlas' && <div className="atlas-visual">
      <svg className="atlas-globe" viewBox="0 0 300 280" fill="none">
        <defs>
          <radialGradient id="atlas-surface" cx=".35" cy=".3" r=".8"><stop stopColor="#52615c" stopOpacity=".55"/><stop offset="1" stopColor="#172322"/></radialGradient>
          <clipPath id="atlas-sphere"><circle cx="145" cy="138" r="101"/></clipPath>
        </defs>
        <path d="M15 138h260M145 8v260" stroke="currentColor" strokeWidth=".6" strokeDasharray="2 5" opacity=".35"/>
        <circle cx="145" cy="138" r="116" stroke="currentColor" strokeWidth=".7" strokeDasharray="1 7" opacity=".55"/>
        <circle cx="145" cy="138" r="101" fill="url(#atlas-surface)" stroke="currentColor"/>
        <g clipPath="url(#atlas-sphere)" stroke="currentColor" strokeWidth=".65">
          <g opacity=".3"><ellipse cx="145" cy="138" rx="41" ry="101"/><ellipse cx="145" cy="138" rx="78" ry="101"/><ellipse cx="145" cy="138" rx="101" ry="39"/><ellipse cx="145" cy="138" rx="101" ry="74"/><path d="M44 138h202M145 37v202"/></g>
          <g fill="#91ab98" fillOpacity=".18" strokeOpacity=".65" strokeLinejoin="round">
            <path d="m108 89 9-15 15-2 8-12 7 4-3 16 13 7 4 14 15 4 15-5 17 8 6 13 21 7 15 18-11 9-22-9-14 7-14-6-9-18-13 3-8-8-10 2-5-12-9 2-2-10-14-2-4-8-10 1Z"/>
            <path d="m129 128 22-5 15 9 14 22-9 21-9 3-1 15-15 20-8-11-4-25-12-16-4-19Z"/>
            <path d="m58 85 21-17 16 7-2 17-11 9 3 15-13 9-14-10-9-17Z"/>
            <path d="m70 143 20 5 12 19-8 18-4 22-12 10-3-27-9-18Z"/>
            <path d="m217 189 16-7 15 12-9 15-22-3Z"/>
          </g>
        </g>
        <g stroke="currentColor" strokeWidth=".8"><circle cx="145" cy="100" r="7"/><path d="M145 89v22m-11-11h22M153 96l42-39h61" opacity=".7"/><circle cx="206" cy="142" r="3" fill="currentColor"/><path d="m209 142 39 22h27" opacity=".5"/></g>
        <g fill="currentColor" fontFamily="var(--mono)" fontSize="6" letterSpacing="1"><text x="201" y="49">REF. 01 / EUROPE</text><text x="107" y="267">1939 — 1945</text></g>
      </svg>
      <div className="atlas-index"><span className="visual-kicker">ATLAS OF WAR / WWII</span><strong>History.<br/>With sources.</strong><div className="atlas-records">{[['01', 'Source & evidence'], ['02', 'Verified fact'], ['03', 'Question & citation']].map(([id, label]) => <span key={id}><small>{id}</small>{label}</span>)}</div><span className="atlas-pipeline">YAML → VALIDATE → SQLite</span></div>
    </div>}
    {variant === 'drivester' && <div className="drivester-visual">
      <svg className="motor-object" viewBox="0 0 320 280" fill="none">
        <defs><linearGradient id="motor-face" x1="80" y1="65" x2="230" y2="200" gradientUnits="userSpaceOnUse"><stop stopColor="#849b99" stopOpacity=".5"/><stop offset="1" stopColor="#293c3f"/></linearGradient></defs>
        <ellipse cx="161" cy="237" rx="100" ry="12" fill="#090e10" opacity=".6"/>
        <g stroke="currentColor" strokeWidth="1" strokeLinejoin="round">
          <path d="m77 121 85-47 88 49v84l-86 47-87-48Z" fill="#19272c"/>
          <path d="m77 121 87 48 86-46M164 169v85" opacity=".5"/>
          <path d="m77 108 85-47 88 49v15l-86 47-87-48Z" fill="#283c41"/>
          <path d="m77 92 85-47 88 49v16l-86 47-87-48Z" fill="url(#motor-face)"/>
          <path d="m77 92 87 48 86-46M164 140v17" opacity=".55"/>
          <ellipse cx="164" cy="94" rx="41" ry="23" fill="#18282d"/>
          <ellipse cx="164" cy="92" rx="29" ry="16" fill="#3b5557"/>
          <path d="M153 89V44h22v45c-3 8-19 8-22 0Z" fill="#78928e"/>
          <ellipse cx="164" cy="44" rx="11" ry="6" fill="#a5bcb1"/>
          <path d="M84 144l72 40m-72-30 72 40m-72-30 72 40m15-19 71-39m-71 49 71-39m-71 49 71-39" opacity=".3"/>
          {[[94, 91], [162, 57], [231, 94], [164, 129]].map(([x, y]) => <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="4" ry="2.5" fill="#142026"/>)}
          <path d="M218 227v14h38v-35m-30 17v10h23v-27m-15 12v8h8v-20" opacity=".55"/>
          <path d="M61 95H40v115h21m-25-111 8-8m-8 123 8-8M168 33V17h65" strokeDasharray="2 4" opacity=".45"/>
        </g>
        <text x="238" y="20" fill="currentColor" fontFamily="var(--mono)" fontSize="6" letterSpacing="1">STEP / DIR</text>
      </svg>
      <div className="motor-control"><span className="visual-kicker">DRIVESTER / POSITION</span><div className="motor-dial"><svg viewBox="0 0 140 140" fill="none"><circle cx="70" cy="70" r="58" stroke="currentColor" strokeWidth=".6" opacity=".3"/>{Array.from({length: 24}, (_, i) => <path key={i} d={i % 3 === 0 ? 'M70 16v9' : 'M70 17v4'} transform={`rotate(${i * 15} 70 70)`} stroke="currentColor" strokeWidth={i % 3 === 0 ? 1.2 : .6} opacity=".65"/>)}<path d="M70 70 99 41" stroke="currentColor" strokeWidth="2"/><circle cx="70" cy="70" r="5" fill="#a9c7bb"/><path d="M70 37a33 33 0 0 1 23.3 9.7" stroke="#b9d3bf" strokeWidth="2"/></svg><span>45<small>°</small></span></div><div className="motor-signals"><span><i/> SERIAL</span><span>200 STEPS / REV</span></div><span className="motor-pipeline">DESKTOP → FIRMWARE → MOTION</span></div>
    </div>}
    <span className="art-label">PROJECT ILLUSTRATION</span>
  </div>
}
