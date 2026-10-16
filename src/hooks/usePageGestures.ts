import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

function editing(target: EventTarget | null) {
  return target instanceof Element && !!target.closest('input, textarea, select, [contenteditable="true"]')
}

export function usePageGestures(
  stage: RefObject<HTMLElement | null>,
  onStep: (direction: -1 | 1) => void,
  pageId: string,
  paused: boolean,
) {
  const blockedUntil = useRef(0)
  const wheel = useRef({ lastAt: 0, sum: 0, direction: 0, latched: false })

  useEffect(() => { blockedUntil.current = performance.now() + 800 }, [pageId])

  useEffect(() => {
    const surface = stage.current
    let touch: { x: number; y: number } | null = null

    function onWheel(event: WheelEvent) {
      if (paused || event.ctrlKey || event.metaKey || event.shiftKey || editing(event.target) || editing(document.activeElement)) return
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX) || Math.abs(event.deltaY) < 2) return
      event.preventDefault()
      const now = performance.now()
      const gesture = wheel.current
      if (now - gesture.lastAt > 180) { gesture.sum = 0; gesture.latched = false; gesture.direction = 0 }
      gesture.lastAt = now
      if (gesture.latched || now < blockedUntil.current) return
      const direction = Math.sign(event.deltaY) as -1 | 1
      if (gesture.direction !== direction) gesture.sum = 0
      gesture.direction = direction
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1
      gesture.sum += Math.abs(event.deltaY) * unit
      if (gesture.sum < 64) return
      gesture.latched = true
      gesture.sum = 0
      onStep(direction)
    }

    function onKey(event: KeyboardEvent) {
      if (paused || event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey || editing(event.target)) return
      if (event.target instanceof Element && event.target.closest('button, a, [role="tablist"], [aria-roledescription="carousel"]')) return
      const direction = event.key === 'PageDown' || event.key === 'ArrowDown' ? 1 : event.key === 'PageUp' || event.key === 'ArrowUp' ? -1 : 0
      if (!direction) return
      event.preventDefault()
      if (performance.now() >= blockedUntil.current) onStep(direction)
    }

    function onTouchStart(event: TouchEvent) {
      touch = null
      if (paused || event.touches.length !== 1 || editing(event.target) || editing(document.activeElement)) return
      if (event.target instanceof Element && event.target.closest('button, a')) return
      touch = { x: event.touches[0].clientX, y: event.touches[0].clientY }
    }

    function onTouchMove(event: TouchEvent) {
      if (!touch || event.touches.length !== 1) { touch = null; return }
      const dx = event.touches[0].clientX - touch.x
      const dy = event.touches[0].clientY - touch.y
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx) * 1.4) event.preventDefault()
    }

    function onTouchEnd(event: TouchEvent) {
      if (!touch || event.changedTouches.length !== 1) { touch = null; return }
      const dx = event.changedTouches[0].clientX - touch.x
      const dy = event.changedTouches[0].clientY - touch.y
      touch = null
      if (Math.abs(dy) >= 60 && Math.abs(dy) > Math.abs(dx) * 1.4 && performance.now() >= blockedUntil.current) onStep(dy < 0 ? 1 : -1)
    }

    const cancelTouch = () => { touch = null }
    window.addEventListener('wheel', onWheel, {passive: false})
    window.addEventListener('keydown', onKey)
    surface?.addEventListener('touchstart', onTouchStart, {passive: true})
    surface?.addEventListener('touchmove', onTouchMove, {passive: false})
    surface?.addEventListener('touchend', onTouchEnd, {passive: true})
    surface?.addEventListener('touchcancel', cancelTouch, {passive: true})
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
      surface?.removeEventListener('touchstart', onTouchStart)
      surface?.removeEventListener('touchmove', onTouchMove)
      surface?.removeEventListener('touchend', onTouchEnd)
      surface?.removeEventListener('touchcancel', cancelTouch)
    }
  }, [onStep, paused, stage])
}
