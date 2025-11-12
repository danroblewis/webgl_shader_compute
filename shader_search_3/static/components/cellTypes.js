// Shared cell type definitions
export const CELL_TYPES = [
  { id: 0, name: 'EMPTY', color: '#222222' },
  { id: 1, name: 'SAND', color: '#f97316' },
  { id: 2, name: 'WATER', color: '#38bdf8' },
  { id: 3, name: 'STONE', color: '#94a3b8' },
  { id: 4, name: 'Type 4', color: '#22c55e' },
  { id: 5, name: 'Type 5', color: '#a855f7' },
  { id: 6, name: 'Type 6', color: '#ef4444' },
  { id: 7, name: 'Type 7', color: '#fbbf24' },
  { id: 8, name: 'Type 8', color: '#ec4899' },
  { id: 9, name: 'Type 9', color: '#14b8a6' },
]

// Extract just the colors array for CAFrame
export const CELL_TYPE_PALETTE = CELL_TYPES.map((ct) => ct.color)

