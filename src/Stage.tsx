import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from 'react'
import type { Motif } from './motifs'
import {
  blendFit,
  createStroke,
  eraseAlong,
  eraserRadiusFor,
  fitOf,
  NO_FIT,
  paletteFor,
  stampSizeFor,
  tileMarkup,
  tileSize,
  type Brush,
  type Painting,
  type Repeat,
  type Stamp,
} from './painting'

// Short enough to read at a glance, and pointing at the dashed square the hint sits in
const HINTS: Record<Repeat, string> = {
  side: 'This square repeats in rows, like tiles',
  mirror: 'This square is mirrored on every side',
  spin: 'This square turns around each corner, like a pinwheel',
}

interface StageProps {
  painting: Painting
  motifs: Map<string, Motif>
  brush: Brush
  baked: boolean
  /** Pixels across one repeat once baked */
  bakedSize: number
  onCommit: (stamps: Stamp[]) => void
}

interface Point {
  x: number
  y: number
}

const useViewport = () => {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight })
  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return size
}

/** The part of the screen the panel doesn't cover, matching the panel's layout in index.css */
const freeArea = (width: number, height: number) =>
  width > 640
    ? { x: 324, y: 0, width: width - 324, height }
    : { x: 0, y: 0, width, height: height * 0.48 }

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

/**
 * How far through baking we are: 0 while painting, 1 once baked. Baking is
 * a zoom out from the one cell to the whole repeat while the repeats draw
 * together, so you see your drawing become the pattern rather than being
 * swapped for it. Pressing back halfway reverses from wherever it's got to.
 */
