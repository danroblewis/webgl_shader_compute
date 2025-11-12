import { CAFrame } from './CAFrame.jsx'

export const FrameEditorGrid = ({
  frameIndex,
  frame,
  onCellChange,
  selectedCellType = 0,
  channelIndex = 0,
}) => {
  if (!frame) return null

  const handleCellClick = (y, x, currentCell) => {
    // Create a new Float32Array preserving existing RGBA values
    const newCell = new Float32Array(4)
    // Preserve existing values
    newCell[0] = selectedCellType // Set first channel to selected type
    newCell[1] = currentCell?.[1] ?? 0
    newCell[2] = currentCell?.[2] ?? 0
    newCell[3] = currentCell?.[3] ?? 0
    onCellChange?.(frameIndex, y, x, newCell)
  }

  return (
    <div className="frame-editor">
      <CAFrame
        frame={frame}
        channelIndex={channelIndex}
        onCellClick={handleCellClick}
        selectedCellType={selectedCellType}
        interactive={true}
      />
    </div>
  )
}
