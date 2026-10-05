import type { HeardWord } from '../scoring';

/** What any speech service has to give back. */
export interface SpeechResult {
  words: HeardWord[];
  /** Length of the reading in seconds, if the service knows it better than the app's clock. */
  durationSec?: number;
  /** Extra scores the service reports (0-100), shown to the adult as a guide only. */
  scores?: { fluency?: number; prosody?: number; pronunciation?: number };
  provider: string;
}

export interface SpeechSession {
  /** Stop listening and return everything heard so far. */
  stop(): Promise<SpeechResult>;
}

export interface StartOptions {
  /** 'timed': a one-minute read that stops part way; 'page': one page or word, read to the end. */
  kind?: 'timed' | 'page';
}

export interface SpeechProvider {
  id: string;
  label: string;
  /** True for made-up data: the app labels results as demo. */
  demo?: boolean;
  available(): Promise<boolean>;
  /** Start listening to the microphone. referenceText is what is being read. */
  start(referenceText: string, onWord?: (count: number) => void, opts?: StartOptions): Promise<SpeechSession>;
}
