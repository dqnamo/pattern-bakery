import { Suspense, use, useEffect, useMemo, useState } from 'react'
import { motifsPromise, type Motif } from './motifs'
import { PALETTES } from './palettes'
import { MotifDefs } from './MotifDefs'
import { useHistory } from './useHistory'
import { bakedSizeFor, REPEATS, type Brush, type Painting, type Stamp } from './painting'
import { Panel } from './Panel'
import { Stage } from './Stage'

const STORAGE_KEY = 'pattern-bakery'

/**
 * Leaves along a vine: two shapes that alternate, on a palette where each
 * shape keeps its own colour. The first stroke
 * anyone makes looks deliberate.
 */
const DEFAULT_BRUSH: Brush = {
  shapes: ['leaf', 'dot'],
  size: 0.42,
  spacing: 0.35,
  tool: 'brush',
}

/**
 * Mirror by default: it makes almost any first scribble look deliberate, and
 * it shows at once that this is for making patterns, not pictures.
 */
const DEFAULT_PAINTING: Painting = {
  palette: 'forest',
  repeat: 'mirror',
  stamps: [],
}
const DEFAULT_BAKED_SIZE = 0.4

interface Saved {
  painting: Painting
  brush: Brush
  bakedSize: number
}

const isNumber = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const clamp01 = (n: unknown, fallback: number) =>
  isNumber(n) ? Math.min(1, Math.max(0, n)) : fallback

/** Your painting survives a refresh. Anything stored that no longer makes sense falls back to the defaults */
const load = (motifs: Map<string, Motif>): Saved => {
  let raw: Partial<Saved> = {}
  try {
    raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    // Private windows and blocked storage just start fresh
  }
  const painting = raw.painting
  const brush = raw.brush
  const stamps = Array.isArray(painting?.stamps)
    ? painting.stamps
        .filter((s: Stamp) => s && motifs.has(s.motif) && [s.x, s.y, s.ink, s.size].every(isNumber))
        // Older paintings saved a turn for each shape; everything stands upright now
        .map(({ x, y, motif, ink, size }: Stamp) => ({ x, y, motif, ink, size }))
    : []
  const shapes = Array.isArray(brush?.shapes)
    ? brush.shapes.filter((id: unknown) => typeof id === 'string' && motifs.has(id))
    : []
  return {
    painting: {
      palette: PALETTES.some((p) => p.id === painting?.palette)
        ? painting!.palette
        : DEFAULT_PAINTING.palette,
      repeat: REPEATS.includes(painting?.repeat as Painting['repeat'])
        ? painting!.repeat
        : DEFAULT_PAINTING.repeat,
      stamps,
    },
    brush: {
      shapes: shapes.length > 0 ? shapes : DEFAULT_BRUSH.shapes,
      size: clamp01(brush?.size, DEFAULT_BRUSH.size),
      spacing: clamp01(brush?.spacing, DEFAULT_BRUSH.spacing),
      tool: brush?.tool === 'eraser' ? 'eraser' : 'brush',
    },
    bakedSize: clamp01(raw.bakedSize, DEFAULT_BAKED_SIZE),
  }
}

const Painter = ({ motifs }: { motifs: Motif[] }) => {
  const motifMap = useMemo(() => new Map(motifs.map((motif) => [motif.id, motif])), [motifs])
  const [saved] = useState(() => load(motifMap))
  const {
    present: painting,
    update,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory<Painting>(() => saved.painting)
  const [brush, setBrush] = useState<Brush>(saved.brush)
  const [bakedSize, setBakedSize] = useState(saved.bakedSize)
  const [baked, setBaked] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ painting, brush, bakedSize }))
    } catch {
      // Storage full or blocked: painting still works, it just won't survive a refresh
    }
  }, [painting, brush, bakedSize])

  // Undoing back to an empty tile leaves nothing to look at, so go back to painting
  const showBaked = baked && painting.stamps.length > 0

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.target instanceof HTMLInputElement && event.target.type !== 'range') return
      const key = event.key.toLowerCase()
      if (key === 'b') setBrush((b) => ({ ...b, tool: 'brush' }))
      else if (key === 'e') setBrush((b) => ({ ...b, tool: 'eraser' }))
      else return
      setBaked(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <Stage
        painting={painting}
        motifs={motifMap}
        brush={brush}
        baked={showBaked}
        bakedSize={bakedSizeFor(bakedSize)}
        onCommit={(stamps) => update((p) => ({ ...p, stamps }))}
      />
      <Panel
        painting={painting}
        motifs={motifs}
        motifMap={motifMap}
        brush={brush}
        setBrush={setBrush}
        update={update}
        undo={undo}
        redo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        baked={showBaked}
        setBaked={setBaked}
        bakedSize={bakedSize}
        setBakedSize={setBakedSize}
      />
    </>
  )
}

const Loaded = () => {
  const motifs = use(motifsPromise)
  return (
    <main>
      <MotifDefs motifs={motifs} />
      <Painter motifs={motifs} />
    </main>
  )
}

const App = () => (
  <Suspense fallback={<main />}>
    <Loaded />
  </Suspense>
)

export default App
