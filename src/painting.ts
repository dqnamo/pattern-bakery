import { motifDef, type Motif } from './motifs'
import { PALETTES, type Palette } from './palettes'

/**
 * You paint one square cell. Positions are in cell units (0–1 across), so
 * the same painting can be shown big while you paint and small once it's
 * baked without anything moving relative to anything else.
 */
export interface Stamp {
  x: number
  y: number
  motif: string
  /** Running count when it was placed; picks the colour, so colours cycle along a stroke */
  ink: number
  /** Width of the shape, in cell units. Shapes are never turned: every one stands the right way up */
  size: number
}

/**
 * How the painted cell fills the plane.
 *
 * - side: copied side by side, so it wraps at the edges.
 * - mirror: flipped across both edges into a symmetrical 2×2 block.
 * - spin: moved round a shared corner a quarter at a time, into a 2×2 pinwheel.
 *
 * Shapes always stand the right way up, whichever copy they're in.
 */
export const REPEATS = ['mirror', 'spin', 'side'] as const
export type Repeat = (typeof REPEATS)[number]

/**
 * Named after things everyone has seen rather than what the maths does:
 * a reflection, a pinwheel, a tiled floor.
 */
export const REPEAT_LABELS: Record<Repeat, string> = {
  mirror: 'Mirror',
  spin: 'Pinwheel',
  side: 'Tiles',
}

/** One plain sentence on what you'll get, shown under the choice */
export const REPEAT_NOTES: Record<Repeat, string> = {
  mirror: 'Flipped like a reflection, so it always comes out symmetrical',
  spin: 'Turned around each corner, so it swirls',
  side: 'The same square over and over, in straight rows',
}

export interface Painting {
  palette: string
  repeat: Repeat
  stamps: Stamp[]
}

export type Tool = 'brush' | 'eraser'

export interface Brush {
  shapes: string[]
  /** Slider position, 0–1 */
  size: number
  /** Slider position, 0–1 */
  spacing: number
  tool: Tool
}

/** Sliders are logarithmic: each step looks like the same amount of change */
export const stampSizeFor = (size: number) => 0.035 * (0.24 / 0.035) ** size
/**
 * Distance between shapes along a stroke, as a multiple of their size. The
 * tightest setting is just touching: any closer and a stroke would collide
 * with itself and wobble out of line.
 */
export const stepFor = (spacing: number) => 1.15 * (3.4 / 1.15) ** spacing
/** How many pixels across one painted cell is once baked */
export const bakedSizeFor = (size: number) => 70 * (420 / 70) ** size

/** Cells across one seamless tile: a mirror or a spin needs a 2×2 block before it repeats */
export const periodFor = (repeat: Repeat) => (repeat === 'side' ? 1 : 2)

const mod = (n: number, m: number) => ((n % m) + m) % m
/** Shortest distance between two coordinates on a tile that wraps every `period` */
const wrapBy = (d: number, period: number) => d - period * Math.round(d / period)

interface Placement {
  x: number
  y: number
}

/**
 * Which rectangle of the plane counts as the painted cell when it repeats,
 * plus a nudge for every shape in it. While you paint, that's the square you
 * painted in, unmoved. Baking trims it (see `fitFor`).
 */
export interface Fit {
  frame: { x: number; y: number; w: number; h: number }
  shift: { x: number; y: number }
}

export const NO_FIT: Fit = { frame: { x: 0, y: 0, w: 1, h: 1 }, shift: { x: 0, y: 0 } }

/**
 * Where one painted stamp shows up in each cell of the tile.
 *
 * Positions are truly mirrored or spun, but the shapes themselves aren't:
 * a heart stays the right way up in every quarter instead of hanging upside
 * down, and nothing is ever drawn back to front.
 */
