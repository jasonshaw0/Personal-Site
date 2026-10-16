import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { ArrowLeft, ArrowRight, ArrowUpRight, Chrome, Github } from 'lucide-react'
import { projects } from '../content'
import { ProjectScene } from './ProjectScene'
import { useReducedMotionPreference } from '../hooks/useReducedMotionPreference'

export function ProjectCarousel() {
  const [ref, api] = useEmblaCarousel({ align: 'center', containScroll: 'trimSnaps', loop: false, duration: 20 })
  const reduced = useReducedMotionPreference()
  const [selected, setSelected] = useState(0)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(true)
  const [imageMiddle, setImageMiddle] = useState(0)
  const update = useCallback(() => {
    if (!api) return
    setSelected(api.selectedScrollSnap())
    setCanPrev(api.canScrollPrev())
    setCanNext(api.canScrollNext())
  }, [api])

  useEffect(() => {
    if (!api) return
    update()
    api.on('select', update).on('reInit', update)
    return () => { api.off('select', update).off('reInit', update) }
  }, [api, update])

  useEffect(() => {
    const carousel = api?.rootNode().closest<HTMLElement>('[aria-roledescription="carousel"]')
    if (!carousel || !api) return
    const gesture = { lastAt: 0, lastStepAt: -Infinity, sum: 0, direction: 0 }

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return
      // Keep wheel gestures inside the collection, including at either end.
      event.preventDefault()
      event.stopPropagation()
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
      if (!delta) return
      const now = performance.now()
      const direction = Math.sign(delta)
      if (now - gesture.lastAt > 160 || direction !== gesture.direction) gesture.sum = 0
      gesture.lastAt = now
      gesture.direction = direction
      // Discard input during the short lock so momentum cannot queue up jumps.
      if (now - gesture.lastStepAt < 300) return
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? carousel.clientHeight : 1
      gesture.sum += Math.abs(delta) * unit
      if (gesture.sum < 36) return
      gesture.sum = 0
      gesture.lastStepAt = now
      if (direction > 0) api.scrollNext(!!reduced)
      else api.scrollPrev(!!reduced)
    }

    carousel.addEventListener('wheel', onWheel, { passive: false })
    return () => carousel.removeEventListener('wheel', onWheel)
  }, [api, reduced])

  useEffect(() => {
    const image = api?.slideNodes()[selected]?.querySelector('.project-image')
    if (!image) return
    const observer = new ResizeObserver(entries => setImageMiddle(entries[0].contentRect.height / 2))
    observer.observe(image)
    return () => observer.disconnect()
  }, [api, selected])

  return <div className="project-carousel" role="region" aria-roledescription="carousel" aria-label="Project collection" data-edge={!canPrev ? 'first' : !canNext ? 'last' : 'middle'} style={{'--image-middle': `${imageMiddle}px`} as CSSProperties}>
    <div className="carousel-frame">
    <div className="carousel-viewport" ref={ref} tabIndex={0} role="group" aria-label="Projects. Use left and right arrow keys to browse." onKeyDown={event => {
      if (event.target !== event.currentTarget) return
      if (event.key === 'ArrowLeft') { event.preventDefault(); api?.scrollPrev(!!reduced) }
      if (event.key === 'ArrowRight') { event.preventDefault(); api?.scrollNext(!!reduced) }
      if (event.key === 'Home') { event.preventDefault(); api?.scrollTo(0, !!reduced) }
      if (event.key === 'End') { event.preventDefault(); api?.scrollTo(projects.length - 1, !!reduced) }
    }}>
      <div className="carousel-track">
        {projects.map((project, index) => <div key={project.id} className={`project-slide ${selected === index ? 'is-selected' : ''}`} role="group" aria-roledescription="slide" aria-current={selected === index ? 'true' : undefined} aria-label={`${index + 1} of ${projects.length}: ${project.title}`}
          onFocusCapture={() => { if (selected !== index) api?.scrollTo(index, !!reduced) }}>
          <ProjectScene project={project} selected={selected === index}/>
          <div className="project-detail"><div className="project-category"><span>{project.category}</span></div>
            <h2>{project.title}</h2><p>{project.description}</p>
            <div className="project-bottom"><div className="project-tags">{project.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
              <a className="project-link" href={project.href} target="_blank" rel="noreferrer" aria-label={`${project.linkLabel}: ${project.title}`}>{project.visual === 'dates' ? <Chrome size={15}/> : <Github size={15}/>}<span>{project.linkLabel}</span><ArrowUpRight size={14}/></a>
            </div>
          </div>
        </div>)}
      </div>
    </div>
    <button className="carousel-arrow carousel-previous" aria-label="Previous project" disabled={!canPrev} onClick={() => api?.scrollPrev(!!reduced)}><ArrowLeft size={21}/></button>
    <button className="carousel-arrow carousel-next" aria-label="Next project" disabled={!canNext} onClick={() => api?.scrollNext(!!reduced)}><ArrowRight size={21}/></button>
    </div>
    <div className="carousel-footer"><div className="carousel-position"><span className="current-slide" aria-live="polite" aria-atomic="true">{String(selected + 1).padStart(2, '0')} <span className="sr-only">of {projects.length} projects</span></span><div className="carousel-progress" aria-hidden="true"><span style={{width: `${((selected + 1) / projects.length) * 100}%`}}/></div><span aria-hidden="true">{String(projects.length).padStart(2, '0')}</span></div>
    </div>
  </div>
}
