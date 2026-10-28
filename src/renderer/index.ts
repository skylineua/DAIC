interface Window {
  daicVisibility?: { subscribe(callback: (visible: boolean) => void): () => void };
  daicBlink?: {
    image: string; sheetWidth: number; sheetHeight: number; frameWidth: number; frameHeight: number;
    durationMs: number; frames: { x: number; y: number }[];
  };
}

(() => {
  const image = document.getElementById('character') as HTMLImageElement;
  const query = new URLSearchParams(location.search);
  for (const [parameter, property] of [['imageWidth', 'width'], ['imageHeight', 'height'], ['left', 'left'], ['top', 'top']] as const) {
    const value = Number(query.get(parameter));
    if (!query.has(parameter) || !Number.isFinite(value)) throw new Error('Invalid image layout');
    image.style[property] = value + 'px';
  }
  const file = query.get('imageFile');
  if (!file || /[/\\]/.test(file)) throw new Error('Invalid image file');
  image.src = '../assets/' + encodeURIComponent(file);

  const blink = window.daicBlink;
  if (!blink) return;
  const viewport = document.getElementById('blink') as HTMLDivElement;
  const sheet = document.getElementById('blink-sheet') as HTMLImageElement;
  const scale = Number(query.get('imageWidth')) / blink.frameWidth;
  viewport.style.left = image.style.left;
  viewport.style.top = image.style.top;
  viewport.style.width = image.style.width;
  viewport.style.height = image.style.height;
  sheet.style.width = blink.sheetWidth * scale + 'px';
  sheet.style.height = blink.sheetHeight * scale + 'px';
  let timer: ReturnType<typeof setTimeout> | undefined;
  let loaded = false;
  let nativeVisible = false;

  function showNeutral(): void {
    image.hidden = false;
    viewport.hidden = true;
    document.body.dataset.animation = 'idle';
    delete document.body.dataset.frame;
  }
  function schedule(): void {
    clearTimeout(timer);
    showNeutral();
    if (loaded && nativeVisible) timer = setTimeout(() => play(0), 4000 + Math.random() * 4000);
  }
  function play(index: number): void {
    if (!nativeVisible) { schedule(); return; }
    const frame = blink!.frames[index];
    if (!frame) { schedule(); return; }
    sheet.style.left = -frame.x * scale + 'px';
    sheet.style.top = -frame.y * scale + 'px';
    image.hidden = true;
    viewport.hidden = false;
    document.body.dataset.animation = 'blink';
    document.body.dataset.frame = String(index);
    timer = setTimeout(() => play(index + 1), blink!.durationMs);
  }
  sheet.onload = () => {
    loaded = sheet.naturalWidth === blink.sheetWidth && sheet.naturalHeight === blink.sheetHeight;
    schedule();
  };
  sheet.onerror = () => { loaded = false; schedule(); };
  const unsubscribe = window.daicVisibility?.subscribe(visible => {
    nativeVisible = visible;
    document.body.dataset.visible = String(visible);
    schedule();
  });
  window.addEventListener('pagehide', () => { clearTimeout(timer); unsubscribe?.(); });
  showNeutral();
  sheet.src = '../assets/' + encodeURIComponent(blink.image);
})();
