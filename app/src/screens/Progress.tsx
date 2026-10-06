import type { Story } from '../types';
import type { Screen } from '../App';
import { getAttempts } from '../lib/storage';
import { BADGES, earnedBadges } from '../lib/rewards';
import { Badge, WeekSummary } from '../components/Rewards';
import { PowerPanel } from '../components/PowerCore';
import StoryCards from '../components/StoryCards';
import Gauge from '../components/Gauge';
import { FluencyChart, PowerChart } from '../components/ProgressCharts';
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

      <section className="progress-charts">
        <div className="panel">
          <h2>Your reading speed</h2>
          <FluencyChart events={reader.events} audience="pupil" />
        </div>
        <div className="panel">
          <h2>Your Power</h2>
          <PowerChart events={reader.events} audience="pupil" />
        </div>
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