const useBakeProgress = (baked: boolean) => {
  const [progress, setProgress] = useState(baked ? 1 : 0)
  const shown = useRef(progress)
  useLayoutEffect(() => {
    shown.current = progress
  })

  useEffect(() => {
    const from = shown.current
    const to = baked ? 1 : 0
    if (from === to) return
    const start = performance.now()
    const duration = 750 * Math.abs(to - from)
    let frame = 0
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / duration)
      setProgress(from + (to - from) * k)
      if (k < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [baked])

  return ease(progress)
}

type Gesture =
  | { tool: 'brush'; stroke: ReturnType<typeof createStroke> }
  | { tool: 'eraser'; last: Point }

export const Stage = ({ painting, motifs, brush, baked, bakedSize, onCommit }: StageProps) => {
  const id = `paint${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const { width, height } = useViewport()
  const area = freeArea(width, height)
  const paintSize = Math.max(140, Math.min(area.width * 0.68, area.height * 0.68, 680))
  const progress = useBakeProgress(baked)
  // The zoom runs in log space, which reads as a steady pull back rather than a lurch
  const size = Math.round(
    Math.exp(Math.log(paintSize) + (Math.log(bakedSize) - Math.log(paintSize)) * progress),
  )
  // The tile stays centred in the free space, so baking zooms out around your drawing
  const left = Math.round(area.x + area.width / 2 - size / 2)
  const top = Math.round(area.y + area.height / 2 - size / 2)

  const [draft, setDraft] = useState<Stamp[] | null>(null)
  const draftRef = useRef<Stamp[] | null>(null)
  const gesture = useRef<Gesture | null>(null)
  const [cursor, setCursor] = useState<Point | null>(null)

  const palette = paletteFor(painting)
  const { repeat } = painting
  const stamps = draft ?? painting.stamps
  const bakedFit = useMemo(() => fitOf(painting), [painting])
  // While painting you see the cell exactly as painted; the fit only arrives with the bake
  const fit = useMemo(
    () => (progress === 0 ? NO_FIT : blendFit(bakedFit, repeat, progress)),
    [bakedFit, repeat, progress],
  )
  const body = useMemo(
    () => tileMarkup(stamps, palette, motifs, repeat, fit),
    [stamps, palette, motifs, repeat, fit],
  )
  const tile = tileSize(repeat, fit)
  // Whole pixels, so repeats never blend a seam; the drawing stretches by under a pixel to fit
  const tileWidth = Math.max(1, Math.round(tile.width * size))
  const tileHeight = Math.max(1, Math.round(tile.height * size))

  const toTile = (event: { clientX: number; clientY: number }): Point => ({
    x: (event.clientX - left) / size,
    y: (event.clientY - top) / size,
  })

  const updateDraft = (next: Stamp[]) => {
    draftRef.current = next
    setDraft(next)
  }

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (baked || event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = toTile(event)
    if (brush.tool === 'brush') {
      const stroke = createStroke(brush, painting.stamps, repeat)
      gesture.current = { tool: 'brush', stroke }
      updateDraft([...painting.stamps, ...stroke.start(point.x, point.y)])
    } else {
      gesture.current = { tool: 'eraser', last: point }
      updateDraft(eraseAlong(painting.stamps, point, point, eraserRadiusFor(brush), repeat))
    }
  }

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (event.pointerType === 'mouse') setCursor({ x: event.clientX, y: event.clientY })
    const current = gesture.current
    if (!current || !draftRef.current) return
    // Coalesced events keep fast strokes smooth instead of joining the dots
    const coalesced = event.nativeEvent.getCoalescedEvents?.() ?? []
    const events = coalesced.length > 0 ? coalesced : [event.nativeEvent]
    let next = draftRef.current
    for (const sample of events) {
      const point = toTile(sample)
      if (current.tool === 'brush') {
        const placed = current.stroke.to(point.x, point.y)
        if (placed.length > 0) next = [...next, ...placed]
      } else {
        next = eraseAlong(next, current.last, point, eraserRadiusFor(brush), repeat)
        current.last = point
      }
    }
    if (next !== draftRef.current) updateDraft(next)
  }

  const finish = () => {
    const next = draftRef.current
    if (!gesture.current || !next) return
    gesture.current = null
    draftRef.current = null
    setDraft(null)
    // Brushes only add and erasers only remove, so a change always changes the count
    if (next.length !== painting.stamps.length) onCommit(next)
  }

  const nextIndex = stamps.length
  const nextMotif = motifs.get(brush.shapes[nextIndex % brush.shapes.length])
  const stampPx = stampSizeFor(brush.size) * size
  const outline = palette.inks[0]

  return (
    <>
      <svg
        className={`paint-stage ${baked ? 'is-baked' : ''} tool-${brush.tool}`}
        style={{ backgroundColor: palette.background }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onPointerLeave={() => setCursor(null)}
        aria-label={baked ? 'Your pattern' : 'Painting tile'}
      >
        <defs>
          {/* One seamless tile: your cell plus, for mirror and spin, its three transformed copies */}
          <pattern
            id={id}
            patternUnits="userSpaceOnUse"
            x={left + Math.round(fit.frame.x * size)}
            y={top + Math.round(fit.frame.y * size)}
            width={tileWidth}
            height={tileHeight}
          >
            <rect width={tileWidth} height={tileHeight} fill={palette.background} />
            <g
              transform={`scale(${tileWidth / tile.width} ${tileHeight / tile.height})`}
              dangerouslySetInnerHTML={{ __html: body }}
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />

        {/* The neighbouring repeats stay visible but faded, so you can see what crossing an edge does */}
        <path
          className="paint-ghost"
          d={`M0 0H${width}V${height}H0Z M${left} ${top}h${size}v${size}h${-size}Z`}
          fillRule="evenodd"
          fill={palette.background}
        />
        <rect
          className="paint-outline"
          x={left + 0.5}
          y={top + 0.5}
          width={size - 1}
          height={size - 1}
          fill="none"
          stroke={outline}
        />

        {!baked && cursor && brush.tool === 'brush' && !draft && nextMotif && (
          <use
            className="paint-cursor"
            href={`#${nextMotif.ref}`}
            color={palette.inks[nextIndex % palette.inks.length]}
            transform={`translate(${cursor.x} ${cursor.y}) scale(${stampPx})`}
          />
        )}
        {!baked && cursor && brush.tool === 'eraser' && (
          <circle
            className="paint-eraser"
            cx={cursor.x}
            cy={cursor.y}
            r={eraserRadiusFor(brush) * size}
            stroke={outline}
          />
        )}
      </svg>

      {!baked && painting.stamps.length === 0 && !draft && (
        <div
          className="paint-hint"
          style={{ left, top, width: size, height: size, color: palette.inks[0] }}
        >
          <strong>Drag to paint</strong>
          <span>{HINTS[repeat]}</span>
        </div>
      )}
    </>
  )
}
