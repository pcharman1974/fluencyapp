// Fluency gauge: a dial for words correct per minute. Markers show the reader's own
// first score and best, so progress is measured against themselves, not other pupils.

interface Props {
  value: number;
  first?: number;
  best?: number;
  max?: number;
  label?: string;
  size?: 'big' | 'small';
}

const START = 210, SWEEP = 300; // degrees, clockwise from the top: dial runs from bottom-left to bottom-right

function point(deg: number, r: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return [100 + r * Math.cos(a), 100 + r * Math.sin(a)] as const;
}
function arc(from: number, to: number, r: number) {
  const [x1, y1] = point(from, r), [x2, y2] = point(to, r);
  return `M${x1} ${y1} A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`;
}

export default function Gauge({ value, first, best, max, label = 'words a minute', size = 'big' }: Props) {
  const top = max ?? Math.max(120, Math.ceil(Math.max(value, best ?? 0, first ?? 0) * 1.25 / 20) * 20);
  const ang = (v: number) => START + (Math.min(Math.max(v, 0), top) / top) * SWEEP;
  const ticks = Array.from({ length: 7 }, (_, i) => Math.round((top / 6) * i));
  const [nx, ny] = point(ang(value), 62);
  const marker = (v: number, cls: string, text: string) => {
    const [x1, y1] = point(ang(v), 70), [x2, y2] = point(ang(v), 92), [tx, ty] = point(ang(v), 104);
    return (
      <g className={cls}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} />
        <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle">{text}</text>
      </g>
    );
  };
  return (
    <figure className={'gauge-wrap gauge-' + size}>
    <svg className="gauge" viewBox="-14 -6 228 196" role="img"
      aria-label={`${value} ${label}${best !== undefined ? `, best ${best}` : ''}${first !== undefined ? `, first ${first}` : ''}`}>
      <defs>
        <linearGradient id="gauge-grad" x1="0" x2="1">
          <stop offset="0" stopColor="var(--lwc-gold)" />
          <stop offset="1" stopColor="var(--lwc-orange)" />
        </linearGradient>
      </defs>
      <path d={arc(START, START + SWEEP, 80)} className="gauge-track" />
      <path d={arc(START, ang(value), 80)} className="gauge-fill" />
      {ticks.map(t => {
        const [x1, y1] = point(ang(t), 94), [x2, y2] = point(ang(t), 98);
        return <line key={t} x1={x1} y1={y1} x2={x2} y2={y2} className="gauge-tick" />;
      })}
      {first !== undefined && marker(first, 'gauge-first', 'Start')}
      {best !== undefined && best !== value && marker(best, 'gauge-best', 'Best')}
      <line x1="100" y1="100" x2={nx} y2={ny} className="gauge-needle" />
      <circle cx="100" cy="100" r="7" className="gauge-hub" />
      <text x="100" y="140" textAnchor="middle" className="gauge-value">{value}</text>
      <text x={point(START, 80)[0]} y={point(START, 80)[1] + 16} textAnchor="middle" className="gauge-end">0</text>
      <text x={point(START + SWEEP, 80)[0]} y={point(START + SWEEP, 80)[1] + 16} textAnchor="middle" className="gauge-end">{top}</text>
    </svg>
    <figcaption className="gauge-label">{label}</figcaption>
    </figure>
  );
}
