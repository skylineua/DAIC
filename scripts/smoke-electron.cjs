// Runs the actual desktop app. It does not simulate a native mouse drag or a tray right-click.
const { _electron, chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const packagedExe = process.argv[2] ? path.resolve(process.argv[2]) : null;
const variant = packagedExe ? '-packaged' : '';
const evidenceDir = path.join(root, '.local');
fs.mkdirSync(evidenceDir, { recursive: true });
const settingsFile = path.join(process.env.APPDATA, 'DAIC', 'settings.json');
const original = fs.existsSync(settingsFile) ? fs.readFileSync(settingsFile) : null;
const output = { checks: [], manual: ['Native mouse drag and pointer continuity', 'Actual tray popup interaction', 'Overlay above VS Code', 'Mixed-DPI and physical monitor removal'] };
let desktop, browser;
const check = (name, detail) => { output.checks.push({ name, detail }); console.log('PASS', name, JSON.stringify(detail ?? '')); };
async function launch() {
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  desktop = await _electron.launch({ ...(packagedExe ? { executablePath: packagedExe, args: [] } : { args: [root] }), cwd: root, env, timeout: 30000 });
  const page = await desktop.firstWindow();
  await page.waitForFunction(() => document.querySelector('img')?.naturalWidth === 512);
  await page.waitForTimeout(400);
  return page;
}
async function snapshot() {
  return desktop.evaluate(({ BrowserWindow, screen }) => {
    const w = BrowserWindow.getAllWindows()[0];
    return { bounds: w.getBounds(), visible: w.isVisible(), focused: w.isFocused(), topmost: w.isAlwaysOnTop(), focusable: w.isFocusable(), resizable: w.isResizable(), workArea: screen.getPrimaryDisplay().workArea, windowCount: BrowserWindow.getAllWindows().length };
  });
}
async function captureTray() {
  await desktop.evaluate(({ Menu, BrowserWindow }) => {
    const originalBuild = Menu.buildFromTemplate.bind(Menu);
    Menu.buildFromTemplate = function (template) { const menu = originalBuild(template); globalThis.__daicSmokeMenu = menu; return menu; };
    BrowserWindow.getAllWindows()[0].hide();
  });
}
async function trayAction(label) {
  await desktop.evaluate((_electron, label) => {
    const item = globalThis.__daicSmokeMenu.items.find(item => item.label === label);
    if (!item) throw new Error('Missing tray item: ' + label);
    item.click();
  }, label);
}
(async () => {
  try {
    // A separate, disposable browser window checks whether launch/show steals keyboard focus.
    try {
      browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--start-maximized'] });
      const page = await browser.newPage();
      await page.setContent('<html><body style="background:#eee"><label>DAIC focus check <input id="focus"></label></body></html>');
      await page.locator('#focus').click();
      output.browserFocusBefore = await page.evaluate(() => document.hasFocus());
    } catch (error) { output.browserUnavailable = error.message; }
    let page = await launch();
    let state = await snapshot();
    assert.equal(state.visible, true); assert.equal(state.windowCount, 1); assert.equal(state.focused, false); assert.equal(state.topmost, true); assert.equal(state.focusable, false);
    check('Real Electron starts visible, topmost, unfocused, single window', state);
    const rendered = await page.evaluate(() => {
      const img = document.querySelector('img');
      return { naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight, rect: img.getBoundingClientRect().toJSON(), background: getComputedStyle(document.body).backgroundColor, node: typeof window.require, drag: getComputedStyle(document.body).getPropertyValue('-webkit-app-region') };
    });
    assert.equal(rendered.background, 'rgba(0, 0, 0, 0)'); assert.equal(rendered.node, 'undefined'); assert.equal(rendered.drag, 'drag');
    assert.ok(Math.abs(rendered.rect.height * 380 / 512 - 128) < 0.1);
    check('Original PNG, alpha-aware 128 DIP layout, transparent DOM, isolated renderer', rendered);
    await page.screenshot({ path: path.join(evidenceDir, 'daic-window' + variant + '.png'), omitBackground: true });
    if (browser) {
      const p = browser.contexts()[0].pages()[0];
      const focus = await p.evaluate(() => document.hasFocus());
      assert.equal(focus, output.browserFocusBefore);
      check('Launch preserves focus of real Chrome window', focus);
      const focused = await desktop.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.hide(); w.showInactive(); return w.isFocused(); });
      assert.equal(focused, false);
    }
    await desktop.evaluate(({ BrowserWindow, screen }) => {
      const a = screen.getPrimaryDisplay().workArea;
      BrowserWindow.getAllWindows()[0].setPosition(a.x + 100, a.y + 120);
    });
    await page.waitForTimeout(450);
    const moved = (await snapshot()).bounds;
    const saved = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    assert.deepEqual(saved.position, { x: moved.x, y: moved.y });
    check('OS window move event persists position (not a native drag test)', saved);
    await desktop.close(); desktop = null;
    page = await launch();
    state = await snapshot(); assert.equal(state.bounds.x, moved.x); assert.equal(state.bounds.y, moved.y);
    check('Position restored after complete process restart', state.bounds);
    await captureTray();
    assert.equal((await snapshot()).visible, false);
    await trayAction('Показати Ї'); assert.equal((await snapshot()).visible, true);
    await trayAction('Приховати Ї'); assert.equal((await snapshot()).visible, false);
    check('Actual tray callbacks hide/show and refresh menu labels');
    // Second app process uses the normal entry path and exits after notifying the first.
    const secondEnv = { ...process.env }; delete secondEnv.ELECTRON_RUN_AS_NODE;
    const second = spawn(packagedExe || require('electron'), packagedExe ? [] : [root], { cwd: root, windowsHide: true, stdio: 'ignore', env: secondEnv });
    const secondExit = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Second launch did not exit')), 15000);
      second.once('error', reject); second.once('exit', code => { clearTimeout(timer); resolve(code); });
    });
    await page.waitForTimeout(300);
    state = await snapshot(); assert.equal(state.visible, true); assert.equal(state.windowCount, 1); assert.equal(secondExit, 0);
    check('Second process exits and existing hidden character is shown', state);
    await trayAction('Приховати Ї');
    await trayAction('Повернути на основний екран');
    state = await snapshot(); assert.equal(state.visible, true);
    assert.equal(state.bounds.x, Math.max(state.workArea.x, state.workArea.x + state.workArea.width - state.bounds.width - 24));
    check('Tray return-to-primary restores position and visibility', state.bounds);
    const pid = desktop.process().pid;
    const appPids = await desktop.evaluate(({ app }) => app.getAppMetrics().map(metric => metric.pid));
    const closed = desktop.waitForEvent('close');
    await trayAction('Вийти').catch(error => { if (!/closed|destroyed|Target/.test(error.message)) throw error; });
    await closed; desktop = null;
    assert.throws(() => process.kill(pid, 0));
    const alive = processId => { try { process.kill(processId, 0); return true; } catch { return false; } };
    for (let i = 0; i < 30 && appPids.some(alive); i++) await new Promise(resolve => setTimeout(resolve, 100));
    assert.deepEqual(appPids.filter(alive), []);
    check('Tray quit exits main, renderer and helper processes', { pid, appPids });
    for (const bad of ['{broken', JSON.stringify({version:1,position:{x:200000,y:200000}})]) {
      fs.writeFileSync(settingsFile, bad);
      await launch(); state = await snapshot();
      assert.equal(state.bounds.x, Math.max(state.workArea.x, state.workArea.x + state.workArea.width - state.bounds.width - 24));
      check(bad === '{broken' ? 'Corrupt settings recover on real launch' : 'Offscreen settings recover on real launch', state.bounds);
      await desktop.close(); desktop = null;
    }
    output.result = 'passed';
  } catch (error) { output.result = 'failed'; output.error = error.stack; console.error(error); process.exitCode = 1; }
  finally {
    if (desktop) await desktop.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    // Restore only the settings file this diagnostic exercised; never touch source artwork.
    if (original) fs.writeFileSync(settingsFile, original);
    else if (fs.existsSync(settingsFile)) fs.unlinkSync(settingsFile);
    fs.writeFileSync(path.join(evidenceDir, 'smoke-results' + variant + '.json'), JSON.stringify(output, null, 2));
  }
})();
