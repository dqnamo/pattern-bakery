import {
  ArrowLeft,
  ArrowsInLineHorizontal,
  ArrowsOutLineHorizontal,
  ArrowUUpLeft,
  ArrowUUpRight,
  DeviceMobile,
  DownloadSimple,
  Eraser,
  FlipHorizontal,
  Monitor,
  PaintBrush,
  Pinwheel,
  Square,
  SquaresFour,
  Trash,
  type Icon,
} from '@phosphor-icons/react'
import type { Repeat } from './painting'

/*
 * The bakery's icons come from Phosphor, at its regular weight, so they all
 * share one line and corner style. This file decides which icon means what,
 * and how big it sits next to its label.
 */

/** The one drawn here rather than taken from Phosphor: a domed loaf with three cuts across the crust, at Phosphor's line weight */
export const BakeIcon = () => (
  <svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 15a9 6 0 0 1 18 0v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M7.5 14l2-2.5M11 14l2-2.5M14.5 14l2-2.5" />
  </svg>
)
export const BackIcon = () => <ArrowLeft size={18} aria-hidden="true" />
export const ClearIcon = () => <Trash size={18} aria-hidden="true" />
export const DownloadIcon = () => <DownloadSimple size={18} aria-hidden="true" />
export const UndoIcon = () => <ArrowUUpLeft size={18} aria-hidden="true" />
export const RedoIcon = () => <ArrowUUpRight size={18} aria-hidden="true" />

export const BrushIcon = () => <PaintBrush size={16} aria-hidden="true" />
export const EraserIcon = () => <Eraser size={16} aria-hidden="true" />

export const PhoneIcon = () => <DeviceMobile size={20} aria-hidden="true" />
export const ScreenIcon = () => <Monitor size={20} aria-hidden="true" />
export const TileIcon = () => <SquaresFour size={20} aria-hidden="true" />

const REPEAT_ICONS: Record<Repeat, Icon> = {
  mirror: FlipHorizontal,
  spin: Pinwheel,
  side: SquaresFour,
}

export const RepeatIcon = ({ repeat }: { repeat: Repeat }) => {
  const Glyph = REPEAT_ICONS[repeat]
  return <Glyph size={16} aria-hidden="true" />
}

/** Small and large for the size slider, in the same slot so both sliders' tracks line up */
export const SizeIcon = ({ large }: { large?: boolean }) => (
  <span className="slider-icon">
    <Square size={large ? 20 : 12} weight="fill" aria-hidden="true" />
  </span>
)

/** Closer together and further apart for the spacing slider */
export const SpacingIcon = ({ wide }: { wide?: boolean }) => (
  <span className="slider-icon">
    {wide ? (
      <ArrowsOutLineHorizontal size={18} aria-hidden="true" />
    ) : (
      <ArrowsInLineHorizontal size={18} aria-hidden="true" />
    )}
  </span>
)
