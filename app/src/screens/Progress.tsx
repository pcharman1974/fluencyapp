import type { Story } from '../types';
import type { Screen } from '../App';
import { getAttempts } from '../lib/storage';

interface Props { story: Story; reader: string; go: (s: Screen) => void }

const METHOD = { adult: 'Adult marked', speech: 'Speech check', demo: 'Demo' } as const;

export default function Progress({ story, reader, go }: Props) {
  const attempts = getAttempts(reader).filter(a => a.storyId === story.id);
  const best = attempts.reduce((m, a) => Math.max(m, a.wcpm), 0);
  return (
    <div className="timed">
      <button className="btn btn-ghost" onClick={() => go({ name: 'home' })}>← Back</button>
      <section className="panel">
        <h2>My progress: {story.title}</h2>
        {attempts.length === 0 ? <p>No timed reads yet.</p> : (
          <>
            <p>Best so far: <strong>{best} words correct per minute</strong></p>
            <Chart values={attempts.map(a => a.wcpm)} />
            <table className="table">
              <thead><tr><th>Date</th><th>WCPM</th><th>Accuracy</th><th>Errors</th><th>Checked by</th></tr></thead>
              <tbody>
                {[...attempts].reverse().map(a => (
                  <tr key={a.date}>
                    <td>{new Date(a.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} {new Date(a.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td><strong>{a.wcpm}</strong></td>
                    <td>{Math.round(a.accuracy * 100)}%</td>
                    <td>{a.errors}</td>
                    <td>{METHOD[a.method]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        <button className="btn btn-orange" onClick={() => go({ name: 'timed' })}>Do another timed read</button>
      </section>
    </div>
  );
}

function Chart({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const W = 600, H = 180, P = 28;
  const max = Math.max(...values) * 1.15, min = 0;
  const x = (i: number) => P + (i * (W - 2 * P)) / (values.length - 1);
  const y = (v: number) => H - P - ((v - min) / (max - min)) * (H - 2 * P);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ');
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Words correct per minute over ${values.length} reads: ${values.join(', ')}`}>
      <line x1={P} y1={H - P} x2={W - P} y2={H - P} className="axis" />
      <path d={d} className="line" />
      {values.map((v, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(v)} r={6} className="pt" />
          <text x={x(i)} y={y(v) - 12} textAnchor="middle" className="pt-label">{v}</text>
        </g>
      ))}
    </svg>
  );
}
