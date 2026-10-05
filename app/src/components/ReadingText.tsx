import { useRef, useState } from 'react';
import { normalise } from '../lib/text';

interface Props {
  text: string;
  vocab: Record<string, string>;
  highlightIndex?: number;   // word being spoken by the model voice
  focusWords?: string[];     // words to pick out (e.g. ones misread in a timed read)
  onWordTap?: (word: string, definition?: string) => void;
}

/** Story text with vocabulary words picked out and an optional reading ruler. */
export default function ReadingText({ text, vocab, highlightIndex, focusWords = [], onWordTap }: Props) {
  const words = text.split(/\s+/).filter(Boolean);
  const focus = new Set(focusWords.map(normalise));
  return (
    <p className="reading-text">
      {words.map((w, i) => {
        const n = normalise(w);
        const def = vocab[n];
        const cls = [
          def ? 'vocab' : '',
          i === highlightIndex ? 'speaking' : '',
          focus.has(n) ? 'focus' : '',
        ].filter(Boolean).join(' ');
        return (
          <span key={i}>
            {def || onWordTap
              ? <span className={'word ' + cls} role="button" tabIndex={0}
                  onClick={() => onWordTap?.(w, def)}
                  onKeyDown={e => { if (e.key === 'Enter') onWordTap?.(w, def); }}>{w}</span>
              : <span className={'word ' + cls}>{w}</span>}
            {' '}
          </span>
        );
      })}
    </p>
  );
}

/** A horizontal band that follows the finger or pointer to help keep place on a line. */
export function Ruler({ children, on }: { children: React.ReactNode; on: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [y, setY] = useState<number | null>(null);
  const move = (clientY: number) => {
    const box = ref.current?.getBoundingClientRect();
    if (box) setY(clientY - box.top);
  };
  return (
    <div ref={ref} className="ruler-area"
      onPointerMove={e => on && move(e.clientY)}
      onPointerDown={e => on && move(e.clientY)}>
      {children}
      {on && y !== null && <div className="ruler" style={{ top: y - 30 }} aria-hidden="true" />}
    </div>
  );
}
