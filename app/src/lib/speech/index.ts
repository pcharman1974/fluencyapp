import { azureProvider } from './azure';
import { demoProvider } from './demo';
import type { SpeechProvider } from './types';

export const providers = [azureProvider, demoProvider];
export type { SpeechProvider, SpeechResult } from './types';

/** The real speech service when the server has one set up, otherwise demo data. */
export async function pickProvider(): Promise<SpeechProvider> {
  return (await azureProvider.available()) ? azureProvider : demoProvider;
}