export const copiesOf = (stamp: Stamp, repeat: Repeat, fit: Fit = NO_FIT): Placement[] => {
  const { frame, shift } = fit
  const x = stamp.x + shift.x
  const y = stamp.y + shift.y
  if (repeat === 'side') {
    // Side by side wraps, so each shape is placed one lap round from the frame's edge
    return [{ x: frame.x + mod(x - frame.x, 1), y: frame.y + mod(y - frame.y, 1) }]
  }
  // The frame's far edges are the mirror lines, and its far corner is the centre of the spin
  const ex = frame.x + frame.w
  const ey = frame.y + frame.h
  if (repeat === 'mirror') {
    return [
      { x, y },
      { x: 2 * ex - x, y },
      { x, y: 2 * ey - y },
      { x: 2 * ex - x, y: 2 * ey - y },
    ]
  }
  // Quarter turns clockwise around the corner the four cells share
  const dx = x - ex
  const dy = y - ey
  return [
    { x, y },
    { x: ex - dy, y: ey + dx },
    { x: ex - dx, y: ey - dy },
    { x: ex + dy, y: ey - dx },
  ]
}

/** Width and height of one seamless tile, in cell units */
export const tileSize = (repeat: Repeat, fit: Fit = NO_FIT) => {
  const period = periodFor(repeat)
  return { width: fit.frame.w * period, height: fit.frame.h * period }
}

/** How much of a shape's size is ink, from its centre: motifs are fitted to a unit box */
const RADIUS = 0.5

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

/**
 * The gap your drawing already uses: for each shape, the clear space to its
 * nearest neighbour, and the middle of those. A lone shape gets a gap a bit
 * under its own size.
 */
const naturalGap = (stamps: Stamp[]) => {
  const typical = median(stamps.map((stamp) => stamp.size))
  if (stamps.length < 2) return typical * 0.8
  const clearances = stamps.map((a, i) => {
    let nearest = Infinity
    for (let j = 0; j < stamps.length; j++) {
      if (j === i) continue
      const b = stamps[j]
      nearest = Math.min(nearest, Math.hypot(a.x - b.x, a.y - b.y) - (a.size + b.size) * RADIUS)
    }
    return nearest
  })
  // Never tighter than the brush allows
  return Math.max(typical * 0.12, median(clearances))
}

/**
 * On a wrapping line one cell long, the widest stretch nothing covers.
 * Returns where the covered part starts after it, and how long the covered part is.
 */
const coveredSpan = (intervals: [number, number][]) => {
  const sorted = intervals
    .map(([a, b]): [number, number] => [mod(a, 1), mod(a, 1) + (b - a)])
    .sort((p, q) => p[0] - q[0])
  // Twice round, so the gap between the last shape and the first counts too
  const ring = [...sorted, ...sorted.map(([a, b]): [number, number] => [a + 1, b + 1])]
  let reach = ring[0][1]
  let widest = 0
  let start = ring[0][0]
  for (let i = 1; i <= sorted.length; i++) {
    const [a, b] = ring[i]
    if (a - reach > widest) {
      widest = a - reach
      start = a
    }
    reach = Math.max(reach, b)
  }
  return { start: mod(start, 1), span: 1 - widest }
}

/**
 * Even spacing for a baked painting: trims the empty margin around your
 * drawing so the gap between one repeat and the next matches the gaps inside
 * it. It only ever takes space away; a drawing that's already tighter than
 * its own gaps is left as it is. Your painting itself never changes, only
 * the frame it repeats in.
 */
