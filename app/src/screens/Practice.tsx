import { useState } from 'react';
import type { Story } from '../types';
import type { Screen } from '../App';
import PageView from '../components/PageView';
import ReadAloud from '../components/ReadAloud';
import type { SpeechProvider } from '../lib/speech';
import type { Reader, RecordResult } from '../lib/useReader';
import type { Award } from '../lib/rewards';
import type { PageCheck } from '../lib/verify';

interface Props {
  story: Story; base: string; startPage?: number; focusWords?: string[];
  reader: Reader; hasReader: boolean; provider: SpeechProvider | null;
  go: (s: Screen) => void; onAward: (a: RecordResult) => void;
}

/** Free practice: any page, any order. Reading a page aloud earns points once it is checked. */
export default function Practice({ story, base, startPage = 1, focusWords, reader, hasReader, provider, go, onAward }: Props) {
  const [pageNo, setPageNo] = useState(startPage);
  const [recording, setRecording] = useState(false);
  const [check, setCheck] = useState<PageCheck | null>(null);
  const page = story.pages[pageNo - 1];
  const last = pageNo === story.pages.length;

  const turn = (to: number) => { setCheck(null); setPageNo(to); };
  const onResult = (c: PageCheck) => {
    setCheck(c);
    if (!hasReader) return;
    onAward(reader.record({ type: 'page', storyId: story.id, page: pageNo, verified: c.verified, coverage: c.coverage,
      accuracy: c.accuracy, words: c.words, durationSec: c.durationSec, misread: c.misread }, { storyPages: story.pages.length }));
  };

  return (
    <PageView story={story} base={base} pageNo={pageNo} focusWords={focusWords} recording={recording}
      onClose={() => go({ name: 'home' })}
      banner={<CheckBanner check={check} demo={provider?.demo} hasReader={hasReader} />}
      footer={<>
        <button className="btn btn-ghost" disabled={pageNo === 1 || recording} onClick={() => turn(pageNo - 1)}>← Last</button>
        <div className="nav-mid">
          <ReadAloud key={pageNo + ':' + (check ? 'r' : '')} text={page.text} provider={provider} onRecording={setRecording} onResult={onResult}
            label={check && !check.verified ? 'Try again' : 'Read aloud'} />
          <span className="page-count">{pageNo}/{story.pages.length}</span>
        </div>
        {last
          ? <button className="btn btn-navy" disabled={recording} onClick={() => go({ name: 'timed' })}>Timed read →</button>
          : <button className="btn btn-navy" disabled={recording} onClick={() => turn(pageNo + 1)}>Next →</button>}
      </>} />
  );
}

export function CheckBanner({ check, demo, hasReader = true }: { check: PageCheck | null; demo?: boolean; hasReader?: boolean }) {
  if (!check) return demo ? <div className="banner demo">Demo speech: no microphone is used and results are made up.</div> : null;
  return (
    <div className={'banner ' + (check.verified ? 'ok' : 'retry')} role="status">
      <strong>{check.verified ? '✓ ' : ''}{check.message}</strong>
      {check.verified && <span> {Math.round(check.accuracy * 100)}% of words read correctly{check.misread.length ? `. Tricky: ${check.misread.slice(0, 4).join(', ')}` : ''}.</span>}
      {!hasReader && <span> Save a reader code on the home screen to collect points.</span>}
    </div>
  );
}
