# Pattern bakery

Paint shapes into one square, then bake it into a repeating pattern you can save as a wallpaper. Made for people who aren't designers and don't have the words for any of this.

## Decisions

- **A brush of shapes is the main tool.** Pick a few shapes and drag: the brush lays them down along your stroke, taking turns between them.
- **Repeats that are hard to get wrong.** Mirror, Pinwheel or Tiles. Whichever you pick, even a quick scribble comes out looking deliberate.
- **Limited colour palettes, with good defaults.** Twelve sets that already work together instead of a colour picker, and it starts on one that looks good straight away.
- **Spacing evens out on its own.** When you bake, the gap between repeats is trimmed to match the gaps inside your drawing, so there are no seams.
- **Shapes never overlap.** As you brush, a shape that would land on another slides a little to one side, or is left out if there's no room.

## Running it

```bash
npm install
npm run dev
```

Built with React, Vite, TypeScript, [Base UI](https://base-ui.com) and [Phosphor icons](https://phosphoricons.com).
