export const FrameEditorGrid = ({
  frameIndex,
  frame,
  onCellChange,
  channelIndex = 0,
}) => {
  if (!frame) return null

  const height = frame.length
  const width = frame[0]?.length ?? 0

  return (
    <div className="frame-editor">
      <div className="frame-editor-header">
        <h4>Frame {frameIndex + 1}</h4>
      </div>
      <div className="frame-editor-grid" style={{ gridTemplateColumns: `repeat(${width}, 1fr)` }}>
        {frame.map((row, y) =>
          row.map((cell, x) => (
            <label key={`cell-${y}-${x}`} className="frame-editor-cell">
              <span className="cell-coords">({x}, {y})</span>
              <input
                type="number"
                step="1"
                value={cell?.[channelIndex] ?? 0}
                onChange={(event) =>
                  onCellChange?.(frameIndex, y, x, channelIndex, Number(event.target.value))
                }
              />
            </label>
          )),
        )}
      </div>
    </div>
  )
}
