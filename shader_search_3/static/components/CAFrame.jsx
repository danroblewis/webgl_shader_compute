const CELL_SIZE = 20

export const CAFrame = ({ frame, channelIndex = 0 }) => {
  if (!frame?.length) return null

  const palette = ['#0f172a', '#38bdf8', '#f97316', '#22c55e', '#94a3b8']
  const getCellColor = (cell) => {
    const value = cell?.[channelIndex] ?? cell?.[0] ?? 0
    return palette[Math.abs(Math.round(value)) % palette.length]
  }

  const columns = frame[0]?.length ?? 0

  return (
    <div
      className="grid-preview"
      style={{
        gridTemplateColumns: `repeat(${columns}, ${CELL_SIZE}px)`,
        gridAutoRows: `${CELL_SIZE}px`,
      }}
    >
      {frame.flat().map((cell, idx) => (
        <div
          className="grid-cell"
          key={idx}
          style={{ width: `${CELL_SIZE}px`, height: `${CELL_SIZE}px` }}
        >
          <div
            className="grid-cell-inner"
            style={{ backgroundColor: getCellColor(cell) }}
            title={`Cell ${idx}: [${Array.from(cell ?? []).join(', ')}]`}
          />
        </div>
      ))}
    </div>
  )
}
