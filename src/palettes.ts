export interface Palette {
  id: string
  name: string
  background: string
  inks: string[]
}

/**
 * No colour picker. Someone without a designer's eye can't predict which
 * pair of colours will vibrate or sink into mud, so they pick from sets that
 * already work, and see each one applied to their own pattern before choosing.
 *
 * Rows go from calm to playful: one colour, two colours, three colours.
 */
export const PALETTES: Palette[] = [
  { id: 'ink', name: 'Ink', background: '#F3EFE7', inks: ['#24272F'] },
  { id: 'navy', name: 'Navy', background: '#1F2D4E', inks: ['#F1E5CC'] },
  { id: 'tomato', name: 'Tomato', background: '#F7E7D7', inks: ['#DE4F38'] },
  { id: 'sage', name: 'Sage', background: '#DCE5D3', inks: ['#3D6A4C'] },

  { id: 'blush', name: 'Blush', background: '#F9DEDA', inks: ['#C7365A', '#EE8A3C'] },
  { id: 'forest', name: 'Forest', background: '#1F3B30', inks: ['#EEE3C8', '#E2A53D'] },
  { id: 'lilac', name: 'Lilac', background: '#E6E0F6', inks: ['#5A3FD0', '#F08A5D'] },
  { id: 'butter', name: 'Butter', background: '#FFD966', inks: ['#2B2622', '#E5543D'] },

  {
    id: 'seaside',
    name: 'Seaside',
    background: '#17476E',
    inks: ['#F6C453', '#F4EEE3', '#74C6D8'],
  },
  {
    id: 'confetti',
    name: 'Confetti',
    background: '#FFF5E8',
    inks: ['#FF5A5F', '#21B3A4', '#FFB400'],
  },
  {
    id: 'terracotta',
    name: 'Terracotta',
    background: '#F0E2D1',
    inks: ['#C3573A', '#2F4D3C', '#E5A84B'],
  },
  { id: 'night', name: 'Night', background: '#16171D', inks: ['#FF6B6B', '#FFD166', '#7BDFF2'] },
]

export const paletteById = (id: string) =>
  PALETTES.find((palette) => palette.id === id) ?? PALETTES[0]
