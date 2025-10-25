

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

export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  fid: number | null; // FID can be null for on-chain addresses without Farcaster accounts
  score: number;
  isCurrentUser?: boolean;
}