export const fitFor = (stamps: Stamp[], repeat: Repeat): Fit => {
  if (stamps.length === 0) return NO_FIT
  const gap = naturalGap(stamps)
  const reach = (stamp: Stamp) => stamp.size * RADIUS

  if (repeat === 'side') {
    // The drawing can wrap round the edges, so look for the widest empty band
    // anywhere and put the new edge in the middle of what's left of it
    const across = coveredSpan(stamps.map((s) => [s.x - reach(s), s.x + reach(s)]))
    const down = coveredSpan(stamps.map((s) => [s.y - reach(s), s.y + reach(s)]))
    const w = Math.min(1, across.span + gap)
    const h = Math.min(1, down.span + gap)
    return {
      frame: {
        x: w < 1 ? across.start - gap / 2 : 0,
        y: h < 1 ? down.start - gap / 2 : 0,
        w,
        h,
      },
      shift: { x: 0, y: 0 },
    }
  }

  const minX = Math.min(...stamps.map((s) => s.x - reach(s)))
  const maxX = Math.max(...stamps.map((s) => s.x + reach(s)))
  const minY = Math.min(...stamps.map((s) => s.y - reach(s)))
  const maxY = Math.max(...stamps.map((s) => s.y + reach(s)))

  if (repeat === 'mirror') {
    // A shape and its reflection end up one gap apart: half a gap each side of the mirror line
    const w = Math.min(1, maxX - minX + gap)
    const h = Math.min(1, maxY - minY + gap)
    return {
      frame: { x: w < 1 ? minX - gap / 2 : 0, y: h < 1 ? minY - gap / 2 : 0, w, h },
      shift: { x: 0, y: 0 },
    }
  }

  // A spin has to stay square and turn around its corner. Its edges meet in
  // pairs: the two edges at the corner touch each other, a quarter turn
  // apart, and so do the two outside edges. So each seam's gap is the room
  // left on one edge plus the room on the other, and a drawing that's wider
  // than it is tall can still have both seams come out even, as long as the
  // room is shared out unevenly between the edges of each pair.
  const spanX = maxX - minX
  const spanY = maxY - minY
  const excess = spanX - spanY
  const fits = Math.abs(excess) <= 2 * gap
  const side = fits ? (spanX + spanY) / 2 + gap : Math.max(spanX, spanY) + gap
  if (side >= 1) return NO_FIT
  // Room between the drawing and the corner, across and down; the two add up to one gap
  const nearX = fits ? Math.min(Math.max(gap / 2, -excess / 2, 0), gap, gap - excess / 2) : gap / 2
  const nearY = gap - nearX
  return {
    frame: { x: 1 - side, y: 1 - side, w: side, h: side },
    shift: { x: 1 - nearX - maxX, y: 1 - nearY - maxY },
  }
}

/** Baked patterns are always evenly spaced */
export const fitOf = (painting: Painting) => fitFor(painting.stamps, painting.repeat)

/**
 * Part way between the cell as painted (0) and its baked fit (1), so baking
 * can show the repeats drawing together instead of jumping. Side by side
 * keeps its edge where the gap is, so nothing slides across the tile.
 */
export const blendFit = (fit: Fit, repeat: Repeat, t: number): Fit => {
  const from = repeat === 'side' ? { ...fit.frame, w: 1, h: 1 } : NO_FIT.frame
  const lerp = (a: number, b: number) => a + (b - a) * t
  return {
    frame: {
      x: lerp(from.x, fit.frame.x),
      y: lerp(from.y, fit.frame.y),
      w: lerp(from.w, fit.frame.w),
      h: lerp(from.h, fit.frame.h),
    },
    shift: { x: fit.shift.x * t, y: fit.shift.y * t },
  }
}

/**
 * The other way round: which point of the painted cell a point anywhere on
 * the plane is a copy of. This is what lets you paint straight onto the
 * faded neighbours.
 */
export const fold = (px: number, py: number, repeat: Repeat): Placement => {
  if (repeat === 'side') return { x: mod(px, 1), y: mod(py, 1) }
  const bx = mod(px, 2)
  const by = mod(py, 2)
  // Each mirror flip undoes itself
  if (repeat === 'mirror') return { x: bx >= 1 ? 2 - bx : bx, y: by >= 1 ? 2 - by : by }
  const quarter = bx < 1 ? (by < 1 ? 0 : 3) : by < 1 ? 1 : 2
  let dx = bx - 1
  let dy = by - 1
  for (let n = 0; n < quarter; n++) [dx, dy] = [dy, -dx]
  return { x: 1 + dx, y: 1 + dy }
}

const num = (n: number) => String(Math.round(n * 10000) / 10000)

/**
 * How far a shape can reach from its centre, as a share of its size. Motifs
 * fit a unit box (a little over, after optical sizing), with its corners out
 * on the diagonal.
 */
const REACH = 0.78

