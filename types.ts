
export interface TileData {
  id: number;
  value: number;
  row: number;
  col: number;
  isNew?: boolean;
  isMerged?: boolean;
  winnerId?: number;
}

export type Grid = (number | null)[][];