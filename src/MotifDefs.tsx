import { motifDef, type Motif } from './motifs'

/** One shared set of motif definitions that every shape on the page points at */
export const MotifDefs = ({ motifs }: { motifs: Motif[] }) => (
  <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
    <defs dangerouslySetInnerHTML={{ __html: motifs.map(motifDef).join('') }} />
  </svg>
)

export const MotifIcon = ({ motif }: { motif: Motif }) => (
  <svg viewBox="-0.5 -0.5 1 1" width="22" height="22" aria-hidden="true">
    <use href={`#${motif.ref}`} />
  </svg>
)