/**
 * Markup for one seamless tile (see `tileSize`), measured from the frame's
 * top-left corner. A shape that hangs over the tile's edge is drawn again on
 * the opposite side, so the tile is the whole truth and its repeats meet
 * without a seam.
 */
export const tileMarkup = (
  stamps: Stamp[],
  palette: Palette,
  motifs: Map<string, Motif>,
  repeat: Repeat,
  fit: Fit = NO_FIT,
) => {
  const { width, height } = tileSize(repeat, fit)
  const parts: string[] = []
  for (const stamp of stamps) {
    const motif = motifs.get(stamp.motif)
    if (!motif) continue
    const colour = palette.inks[stamp.ink % palette.inks.length]
    const reach = stamp.size * REACH
    for (const copy of copiesOf(stamp, repeat, fit)) {
      for (const ox of [-width, 0, width]) {
        for (const oy of [-height, 0, height]) {
          const x = copy.x - fit.frame.x + ox
          const y = copy.y - fit.frame.y + oy
          if (x + reach < 0 || x - reach > width || y + reach < 0 || y - reach > height) continue
          parts.push(
            `<use href="#${motif.ref}" color="${colour}" transform="translate(${num(x)} ${num(y)}) scale(${num(stamp.size)})"/>`,
          )
        }
      }
    }
  }
  return parts.join('')
}

/** A complete, standalone SVG of one seamless tile, with each painted cell `cellPx` pixels across */
export const paintingSvg = (painting: Painting, motifs: Map<string, Motif>, cellPx: number) => {
  const palette = paletteFor(painting)
  const fit = fitOf(painting)
  const { width, height } = tileSize(painting.repeat, fit)
  // Whole pixels, so repeats never blend a seam; the drawing stretches by under a pixel to fit
  const pxWidth = Math.max(1, Math.round(width * cellPx))
  const pxHeight = Math.max(1, Math.round(height * cellPx))
  const used = [...new Set(painting.stamps.map((stamp) => stamp.motif))]
    .map((id) => motifs.get(id))
    .filter((motif) => motif !== undefined)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${pxWidth}" height="${pxHeight}" viewBox="0 0 ${num(width)} ${num(height)}" preserveAspectRatio="none"><defs>${used.map(motifDef).join('')}</defs><rect width="${num(width)}" height="${num(height)}" fill="${palette.background}"/>${tileMarkup(painting.stamps, palette, motifs, painting.repeat, fit)}</svg>`
}

export const paletteFor = (painting: Painting) =>
  PALETTES.find((palette) => palette.id === painting.palette) ?? PALETTES[0]

/**
 * Room each shape keeps for itself: a circle this share of its size in
 * radius. A little over half, so neighbours never quite touch and every
 * shape stays readable on its own.
 */
const BODY = 0.56

/**
 * Where a shape may slide to, sideways off the line, as a share of its size,
 * nearest first. Small enough that the line still reads as a line.
 */
const NUDGES = [0, 0.18, -0.18, 0.36, -0.36, 0.54, -0.54, 0.72, -0.72]

interface Body {
  x: number
  y: number
  r: number
}

const bodiesOf = (stamp: Stamp, repeat: Repeat): Body[] =>
  copiesOf(stamp, repeat).map((copy) => ({ x: copy.x, y: copy.y, r: stamp.size * BODY }))

/**
 * Lays shapes along a stroke. Shapes are dropped at an even step, measured
 * from the last shape rather than from the last pointer event, so a fast
 * flick and a slow drag leave the same rhythm. Points are on the open plane:
 * a stroke that runs off the cell keeps its spacing, and only the stamps it
 * leaves behind are folded back into the cell.
 *
 * Shapes never land on each other. What's already painted stays exactly
 * where it is; a new shape that would overlap something slides a little way
 * sideways off the line to find room, and if there's none nearby it's left
 * out and the stroke carries on in step on the other side. So crossing
 * strokes weave through each other and a stroke stops cleanly at a mirror
 * line instead of piling into its own reflection.
 */
