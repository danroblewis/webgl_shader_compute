import { CELL_TYPE_PALETTE } from './cellTypes.js'

const CELL_SIZE = 20

export const CAFrame = ({ 
  frame, 
  channelIndex = 0,
  onCellClick,
  selectedCellType = null,
  cellSize = CELL_SIZE,
  interactive = false,
}) => {
  if (!frame?.length) return null

  const palette = CELL_TYPE_PALETTE
  const getCellColor = (cell) => {
    const value = cell?.[channelIndex] ?? cell?.[0] ?? 0
    return palette[Math.abs(Math.round(value)) % palette.length]
  }

  const columns = frame[0]?.length ?? 0

  const handleCellClick = (y, x, cell) => {
    if (interactive && onCellClick) {
      onCellClick(y, x, cell)
    }
  }

  return (
    <div
      className={`grid-preview ${interactive ? 'interactive' : ''}`}
      style={{
        gridTemplateColumns: `repeat(${columns}, ${cellSize}px)`,
        gridAutoRows: `${cellSize}px`,
      }}
    >
      {frame.map((row, y) =>
        row.map((cell, x) => {
          return (
            <div
              className={`grid-cell ${interactive ? 'clickable' : ''}`}
              key={`cell-${y}-${x}`}
              style={{ 
                width: `${cellSize}px`, 
                height: `${cellSize}px`,
                cursor: interactive ? 'pointer' : 'default',
              }}
              onClick={() => handleCellClick(y, x, cell)}
              title={`Cell (${x}, ${y}): [${Array.from(cell ?? []).map(v => v.toFixed(1)).join(', ')}]`}
            >
              <div
                className="grid-cell-inner"
                style={{ 
                  backgroundColor: getCellColor(cell),
                }}
              />
            </div>
          )
        })
      )}
    </div>
  )
}
