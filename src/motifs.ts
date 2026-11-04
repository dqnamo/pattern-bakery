import motifList from '../data/motifs.json'

const files = import.meta.glob<string>('../data/motifs/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
})

export interface Motif {
  id: string
  name: string
  /** Element id used by `<use href>` */
  ref: string
  /** Inner markup of the source SVG */
  markup: string
  /** Presentation attributes copied from the source `<svg>` root (fill, stroke…) */
  attrs: string
  /** Maps the drawn shape onto a box one unit across, centred on the origin */
  transform: string
}

const INHERITED_ATTRS = [
  'fill',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
]

/**
 * Every motif is drawn into a 24×24 box with its own idea of padding and
 * centre (the arch sits at the bottom, the dot is half the size of the
 * square). We render each one once and measure the ink, so the pattern can
 * centre shapes on their visual middle and give them the same visual weight.
 */
const measure = async (source: string) => {
  const doc = new DOMParser().parseFromString(source, 'image/svg+xml')
  const root = doc.documentElement
  const [vx, vy, vw, vh] = (root.getAttribute('viewBox') ?? '0 0 24 24').split(/[\s,]+/).map(Number)
  const scale = 8
  const width = Math.round(vw * scale)
  const height = Math.round(vh * scale)

  const probe = root.cloneNode(true) as Element
  probe.setAttribute('width', String(width))
  probe.setAttribute('height', String(height))
  probe.setAttribute('color', '#000')
  const image = new Image()
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(probe))}`
  await image.decode()

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(image, 0, 0)
  const { data } = ctx.getImageData(0, 0, width, height)

  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  let ink = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3]
      if (alpha === 0) continue
      ink += alpha / 255
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  if (maxX < 0) return { cx: vx + vw / 2, cy: vy + vh / 2, extent: Math.max(vw, vh), coverage: 1 }

  const boxW = (maxX + 1 - minX) / scale
  const boxH = (maxY + 1 - minY) / scale
  const extent = Math.max(boxW, boxH)
  return {
    cx: vx + (minX + (maxX + 1)) / 2 / scale,
    cy: vy + (minY + (maxY + 1)) / 2 / scale,
    extent,
    coverage: ink / (scale * scale) / (extent * extent),
  }
}

/**
 * Fitting every shape to the same box makes solid shapes (square) look
 * heavier than open ones (star, wave). Nudge size by how much of the box is
 * inked, softened to a quarter power so a thin dash is not blown up to
 * twice the size of a square.
 */
const opticalSize = (coverage: number) => Math.min(1.08, Math.max(0.82, (0.5 / coverage) ** 0.25))

const round = (n: number) => Math.round(n * 1000) / 1000

const loadMotif = async (entry: (typeof motifList.motifs)[number]): Promise<Motif> => {
  const source = files[`../data/${entry.file}`]
  const doc = new DOMParser().parseFromString(source, 'image/svg+xml')
  const root = doc.documentElement
  const serializer = new XMLSerializer()
  const markup = Array.from(root.childNodes, (node) => serializer.serializeToString(node))
    .join('')
    .replaceAll(' xmlns="http://www.w3.org/2000/svg"', '')
  const attrs = INHERITED_ATTRS.filter((name) => root.hasAttribute(name))
    .map((name) => `${name}="${root.getAttribute(name)}"`)
    .join(' ')

  const { cx, cy, extent, coverage } = await measure(source)
  const fit = opticalSize(coverage) / extent

  return {
    id: entry.id,
    name: entry.name,
    ref: `motif-${entry.id}`,
    markup,
    attrs,
    transform: `scale(${round(fit)}) translate(${round(-cx)} ${round(-cy)})`,
  }
}

export const motifDef = (motif: Motif) =>
  `<g id="${motif.ref}" ${motif.attrs} transform="${motif.transform}">${motif.markup}</g>`

export const motifsPromise: Promise<Motif[]> = Promise.all(motifList.motifs.map(loadMotif))
