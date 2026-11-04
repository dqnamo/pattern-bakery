import type { Motif } from './motifs'
import { paintingSvg, type Painting } from './painting'

export interface Target {
  id: string
  label: string
  detail: string
  width: number
  height: number
  /** Pixels per on-screen pixel, so the pattern comes out the same physical size as you see it here */
  scale: number
}

const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1))

/**
 * Downloads are named for what they're for, not the file format. Nobody
 * without a design background knows what resolution a wallpaper needs, but
 * they know they want one for their phone.
 */
export const TARGETS: Target[] = [
  {
    id: 'phone',
    label: 'Phone wallpaper',
    detail: 'Picture, sized for a phone',
    width: 1290,
    height: 2796,
    scale: 3,
  },
  {
    id: 'desktop',
    label: 'Computer wallpaper',
    detail: 'Picture, sized for this screen',
    width: Math.round(window.screen.width * dpr),
    height: Math.round(window.screen.height * dpr),
    scale: dpr,
  },
]

const save = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** The repeat comes out the same physical size as it looks on screen */
export const downloadPicture = async (
  painting: Painting,
  motifs: Map<string, Motif>,
  bakedSize: number,
  target: Target,
) => {
  const px = Math.max(1, Math.round(bakedSize * target.scale))
  const image = new Image()
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(paintingSvg(painting, motifs, px))}`
  await image.decode()

  const canvas = document.createElement('canvas')
  canvas.width = target.width
  canvas.height = target.height
  const ctx = canvas.getContext('2d')!
  const fill = ctx.createPattern(image, 'repeat')!
  // One whole tile sits dead centre, so the picture looks balanced
  fill.setTransform(
    new DOMMatrix().translate(
      Math.round((target.width - image.naturalWidth) / 2),
      Math.round((target.height - image.naturalHeight) / 2),
    ),
  )
  ctx.fillStyle = fill
  ctx.fillRect(0, 0, target.width, target.height)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (blob) save(blob, `pattern-${target.id}.png`)
}

export const downloadTile = (painting: Painting, motifs: Map<string, Motif>, bakedSize: number) => {
  const svg = paintingSvg(painting, motifs, Math.round(bakedSize))
  save(new Blob([svg], { type: 'image/svg+xml' }), 'pattern-tile.svg')
}
