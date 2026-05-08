const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
export type CompassDirection = (typeof DIRECTIONS)[number];

export function compassDirection(degrees: number): CompassDirection {
  const normalized = ((degrees % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % 8;
  return DIRECTIONS[index];
}
