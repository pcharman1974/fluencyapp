import { azureProvider } from './azure';
import { demoProvider } from './demo';
export const providers = [azureProvider, demoProvider];
export type { SpeechProvider, SpeechResult } from './types';
