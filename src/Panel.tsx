import { Toggle } from '@base-ui/react/toggle'
import { ToggleGroup } from '@base-ui/react/toggle-group'
import { useDeferredValue, useMemo, useState, type ReactNode } from 'react'
import type { Motif } from './motifs'
import { PALETTES, type Palette } from './palettes'
import { MotifIcon } from './MotifDefs'
import { downloadPicture, downloadTile, TARGETS } from './download'
import {
  BackIcon,
  BakeIcon,
  BrushIcon,
  ClearIcon,
  DownloadIcon,
  EraserIcon,
  PhoneIcon,
  RedoIcon,
  RepeatIcon,
  ScreenIcon,
  SizeIcon,
  SpacingIcon,
  TileIcon,
  UndoIcon,
} from './icons'
import {
  bakedSizeFor,
  paletteFor,
  REPEAT_LABELS,
  REPEAT_NOTES,
  REPEATS,
  strokeAlong,
  tileMarkup,
  type Brush,
  type Painting,
  type Tool,
} from './painting'

interface PanelProps {
  painting: Painting
  motifs: Motif[]
  motifMap: Map<string, Motif>
  brush: Brush
  setBrush: (change: (brush: Brush) => Brush) => void
  update: (change: (painting: Painting) => Painting, key?: string) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  baked: boolean
  setBaked: (baked: boolean) => void
  bakedSize: number
  setBakedSize: (size: number) => void
}

const Section = ({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) => (
  <section className="section">
    <h2 className="section-label">
      {label}
      {hint && <span className="section-hint">{hint}</span>}
    </h2>
    {children}
  </section>
)

const Slider = ({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min: ReactNode
  max: ReactNode
}) => (
  <div className="slider">
    {min}
    <input
      type="range"
      min={0}
      max={1}
      step={0.001}
      value={value}
      aria-label={label}
      onChange={(event) => onChange(Number(event.target.value))}
    />
    {max}
  </div>
)

/**
 * A segmented control, built on Base UI's toggle group: one option is always
 * picked, and the arrow keys move between options.
 */
const Segmented = <T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string; icon?: ReactNode }[]
  onChange: (value: T) => void
}) => (
  <ToggleGroup
    className="segmented"
    aria-label={label}
    value={[value]}
    onValueChange={(picked) => {
      // Pressing the picked option again would leave nothing picked, so it stays as it is
      if (picked.length > 0) onChange(picked[0])
    }}
  >
    {options.map((option) => (
      <Toggle key={option.value} value={option.value}>
        {option.icon}
        <span className="segmented-label" data-label={option.label}>
          {option.label}
        </span>
      </Toggle>
    ))}
  </ToggleGroup>
)

/** Preview strips are a fixed bit of tile, so a big brush honestly looks big */
const STRIP_WIDTH = 0.9
const STRIP_HEIGHT = 0.26

/**
 * One gentle S-curve stroked with the current brush. It answers "what will
 * my brush do?" before you touch the canvas, and updates as you drag a slider.
 */
