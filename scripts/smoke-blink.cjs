const { _electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const executable = process.argv[2] ? path.resolve(process.argv[2]) : null;
const suffix = executable ? '-packaged' : '';
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
const out = path.join(root, '.local'); fs.mkdirSync(out, { recursive: true });
const settings = path.join(process.env.APPDATA, 'DAIC/settings.json');
const original = fs.existsSync(settings) ? fs.readFileSync(settings) : null;
let app;
(async () => {
  const result = {};
  try {
    app = await _electron.launch({ ...(executable ? { executablePath: executable, args: [] } : { args: [root] }), cwd: root, env });
    const page = await app.firstWindow();
    await page.waitForFunction(() => document.getElementById('blink-sheet').naturalWidth === 4096);
    await page.waitForFunction(() => document.body.dataset.visible === 'true');
    const before = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds());
    await page.evaluate(() => {
      window.__blinkLog = [];
      new MutationObserver(() => window.__blinkLog.push({ time: performance.now(), state: document.body.dataset.animation, frame: document.body.dataset.frame }))
        .observe(document.body, { attributes: true, attributeFilter: ['data-animation', 'data-frame'] });
    });
    await page.waitForFunction(() => document.body.dataset.frame === '3', null, { timeout: 12000 });
    await page.screenshot({ path: path.join(out, 'daic-blink' + suffix + '.png'), omitBackground: true });
    await page.waitForFunction(() => window.__blinkLog.filter(e => e.state === 'idle').length >= 2, null, { timeout: 18000 });
    const log = await page.evaluate(() => window.__blinkLog);
    const starts = log.filter(e => e.frame === '0');
    const ends = log.filter(e => e.state === 'idle');
    assert.ok(starts.length >= 2);
    assert.ok(starts[0].time >= 3900 && starts[0].time <= 8500, 'First random pause is 4–8 seconds');
    const pause = starts[1].time - ends[0].time;
    assert.ok(pause >= 3900 && pause <= 8500, 'Next pause is 4–8 seconds after previous blink');
    for (const start of starts.slice(0, 2)) {
      const end = ends.find(e => e.time > start.time);
      assert.ok(end.time - start.time >= 300 && end.time - start.time < 900);
      const frames = log.filter(e => e.time >= start.time && e.time < end.time).map(e => Number(e.frame));
      assert.deepEqual(frames, [0,1,2,3,4,5,6,7]);
    }
    assert.deepEqual(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds()), before);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].hide());
    await page.waitForFunction(() => document.body.dataset.visible === 'false' && document.body.dataset.animation === 'idle', null, { polling: 100, timeout: 5000 });
    const hiddenCount = await page.evaluate(() => window.__blinkLog.length);
    await page.waitForTimeout(8500);
    assert.equal(await page.evaluate(() => window.__blinkLog.length), hiddenCount, 'Hidden character has no blinking timer activity');
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].showInactive());
    await page.waitForTimeout(1000);
    assert.equal(await page.evaluate(() => document.body.dataset.animation), 'idle', 'Show waits before blinking');
    result.passed = true; result.firstDelayMs = starts[0].time; result.nextPauseMs = pause; result.log = log; result.bounds = before;
    console.log(JSON.stringify(result, null, 2));
  } catch (error) { result.passed = false; result.error = error.stack; console.error(error); process.exitCode = 1; }
  finally {
    if (app) await app.close();
    if (original) fs.writeFileSync(settings, original); else if (fs.existsSync(settings)) fs.unlinkSync(settings);
    fs.writeFileSync(path.join(out, 'blink-results' + suffix + '.json'), JSON.stringify(result, null, 2));
  }
})();
