import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowLeft, ArrowRight, ArrowUpRight, CircleHelp, Github, Instagram, Linkedin, Mouse, Youtube } from 'lucide-react'
import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import type { Variants } from 'motion/react'
import { profile, disciplines } from './content'
import { SystemSculpture } from './components/TechnicalArt'
import { ProjectCarousel } from './components/ProjectCarousel'
import { ContactForm } from './components/ContactForm'
import { Wordmark } from './components/Wordmark'
import { NavigationIntro, navigationTipKey, needsNavigationTip } from './components/NavigationIntro'
import { usePageGestures } from './hooks/usePageGestures'
import { useReducedMotionPreference } from './hooks/useReducedMotionPreference'
import { PageThread } from './components/PageThread'
import { MobileNavigation } from './components/MobileNavigation'

const pages = [
  { id: 'profile', name: 'Profile' },
  { id: 'work', name: 'Work' },
  { id: 'expertise', name: 'Expertise' },
  { id: 'contact', name: 'Contact' },
] as const
type PageId = typeof pages[number]['id']
const ease = [.22, 1, .36, 1] as const

function pageFromUrl(): PageId {
  return pages.find(page => `#${page.id}` === window.location.hash)?.id ?? 'profile'
}

function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduced = useReducedMotionPreference()
  const hidden = { opacity: 0, transition: { duration: reduced ? .1 : .18, x: { duration: reduced ? 0 : .18 } } }
  return <motion.div className={className} variants={{
    visible: { opacity: 1, x: 0, transition: { duration: reduced ? .15 : .62, delay: reduced ? 0 : .08 + delay, ease, x: { duration: reduced ? 0 : .62, delay: reduced ? 0 : .08 + delay, ease } } },
    before: { ...hidden, x: reduced ? 0 : 8 },
    after: { ...hidden, x: reduced ? 0 : -8 },
  }}>{children}</motion.div>
}

function Expertise() {
  const [selected, setSelected] = useState(0)
  const reduced = useReducedMotionPreference()
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const discipline = disciplines[selected]
  const labels = ['Software', 'Electrical', 'Mechanical']

  return <div className="expertise-detail">
    <div className="skill-tabs" role="tablist" aria-label="Areas of expertise">{disciplines.map((item, index) => <button
      key={item.number}
      ref={element => { tabs.current[index] = element }}
      id={`skill-tab-${index}`}
      role="tab"
      aria-selected={selected === index}
      aria-controls="skill-panel"
      tabIndex={selected === index ? 0 : -1}
      onClick={() => setSelected(index)}
      onKeyDown={event => {
        const next = event.key === 'ArrowRight' ? (index + 1) % disciplines.length
          : event.key === 'ArrowLeft' ? (index + disciplines.length - 1) % disciplines.length
          : event.key === 'Home' ? 0 : event.key === 'End' ? disciplines.length - 1 : null
        if (next === null) return
        event.preventDefault()
        setSelected(next)
        tabs.current[next]?.focus()
      }}
    >{labels[index]}{selected === index && <motion.span className="skill-tab-line" layoutId="skill-tab-line" transition={{duration: reduced ? 0 : .35, ease}}/>}</button>)}</div>
    <motion.div className="skill-panel" key={selected} id="skill-panel" role="tabpanel" aria-labelledby={`skill-tab-${selected}`} tabIndex={0}
      initial={{opacity: 0, y: reduced ? 0 : 7}} animate={{opacity: 1, y: 0}} transition={{duration: reduced ? .1 : .35, ease}}>
      <h2>{discipline.name}</h2><p>{discipline.description}</p>
      <div className="skill-groups">{discipline.groups.map(group => <div key={group.label}><h3>{group.label}</h3><ul>{group.items.map(skill => <li key={skill}>{skill}</li>)}</ul></div>)}</div>
    </motion.div>
  </div>
}

