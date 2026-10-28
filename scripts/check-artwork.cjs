const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const dir = path.join(__dirname, '..', 'source');
const read = name => fs.readFileSync(path.join(dir, name));
function pngSize(name) {
  const data = read(name);
  if (data.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Invalid PNG: ' + name);
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}
const metadata = JSON.parse(read('daic-crystal-yi-blink.json'));
const sheet = pngSize('daic-crystal-yi-blink.png');
const issues = [];
if (metadata.frameCount !== 8 || metadata.frames.length !== 8) issues.push('Expected 8 frames');
if (metadata.fps !== 24) issues.push('Expected fps=24');
if (metadata.loop !== false) issues.push('Expected loop=false');
for (const [i, frame] of metadata.frames.entries()) {
  if (frame.index !== i) issues.push(`Frame ${i}: unexpected index`);
  if (frame.durationMs !== 42) issues.push(`Frame ${i}: durationMs=${frame.durationMs}, expected 42`);
  if (![frame.x, frame.y, frame.width, frame.height].every(Number.isInteger) || frame.x < 0 || frame.y < 0 || frame.width <= 0 || frame.height <= 0 || frame.x + frame.width > sheet.width || frame.y + frame.height > sheet.height) issues.push(`Frame ${i}: outside PNG bounds`);
  if (frame.width !== metadata.frameWidth || frame.height !== metadata.frameHeight) issues.push(`Frame ${i}: inconsistent frame dimensions`);
  if (frame.x !== i * 512 || frame.y !== 0 || frame.width !== 512 || frame.height !== 512) issues.push(`Frame ${i}: expected horizontal 512px grid`);
}
const hashes = Object.fromEntries(['daic-crystal-yi-neutral-refined.png','daic-crystal-yi-blink.png','daic-crystal-yi-blink.json'].map(name => [name, crypto.createHash('sha256').update(read(name)).digest('hex')]));
console.log(JSON.stringify({ neutral: pngSize('daic-crystal-yi-neutral-refined.png'), sheet, frameCount: metadata.frameCount, fps: metadata.fps, loop: metadata.loop, durations: metadata.frames.map(f => f.durationMs), issues, hashes }, null, 2));
if (issues.length) process.exitCode = 1;
