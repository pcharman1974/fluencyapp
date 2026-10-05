import type { HeardWord } from '../scoring';

/** What any speech service has to give back for a timed read. */
export interface SpeechResult {
  words: HeardWord[];
  /** Extra scores the service reports (0-100), shown to the adult as a guide only. */
  scores?: { fluency?: number; prosody?: number; pronunciation?: number };
  provider: string;
}

export interface SpeechSession {
  /** Stop listening and return everything heard so far. */
  stop(): Promise<SpeechResult>;
}

export interface SpeechProvider {
  id: string;
  label: string;
  available(): Promise<boolean>;
  /** Start listening to the microphone. referenceText is the passage being read. */
  start(referenceText: string, onWord?: (count: number) => void): Promise<SpeechSession>;
}