export const createStroke = (brush: Brush, existing: Stamp[], repeat: Repeat) => {
  const size = stampSizeFor(brush.size)
  const step = size * stepFor(brush.spacing)
  const period = periodFor(repeat)
  // Every copy of every shape is in the way, not just the ones in the painted cell
  const bodies = existing.flatMap((stamp) => bodiesOf(stamp, repeat))
  let index = existing.length
  let anchor: { x: number; y: number } | null = null

  const overlaps = (a: Body, b: Body) =>
    Math.hypot(wrapBy(a.x - b.x, period), wrapBy(a.y - b.y, period)) < a.r + b.r

  const fits = (candidate: Body[]) =>
    candidate.every(
      (body, i) =>
        !bodies.some((other) => overlaps(body, other)) &&
        // Near a mirror line or the middle of a spin, a shape would land on its own copy
        !candidate.slice(i + 1).some((other) => overlaps(body, other)),
    )

  const stamp = (x: number, y: number, travel: number | null): Stamp[] => {
    // Sideways to the line; a tap has no line, so it tries up and down
    const nx = travel === null ? 0 : -Math.sin(travel)
    const ny = travel === null ? 1 : Math.cos(travel)
    for (const nudge of NUDGES) {
      const folded = fold(x + nx * nudge * size, y + ny * nudge * size, repeat)
      const placed: Stamp = {
        x: folded.x,
        y: folded.y,
        motif: brush.shapes[index % brush.shapes.length],
        ink: index,
        size,
      }
      const placedBodies = bodiesOf(placed, repeat)
      if (!fits(placedBodies)) continue
      bodies.push(...placedBodies)
      // Only shapes that land count, so a skipped one doesn't break the shape and colour sequence
      index++
      return [placed]
    }
    return []
  }

  return {
    start(x: number, y: number): Stamp[] {
      anchor = { x, y }
      return stamp(x, y, null)
    },
    to(x: number, y: number): Stamp[] {
      if (!anchor) return []
      const placed: Stamp[] = []
      for (;;) {
        const dx: number = x - anchor.x
        const dy: number = y - anchor.y
        const distance = Math.hypot(dx, dy)
        if (distance < step) break
        anchor = { x: anchor.x + (dx / distance) * step, y: anchor.y + (dy / distance) * step }
        placed.push(...stamp(anchor.x, anchor.y, Math.atan2(dy, dx)))
      }
      return placed
    },
  }
}

/** Runs the brush along a path in one go, for previews */
export const strokeAlong = (brush: Brush, points: [number, number][], repeat: Repeat) => {
  const stroke = createStroke({ ...brush, tool: 'brush' }, [], repeat)
  const stamps: Stamp[] = []
  points.forEach(([x, y], k) => stamps.push(...(k === 0 ? stroke.start(x, y) : stroke.to(x, y))))
  return stamps
}

/** Eraser reach, in cell units: a little wider than the brush so it's easy to hit things */
export const eraserRadiusFor = (brush: Brush) => stampSizeFor(brush.size) * 0.75

/**
 * Removes every stamp the eraser touches between two points. It checks every
 * copy, so rubbing out a mirrored or spun copy rubs out the shape it came from.
 */
export const eraseAlong = (
  stamps: Stamp[],
  from: { x: number; y: number },
  to: { x: number; y: number },
  radius: number,
  repeat: Repeat,
) => {
  const period = periodFor(repeat)
  const length = Math.hypot(to.x - from.x, to.y - from.y)
  const samples = Math.max(1, Math.ceil(length / (radius / 2)))
  const points = Array.from({ length: samples + 1 }, (_, k) => ({
    x: from.x + ((to.x - from.x) * k) / samples,
    y: from.y + ((to.y - from.y) * k) / samples,
  }))
  const kept = stamps.filter((stamp) => {
    const hit = radius + stamp.size * 0.35
    return !copiesOf(stamp, repeat).some((copy) =>
      points.some(
        (point) =>
          Math.hypot(wrapBy(copy.x - point.x, period), wrapBy(copy.y - point.y, period)) < hit,
      ),
    )
  })
  return kept.length === stamps.length ? stamps : kept
}
