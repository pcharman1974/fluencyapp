import type { Story } from '../types';
import type { Screen } from '../App';
import { getAttempts } from '../lib/storage';
import { BADGES, earnedBadges } from '../lib/rewards';
import { Badge, WeekSummary } from '../components/Rewards';
import { PowerPanel } from '../components/PowerCore';
import StoryCards from '../components/StoryCards';
import Gauge from '../components/Gauge';
import type { Reader } from '../lib/useReader';

interface Props { story: Story; base: string; readerCode: string; reader: Reader; go: (s: Screen) => void }

const METHOD = { adult: 'Adult marked', speech: 'Speech check', demo: 'Demo' } as const;

export default function Progress({ story, base, readerCode, reader, go }: Props) {
  const attempts = getAttempts(readerCode).filter(a => a.storyId === story.id);
  const best = attempts.reduce((m, a) => Math.max(m, a.wcpm), 0);
  const have = earnedBadges(reader.events);
  const recent = reader.events.filter(e => e.type === 'points').slice(-8).reverse() as { date: string; amount: number; reason: string }[];
  return (
    <div className="progress-page">
      <button className="btn btn-ghost" onClick={() => go({ name: 'home' })}>← Home</button>
      <section className="dash">
        <div className="panel dash-level power-card"><PowerPanel events={reader.events} /></div>
        <div className="panel dash-week"><WeekSummary events={reader.events} holidays={reader.holidays} /></div>
      </section>

      <section className="panel">
        <h2>Badges <span className="count">{have.size}/{BADGES.length}</span></h2>
        <div className="badges">{BADGES.map(b => <Badge key={b.id} id={b.id} earned={have.has(b.id)} />)}</div>
      </section>

      <section className="panel">
        <h2>Story cards</h2>
        <p className="hint">Read a page aloud to unlock its card.</p>
        <StoryCards story={story} base={base} events={reader.events} />
      </section>

      <section className="panel">
        <h2>Timed reads</h2>
        {attempts.length === 0 ? <p>No timed reads yet.</p> : (
          <div className="fluency">
            <Gauge value={attempts.at(-1)!.wcpm} first={attempts.length > 1 ? attempts[0].wcpm : undefined} best={best} />
            <div className="fluency-detail">
              <Chart values={attempts.map(a => a.wcpm)} />
              <table className="table">
                <thead><tr><th>Date</th><th>WCPM</th><th>Accuracy</th><th>Checked by</th></tr></thead>
                <tbody>
                  {[...attempts].reverse().slice(0, 6).map(a => (
                    <tr key={a.date}>
                      <td>{new Date(a.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
                      <td><strong>{a.wcpm}</strong></td>
                      <td>{Math.round(a.accuracy * 100)}%</td>
                      <td>{METHOD[a.method]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <button className="btn btn-orange" onClick={() => go({ name: 'timed' })}>Do a timed read</button>
      </section>

      {recent.length > 0 && (
        <section className="panel">
          <h2>Recent Power</h2>
          <ul className="ledger">{recent.map((p, i) => <li key={i}><span>{p.reason}</span><b>+{p.amount}</b></li>)}</ul>
        </section>
      )}
    </div>
  );
}

function Chart({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const W = 600, H = 180, P = 28;
  const max = Math.max(...values) * 1.15;
  const x = (i: number) => P + (i * (W - 2 * P)) / (values.length - 1);
  const y = (v: number) => H - P - (v / max) * (H - 2 * P);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ');
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Words correct per minute over ${values.length} reads: ${values.join(', ')}`}>
      <line x1={P} y1={H - P} x2={W - P} y2={H - P} className="axis" />
      <path d={`${d} L${x(values.length - 1)},${H - P} L${x(0)},${H - P} Z`} className="area" />
      <path d={d} className="line" />
      {values.map((v, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(v)} r={i === values.length - 1 ? 7 : 5} className="pt" />
          <text x={x(i)} y={y(v) - 12} textAnchor="middle" className="pt-label">{v}</text>
        </g>
      ))}
    </svg>
  );
}
