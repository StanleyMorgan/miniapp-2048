

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
  fid: number | null;
  score: number;
  isCurrentUser?: boolean;
}

export interface SeasonInfo {
  id: string;
  name: string;
  isEnabled: boolean;
  isDefault: boolean;
  contractAddress: `0x${string}` | null;
  chainId: number | null;
  chainName: string | null;
  prizePool: number | null;
  prizeUnit: string | null;
  shareName: string | null;
  startDate: string | null; // ISO 8601 date string
  endDate: string | null;   // ISO 8601 date string
  sortOrder: number;
}
