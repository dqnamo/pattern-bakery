import { useCallback, useEffect, useRef, useState } from 'react'

interface History<T> {
  past: T[]
  present: T
  future: T[]
}

/**
 * Undo makes it safe to try things: you can always get back to where you
 * were. Rapid changes to the same control (dragging a slider)
 * collapse into one step.
 */
export const useHistory = <T>(initial: () => T) => {
  const [history, setHistory] = useState<History<T>>(() => ({
    past: [],
    present: initial(),
    future: [],
  }))
  const last = useRef<{ key: string; time: number } | null>(null)

  const update = useCallback((change: (present: T) => T, key?: string) => {
    const now = performance.now()
    const merge = key !== undefined && last.current?.key === key && now - last.current.time < 800
    last.current = key === undefined ? null : { key, time: now }
    setHistory((h) => {
      const present = change(h.present)
      if (present === h.present) return h
      if (merge) return { ...h, present, future: [] }
      return { past: [...h.past.slice(-99), h.present], present, future: [] }
    })
  }, [])

  const undo = useCallback(() => {
    last.current = null
    setHistory((h) =>
      h.past.length === 0
        ? h
        : {
            past: h.past.slice(0, -1),
            present: h.past[h.past.length - 1],
            future: [h.present, ...h.future],
          },
    )
  }, [])

  const redo = useCallback(() => {
    last.current = null
    setHistory((h) =>
      h.future.length === 0
        ? h
        : { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) },
    )
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return
      const key = event.key.toLowerCase()
      if (key === 'z' && !event.shiftKey) undo()
      else if ((key === 'z' && event.shiftKey) || key === 'y') redo()
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  return {
    present: history.present,
    update,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  }
}
