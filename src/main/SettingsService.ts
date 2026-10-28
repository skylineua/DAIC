import fs from 'node:fs';
import path from 'node:path';
import type { Position } from './PositionService';

export function parseSettings(value: unknown): Position | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as { version?: unknown; position?: unknown };
  if (record.version !== 1 || !record.position || typeof record.position !== 'object' || Array.isArray(record.position)) return null;
  const p = record.position as { x?: unknown; y?: unknown };
  const valid = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= -2147483648 && v <= 2147483647;
  return valid(p.x) && valid(p.y) ? { x: Math.round(p.x), y: Math.round(p.y) } : null;
}

export class SettingsService {
  private lastSaved = '';
  constructor(readonly file: string, private readonly report: (error: unknown) => void = console.warn) {}
  load(): Position | null {
    try { return parseSettings(JSON.parse(fs.readFileSync(this.file, 'utf8'))); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') this.report(error); return null; }
  }
  save(position: Position): boolean {
    const valid = parseSettings({ version: 1, position });
    if (!valid) return false;
    const text = JSON.stringify({ version: 1, position: valid }, null, 2) + '\n';
    if (text === this.lastSaved && fs.existsSync(this.file)) return true;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file + '.tmp', text, 'utf8');
      fs.renameSync(this.file + '.tmp', this.file);
      this.lastSaved = text;
      return true;
    } catch (error) { this.report(error); return false; }
  }
}
