const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
fs.mkdirSync(path.join(root, 'dist/renderer'), { recursive: true });
fs.mkdirSync(path.join(root, 'dist/assets'), { recursive: true });
for (const name of ['index.html', 'style.css']) fs.copyFileSync(path.join(root, 'src/renderer', name), path.join(root, 'dist/renderer', name));
// Copy original bytes; alpha margins are handled only by the window layout.
const { characterConfig } = require('../dist/main/characterConfig');
fs.copyFileSync(path.join(root, 'source', characterConfig.imageFile), path.join(root, 'dist/assets', characterConfig.imageFile));
const blink = JSON.parse(fs.readFileSync(path.join(root, 'source/daic-crystal-yi-blink.json'), 'utf8'));
const sheetFile = 'daic-crystal-yi-blink.png';
const sheet = fs.readFileSync(path.join(root, 'source', sheetFile));
const sheetWidth = sheet.readUInt32BE(16), sheetHeight = sheet.readUInt32BE(20);
if (blink.frameCount !== 8 || blink.frames.length !== 8 || blink.fps !== 24 || blink.loop !== false || blink.image !== sheetFile ||
  blink.frames.some((f, i) => f.index !== i || f.width !== 512 || f.height !== 512 || f.x !== i * 512 || f.y !== 0 || f.x + f.width > sheetWidth || f.y + f.height > sheetHeight)) {
  throw new Error('Blink metadata does not match the expected 8-frame sheet');
}
fs.copyFileSync(path.join(root, 'source', sheetFile), path.join(root, 'dist/assets', sheetFile));
// Preserve source artwork/JSON. The agreed runtime cadence is 24 FPS (rounded to 42 ms/frame).
const runtimeBlink = { image: sheetFile, sheetWidth, sheetHeight, frameWidth: 512, frameHeight: 512,
  durationMs: Math.round(1000 / blink.fps), frames: blink.frames.map(({ x, y }) => ({ x, y })) };
fs.writeFileSync(path.join(root, 'dist/renderer/blink-data.js'), 'window.daicBlink = ' + JSON.stringify(runtimeBlink) + ';\n');