export function App() {
  const [active, setActive] = useState<PageId>(pageFromUrl)
  const activeRef = useRef(active)
  const mainRef = useRef<HTMLElement>(null)
  const shouldFocus = useRef(false)
  const [introOpen, setIntroOpen] = useState(needsNavigationTip)
  const [menuOpen, setMenuOpen] = useState(false)
  const reduced = useReducedMotionPreference()
  const current = pages.findIndex(page => page.id === active)
  const previous = pages[current - 1]
  const next = pages[(current + 1) % pages.length]

  const dismissIntro = useCallback(() => {
    try { localStorage.setItem(navigationTipKey, 'seen') } catch { /* Storage is optional. */ }
    setIntroOpen(false)
  }, [])

  const navigate = useCallback((id: PageId, updateHistory = true) => {
    setMenuOpen(false)
    if (id === activeRef.current) return
    if (mainRef.current?.contains(document.activeElement)) mainRef.current.focus({preventScroll: true})
    activeRef.current = id
    shouldFocus.current = true
    setActive(id)
    if (updateHistory) window.history.pushState(null, '', `#${id}`)
  }, [])

  const stepPage = useCallback((direction: -1 | 1) => {
    const index = pages.findIndex(item => item.id === activeRef.current)
    const destination = pages[index + direction]
    if (destination) navigate(destination.id)
  }, [navigate])

  usePageGestures(mainRef, stepPage, active, introOpen || menuOpen)

  useEffect(() => {
    const sync = () => navigate(pageFromUrl(), false)
    window.addEventListener('popstate', sync)
    window.addEventListener('hashchange', sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener('hashchange', sync)
    }
  }, [navigate])

  useEffect(() => {
    document.title = active === 'profile' ? 'Jason Shaw — Software & Systems' : `${pages[current].name} — Jason Shaw`
  }, [active, current])

  const exitTransition = { duration: reduced ? .1 : .24, ease: [.4, 0, .6, 1] as const,
    x: { duration: reduced ? 0 : .24 }, scale: { duration: reduced ? 0 : .24 }, filter: { duration: reduced ? 0 : .24 } }
  const pageVariants: Variants = {
    visible: { opacity: 1, x: 0, scale: 1, filter: 'blur(0px)', visibility: 'visible', transition: {
      duration: reduced ? .15 : .68, delay: reduced ? 0 : .08, ease,
      opacity: { duration: reduced ? .15 : .38, delay: reduced ? 0 : .08 },
      x: { duration: reduced ? 0 : .68, delay: reduced ? 0 : .08, ease },
      scale: { duration: reduced ? 0 : .68, delay: reduced ? 0 : .08, ease },
      filter: { duration: reduced ? 0 : .48, delay: reduced ? 0 : .08, ease },
    } },
    before: { opacity: 0, x: reduced ? 0 : 36, scale: reduced ? 1 : .994, filter: reduced ? 'blur(0px)' : 'blur(3px)', transition: exitTransition, transitionEnd: { visibility: 'hidden' } },
    after: { opacity: 0, x: reduced ? 0 : -36, scale: reduced ? 1 : .994, filter: reduced ? 'blur(0px)' : 'blur(3px)', transition: exitTransition, transitionEnd: { visibility: 'hidden' } },
  }

  function page(id: PageId, className: string, children: ReactNode) {
    const index = pages.findIndex(item => item.id === id)
    const visible = id === active
    return <motion.section key={id} id={`page-${id}`} className={`page ${className}`} aria-labelledby={`${id}-title`}
      aria-hidden={!visible} inert={!visible} initial={false} animate={visible ? 'visible' : index < current ? 'before' : 'after'}
      variants={pageVariants} style={{pointerEvents: visible ? 'auto' : 'none'}}
      onAnimationComplete={() => {
        if (visible && shouldFocus.current) {
          mainRef.current?.focus({preventScroll: true})
          shouldFocus.current = false
        }
      }}>
      {children}
    </motion.section>
  }

  return <MotionConfig reducedMotion="user">
    <a className="skip-link" href="#main" onClick={event => { event.preventDefault(); mainRef.current?.focus({preventScroll: true}) }}>Skip to content</a>
    <header className="site-header">
      <button className="small-wordmark" title="Profile" onClick={() => navigate('profile')}><Wordmark/></button>
      <nav className="main-nav" aria-label="Main navigation">{pages.map(item => <button key={item.id} aria-current={active === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}>{item.name}{active === item.id && <motion.span className="nav-active" layoutId="active-page" transition={{duration: reduced ? 0 : .4, ease}}/>}</button>)}</nav>
      <div className="header-links"><a className="header-github" href={profile.github} target="_blank" rel="noreferrer" aria-label="GitHub"><Github size={16}/><span>GitHub</span><ArrowUpRight size={13}/></a><a className="header-writing" href="/blog">Writing <span aria-hidden="true">↗</span></a></div>
    </header>
    <MobileNavigation pages={pages} active={active} open={menuOpen} onOpenChange={setMenuOpen} onNavigate={navigate} onHelp={() => setIntroOpen(true)}/>

    <main id="main" ref={mainRef} className="page-stage" tabIndex={-1} aria-label={pages[current].name}>
      {page('profile', 'hero', <>
        <Reveal className="hero-signature" delay={.1}><h1 id="profile-title" className="display-name"><Wordmark/></h1></Reveal>
        <div className="hero-main">
          <Reveal className="hero-intro"><span className="eyebrow">SOFTWARE & SYSTEMS</span><h2>Software first.<br/><span>The whole system<br className="desktop-break"/> in view.</span></h2><p>I build developer tools, web applications, and automation. With a background in electronics, embedded systems, and mechanical design, I most enjoy problems at the intersection of software and real-world constraints.</p><div className="hero-actions"><a className="metal-button" href={profile.github} target="_blank" rel="noreferrer"><Github size={16}/> Explore GitHub <ArrowUpRight size={15}/></a><button className="quiet-link" onClick={() => navigate('contact')}>Get in touch <ArrowUpRight size={15}/></button></div></Reveal>
          <Reveal className="hero-art" delay={.08}><SystemSculpture/></Reveal>
        </div>
      </>)}

      {page('work', 'work-page', <>
        <Reveal className="page-heading"><div><span className="eyebrow">PROJECTS</span><h1 id="work-title">Selected work.</h1></div></Reveal>
        <Reveal className="work-content" delay={.07}><ProjectCarousel/></Reveal>
      </>)}

      {page('expertise', 'expertise-page', <>
        <Reveal className="page-heading"><div><span className="eyebrow">EXPERTISE</span><h1 id="expertise-title">Software & beyond.</h1></div></Reveal>
        <div className="expertise-layout">
          <Reveal className="expertise-sidebar" delay={.06}><p>My interest in software grew through electronics and engineering projects. As a Project Support TA at USF, I helped students with Arduino programming, electronics, CAD, and prototyping in labs and office hours.</p><div className="education-note"><span className="eyebrow">EDUCATION</span><h2>University of South Florida</h2><p>Electrical Engineering studies, including Calculus, Differential Equations, Programming, and engineering fundamentals.</p></div></Reveal>
          <Reveal className="expertise-tabs-wrap" delay={.1}><Expertise/></Reveal>
        </div>
      </>)}

      {page('contact', 'contact-page', <div className="contact-layout">
        <Reveal className="contact-intro"><span className="eyebrow">CONTACT</span><h1 id="contact-title">Talk code.<br/><em>Talk shop.</em></h1><p>I’m interested in software development and related technical opportunities. Get in touch about a role, a collaboration, or a project you’re working on.</p><div className="contact-socials"><a href={profile.github} target="_blank" rel="noreferrer"><Github size={16}/><span>GitHub</span></a><a href={profile.linkedin} target="_blank" rel="noreferrer"><Linkedin size={16}/><span>LinkedIn</span></a><a href={profile.youtube} target="_blank" rel="noreferrer" aria-label="Jason Shaw on YouTube"><Youtube size={17}/></a><a href={profile.instagram} target="_blank" rel="noreferrer" aria-label="Jason Shaw on Instagram"><Instagram size={16}/></a></div></Reveal>
        <Reveal className="form-panel" delay={.08}><ContactForm/></Reveal>
      </div>)}
    </main>

    <nav className="page-controls" aria-label="Page navigation">
      <PageThread index={current} reduced={reduced}/>
      <button className="page-button previous-page" disabled={!previous} aria-label={`Previous page: ${previous?.name ?? 'Profile'}`} onClick={() => previous && navigate(previous.id)}><ArrowLeft size={14}/><span>{previous?.name ?? 'Profile'}</span></button>
      <div className="page-navigation-center"><button className="navigation-help" onClick={() => setIntroOpen(true)} aria-label="Scroll to explore. Navigation help"><Mouse size={12} className="scroll-mouse"/><span>Scroll</span><CircleHelp size={12} className="mobile-help-icon"/></button><span className="page-counter" aria-live="polite" aria-atomic="true"><span className="sr-only">{pages[current].name}, page </span>{String(current + 1).padStart(2, '0')}<span className="page-total"><span aria-hidden="true"> / </span><span className="sr-only"> of </span>04</span></span></div>
      <button className="page-button next-page" aria-label={`${current === pages.length - 1 ? 'Back to start' : 'Next page'}: ${next.name}`} onClick={() => navigate(next.id)}><span>{next.name}</span><ArrowRight size={14}/></button>
    </nav>
    <AnimatePresence onExitComplete={() => mainRef.current?.focus({preventScroll: true})}>{introOpen && <NavigationIntro onDismiss={dismissIntro}/>}</AnimatePresence>
  </MotionConfig>
}
