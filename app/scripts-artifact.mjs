// Turns dist-artifact/ into artifact/index.html (a page fragment with CSS and JS inlined)
// plus the story files next to it.
import fs from 'node:fs';
import path from 'node:path';

const dist = 'dist-artifact', out = '../artifact';
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const js = [...html.matchAll(/<script[^>]*src="\.\/([^"]+)"/g)].map(m => m[1]);
const css = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="\.\/([^"]+)"/g)].map(m => m[1]);
const others = fs.readdirSync(path.join(dist, 'assets')).filter(f => !js.includes('assets/' + f) && !css.includes('assets/' + f));
if (js.length !== 1 || others.length) throw new Error(`Expected one script and no other assets, got ${js} / ${others}`);

let style = css.map(f => fs.readFileSync(path.join(dist, f), 'utf8')).join('\n');
// Pull the Google Fonts @import out into a <link>, as the artifact host expects.
const IMPORT = /@import\s*(?:url\()?\s*["'](https:\/\/fonts\.googleapis\.com[^"']+)["']\s*\)?\s*;/g;
const fontImports = [...style.matchAll(IMPORT)].map(m => m[1]);
style = style.replace(IMPORT, '');
const script = fs.readFileSync(path.join(dist, js[0]), 'utf8').replace(/<\/script/gi, '<\\/script');

const page = `<title>Power Reader</title>
<meta name="apple-mobile-web-app-capable" content="yes">
${fontImports.map(u => `<link rel="stylesheet" href="${u}">`).join('\n')}
<style>${style}</style>
<div id="root"></div>
<script type="module">${script}</script>
`;
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), page);
for (const id of ['secret-stones', 'womens-football', 'inclusive-design', 'once-and-future-queen', 'inventions', 'windrush', 'carrot-girl', 'home-invasion']) fs.cpSync(path.join('../content', id), path.join(out, id), { recursive: true });
// A Claude artifact holds at most 511 files per version. For these stories the artifact leaves out the
// recorded single words (warm-up words then use the browser's own voice); the full site keeps them.
for (const id of ['carrot-girl', 'home-invasion']) {
  fs.rmSync(path.join(out, id, 'audio', 'words'), { recursive: true, force: true });
  const file = path.join(out, id, 'audio', 'manifest.json');
  const m = JSON.parse(fs.readFileSync(file, 'utf8'));
  m.words = {};
  fs.writeFileSync(file, JSON.stringify(m));
}
console.log('artifact/index.html', (page.length / 1024).toFixed(0) + ' KB');