const BrushPreview = ({
  brush,
  palette,
  motifs,
}: {
  brush: Brush
  palette: Palette
  motifs: Map<string, Motif>
}) => {
  const markup = useMemo(() => {
    const margin = 0.08
    const points = Array.from({ length: 121 }, (_, k): [number, number] => {
      const t = k / 120
      return [
        margin + t * (STRIP_WIDTH - margin * 2),
        STRIP_HEIGHT / 2 + Math.sin(t * Math.PI * 2) * STRIP_HEIGHT * 0.22,
      ]
    })
    return tileMarkup(strokeAlong(brush, points, 'side'), palette, motifs, 'side')
  }, [brush, palette, motifs])

  return (
    <svg
      className="brush-preview"
      viewBox={`0 0 ${STRIP_WIDTH} ${STRIP_HEIGHT}`}
      style={{ backgroundColor: palette.background }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  )
}

/**
 * A palette as its colours, side by side: the background first, since it
 * covers the most, then each ink laid over it. The big canvas already shows
 * the chosen palette on your pattern, so the picker only has to be quick to scan.
 */
const PaletteDots = ({ palette }: { palette: Palette }) => (
  <span className="palette-dots" aria-hidden="true">
    {[palette.background, ...palette.inks].map((colour, k) => (
      <span key={k} className="palette-dot" style={{ backgroundColor: colour }} />
    ))}
  </span>
)

const TOOLS: { value: Tool; label: string; icon: ReactNode }[] = [
  { value: 'brush', label: 'Brush', icon: <BrushIcon /> },
  { value: 'eraser', label: 'Eraser', icon: <EraserIcon /> },
]

export const Panel = ({
  painting,
  motifs,
  motifMap,
  brush,
  setBrush,
  update,
  undo,
  redo,
  canUndo,
  canRedo,
  baked,
  setBaked,
  bakedSize,
  setBakedSize,
}: PanelProps) => {
  const [downloadOpen, setDownloadOpen] = useState(false)
  const palette = paletteFor(painting)
  // The brush preview redraws a whole stroke per slider tick; it can trail the slider by a frame
  const previewBrush = useDeferredValue(brush)

  const toggleShape = (id: string) =>
    setBrush((b) => {
      if (b.shapes.includes(id)) {
        // Always keep one shape, or the brush would paint nothing
        return b.shapes.length === 1 ? b : { ...b, shapes: b.shapes.filter((s) => s !== id) }
      }
      // Picking a shape means you want to paint with it
      return { ...b, shapes: [...b.shapes, id], tool: 'brush' }
    })

  const pickButton = (motif: Motif) => (
    <button
      key={motif.id}
      className="shape-button"
      aria-pressed={brush.shapes.includes(motif.id)}
      aria-label={motif.name}
      title={motif.name}
      onClick={() => toggleShape(motif.id)}
    >
      <MotifIcon motif={motif} />
    </button>
  )

  const history = (
    <div className="history">
      <button
        className="icon-button"
        onClick={undo}
        disabled={!canUndo}
        aria-label="Undo"
        title="Undo"
      >
        <UndoIcon />
      </button>
      <button
        className="icon-button"
        onClick={redo}
        disabled={!canRedo}
        aria-label="Redo"
        title="Redo"
      >
        <RedoIcon />
      </button>
    </div>
  )

  const palettes = (
    <Section label="Palette">
      <div className="palette-grid">
        {PALETTES.map((option) => (
          <button
            key={option.id}
            className="palette"
            aria-pressed={painting.palette === option.id}
            aria-label={option.name}
            title={option.name}
            onClick={() => update((p) => ({ ...p, palette: option.id }))}
          >
            <PaletteDots palette={option} />
          </button>
        ))}
      </div>
    </Section>
  )

  // A name you already know, a tiny picture, and one sentence; the canvas shows the rest live
  const repeats = (
    <Section label="Repeat">
      <Segmented
        label="Repeat"
        value={painting.repeat}
        options={REPEATS.map((repeat) => ({
          value: repeat,
          label: REPEAT_LABELS[repeat],
          icon: <RepeatIcon repeat={repeat} />,
        }))}
        onChange={(repeat) => update((p) => ({ ...p, repeat }))}
      />
      <p className="section-note">{REPEAT_NOTES[painting.repeat]}</p>
    </Section>
  )

  if (baked) {
    return (
      <aside className="panel" aria-label="Pattern controls">
        <header className="panel-header">
          <h1 className="title">Your pattern</h1>
          {history}
        </header>

        <div className="actions">
          <button className="button" onClick={() => setBaked(false)}>
            <BackIcon />
            Keep painting
          </button>
          <button
            className="button primary"
            aria-expanded={downloadOpen}
            onClick={() => setDownloadOpen((open) => !open)}
          >
            <DownloadIcon />
            Download
          </button>
        </div>

        {downloadOpen && (
          <div className="download-list">
            {TARGETS.map((target) => (
              <button
                key={target.id}
                className="download-option"
                onClick={() => downloadPicture(painting, motifMap, bakedSizeFor(bakedSize), target)}
              >
                {target.id === 'phone' ? <PhoneIcon /> : <ScreenIcon />}
                <span>
                  <strong>{target.label}</strong>
                  <small>{target.detail}</small>
                </span>
              </button>
            ))}
            <button
              className="download-option"
              onClick={() => downloadTile(painting, motifMap, bakedSizeFor(bakedSize))}
            >
              <TileIcon />
              <span>
                <strong>Repeating tile</strong>
                <small>For printing or other apps</small>
              </span>
            </button>
          </div>
        )}

        <Section label="Size">
          <Slider
            label="Size of the repeat"
            value={bakedSize}
            onChange={setBakedSize}
            min={<SizeIcon />}
            max={<SizeIcon large />}
          />
        </Section>

        {repeats}
        {palettes}
      </aside>
    )
  }

  return (
    <aside className="panel" aria-label="Painting controls">
      <header className="panel-header">
        <h1 className="title">Pattern bakery</h1>
        {history}
      </header>

      <div className="actions">
        <button
          className="button"
          disabled={painting.stamps.length === 0}
          onClick={() => update((p) => ({ ...p, stamps: [] }))}
        >
          <ClearIcon />
          Start over
        </button>
        <button
          className="button primary"
          disabled={painting.stamps.length === 0}
          onClick={() => {
            setDownloadOpen(false)
            setBaked(true)
          }}
        >
          <BakeIcon />
          Bake
        </button>
      </div>

      <Segmented
        label="Tool"
        value={brush.tool}
        options={TOOLS}
        onChange={(tool) => setBrush((b) => ({ ...b, tool }))}
      />

      {/* What you paint with and how it goes down, together, with the preview between them */}
      <Section label="Brush" hint="Pick as many as you like">
        <div className="shape-grid">{motifs.map(pickButton)}</div>
        <BrushPreview brush={previewBrush} palette={palette} motifs={motifMap} />
        <Slider
          label="Shape size"
          value={brush.size}
          onChange={(size) => setBrush((b) => ({ ...b, size }))}
          min={<SizeIcon />}
          max={<SizeIcon large />}
        />
        <Slider
          label="Spacing"
          value={brush.spacing}
          onChange={(spacing) => setBrush((b) => ({ ...b, spacing }))}
          min={<SpacingIcon />}
          max={<SpacingIcon wide />}
        />
      </Section>

      {repeats}
      {palettes}
    </aside>
  )
}
