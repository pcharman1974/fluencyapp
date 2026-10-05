// Small server for Beyond the Code.
//  - Serves the built app (dist/)
//  - Swaps the Azure Speech key for a 10-minute token, so the key never reaches a pupil's device
//
// Set in .env (see .env.example): AZURE_SPEECH_KEY, AZURE_SPEECH_REGION

import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const app = express();
const dir = path.dirname(fileURLToPath(import.meta.url));
const { AZURE_SPEECH_KEY, AZURE_SPEECH_REGION, PORT = 8787 } = process.env;

app.get('/api/speech-status', (_req, res) => {
  res.json({ configured: Boolean(AZURE_SPEECH_KEY && AZURE_SPEECH_REGION) });
});

app.get('/api/speech-token', async (_req, res) => {
  if (!AZURE_SPEECH_KEY || !AZURE_SPEECH_REGION) return res.status(503).json({ error: 'Speech service not configured' });
  try {
    const r = await fetch(`https://${AZURE_SPEECH_REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
      method: 'POST',
      headers: { 'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY },
    });
    if (!r.ok) return res.status(502).json({ error: `Token request failed (${r.status})` });
    res.json({ token: await r.text(), region: AZURE_SPEECH_REGION });
  } catch (e) {
    res.status(502).json({ error: 'Could not reach speech service' });
  }
});

app.use(express.static(path.join(dir, '..', 'dist')));
app.listen(PORT, () => {
  const lan = Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);
  console.log(`\nPower Reader is running.\n  On this computer:  http://localhost:${PORT}`);
  for (const ip of lan) console.log(`  On an iPad (same Wi-Fi):  http://${ip}:${PORT}`);
  console.log(`  Speech check: ${AZURE_SPEECH_KEY ? 'on' : 'off (no Azure key in .env)'}\n  Press Ctrl+C to stop.\n`);
});
