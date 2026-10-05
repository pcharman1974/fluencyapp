// Microsoft Azure AI Speech, pronunciation assessment against the passage text.
// The browser never sees the subscription key: it asks our server for a short-lived token.

import type { SpeechProvider, SpeechResult } from './types';
import type { HeardWord } from '../scoring';

const LANG = 'en-GB';

async function getToken(): Promise<{ token: string; region: string }> {
  const r = await fetch('/api/speech-token');
  if (!r.ok) throw new Error('Speech service is not set up on the server');
  return r.json();
}

interface AzureWord {
  Word: string;
  Offset: number;   // 100-nanosecond ticks from start of audio
  Duration: number;
  PronunciationAssessment?: { AccuracyScore?: number; ErrorType?: string };
}

export const azureProvider: SpeechProvider = {
  id: 'azure',
  label: 'Speech check (Azure)',

  async available() {
    try {
      const r = await fetch('/api/speech-status');
      return r.ok && (await r.json()).configured === true;
    } catch { return false; }
  },

  async start(referenceText, onWord, _opts) {
    // Loaded on demand: the SDK is large and most sessions won't use it.
    const sdk = await import('microsoft-cognitiveservices-speech-sdk');
    const { token, region } = await getToken();
    const speechConfig = sdk.SpeechConfig.fromAuthorizationToken(token, region);
    speechConfig.speechRecognitionLanguage = LANG;
    const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
    const recogniser = new sdk.SpeechRecognizer(speechConfig, audioConfig);

    const pa = new sdk.PronunciationAssessmentConfig(
      referenceText,
      sdk.PronunciationAssessmentGradingSystem.HundredMark,
      sdk.PronunciationAssessmentGranularity.Word,
      false, // miscue detection: we align against the passage ourselves (see scoring.ts)
    );
    try { pa.enableProsodyAssessment = true; } catch { /* not supported for every language */ }
    pa.applyTo(recogniser);

    const words: HeardWord[] = [];
    const startedAt = Date.now();
    const segScores: { fluency?: number; prosody?: number; pronunciation?: number }[] = [];

    recogniser.recognized = (_s, e) => {
      if (e.result.reason !== sdk.ResultReason.RecognizedSpeech) return;
      const json = JSON.parse(e.result.properties.getProperty(sdk.PropertyId.SpeechServiceResponse_JsonResult));
      const best = json.NBest?.[0];
      if (!best) return;
      for (const w of (best.Words ?? []) as AzureWord[]) {
        if (w.PronunciationAssessment?.ErrorType === 'Insertion') continue;
        words.push({ text: w.Word, startSec: w.Offset / 1e7, accuracyScore: w.PronunciationAssessment?.AccuracyScore });
      }
      const p = best.PronunciationAssessment ?? {};
      segScores.push({ fluency: p.FluencyScore, prosody: p.ProsodyScore, pronunciation: p.PronScore ?? p.AccuracyScore });
      onWord?.(words.length);
    };

    await new Promise<void>((res, rej) => recogniser.startContinuousRecognitionAsync(res, rej));

    return {
      stop: () => new Promise<SpeechResult>((res) => {
        // Give the service a moment to return the last phrase.
        setTimeout(() => recogniser.stopContinuousRecognitionAsync(() => {
          recogniser.close();
          const avg = (k: 'fluency' | 'prosody' | 'pronunciation') => {
            const v = segScores.map(s => s[k]).filter((x): x is number => typeof x === 'number');
            return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : undefined;
          };
          res({ words, durationSec: (Date.now() - startedAt) / 1000 - 1.2, provider: 'Azure AI Speech (en-GB)', scores: { fluency: avg('fluency'), prosody: avg('prosody'), pronunciation: avg('pronunciation') } });
        }, () => res({ words, provider: 'Azure AI Speech (en-GB)' })), 1200);
      }),
    };
  },
};
