export interface CharacterLayout {
  width: number; height: number; imageWidth: number; imageHeight: number; left: number; top: number;
  alphaBounds: { x: number; y: number; width: number; height: number };
}

// Electron nativeImage.toBitmap() returns BGRA pixels. Read alpha without modifying the PNG.
export function characterLayout(bitmap: Uint8Array, width: number, height: number, visibleHeight = 128, padding = 2): CharacterLayout {
  if (bitmap.length !== width * height * 4 || width <= 0 || height <= 0) throw new Error('Invalid image bitmap');
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (bitmap[(y * width + x) * 4 + 3] > 0) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  }
  if (maxX < 0) throw new Error('Character PNG is fully transparent');
  const bounds = { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  const scale = visibleHeight / bounds.height;
  return { width: Math.ceil(bounds.width * scale) + padding * 2, height: visibleHeight + padding * 2,
    imageWidth: width * scale, imageHeight: height * scale, left: padding - minX * scale, top: padding - minY * scale, alphaBounds: bounds };
}
