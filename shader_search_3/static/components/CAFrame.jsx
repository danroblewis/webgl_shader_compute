const CELL_SIZE = 20

const CAFrame = ({ frame }) => {
  if (!frame?.length) return null

  const palette = ['#0f172a', '#38bdf8', '#f97316', '#22c55e', '#94a3b8']
  const getCellColor = (value) => palette[value % palette.length]
  const columns = frame[0]?.length ?? 0

  return (
    <div
      className="grid-preview"
      style={{
        gridTemplateColumns: `repeat(${columns}, ${CELL_SIZE}px)`,
        gridAutoRows: `${CELL_SIZE}px`,
      }}
    >
      {frame.flat().map((value, idx) => (
        <div
          className="grid-cell"
          key={idx}
          style={{ width: `${CELL_SIZE}px`, height: `${CELL_SIZE}px` }}
        >
          <div
            className="grid-cell-inner"
            style={{ backgroundColor: getCellColor(value) }}
            title={`Cell ${idx}: ${value}`}
          />
        </div>
      ))}
    </div>
  )
}
