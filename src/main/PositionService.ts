export interface Position { x: number; y: number }
export interface Size { width: number; height: number }
export interface WorkArea extends Position, Size {}

export class PositionService {
  constructor(private readonly margin = 24) {}
  defaultPosition(area: WorkArea, size: Size): Position {
    return { x: Math.max(area.x, area.x + area.width - size.width - this.margin), y: Math.max(area.y, area.y + area.height - size.height - this.margin) };
  }
  resolve(candidate: Position | null, areas: WorkArea[], primary: WorkArea, size: Size): Position {
    if (candidate && Number.isFinite(candidate.x) && Number.isFinite(candidate.y) && areas.some(a => candidate.x >= a.x && candidate.y >= a.y && candidate.x + size.width <= a.x + a.width && candidate.y + size.height <= a.y + a.height)) return { ...candidate };
    return this.defaultPosition(primary, size);
  }
}
