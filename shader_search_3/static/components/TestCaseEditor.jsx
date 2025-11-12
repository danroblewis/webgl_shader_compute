import React from 'react'
import { FrameEditorGrid } from './FrameEditorGrid.jsx'
import { CellTypePalette } from './CellTypePalette.jsx'

const cloneCell = (cell) => {
  const next = new Float32Array(4)
  next[0] = cell?.[0] ?? 0
  next[1] = cell?.[1] ?? 0
  next[2] = cell?.[2] ?? 0
  next[3] = cell?.[3] ?? 0
  return next
}

const cloneFrame = (frame) => frame.map((row) => row.map(cloneCell))

export const TestCaseEditor = ({ test, onChange, channelIndex = 0 }) => {
  const [selectedCellType, setSelectedCellType] = React.useState(0)

  if (!test) return null

  const handleFieldChange = (field) => (event) => {
    onChange?.({ ...test, [field]: event.target.value })
  }

  const handleCellChange = (frameIdx, rowIdx, colIdx, newCell) => {
    // newCell is a Float32Array with full RGBA values
    const frames = test.frames.map((frame, fi) =>
      frame.map((row, ri) =>
        row.map((cell, ci) => {
          if (fi === frameIdx && ri === rowIdx && ci === colIdx) {
            return newCell
          }
          return cell
        }),
      ),
    )
    onChange?.({ ...test, frames })
  }

  const handleAddFrame = () => {
    const template = test.frames[test.frames.length - 1] || []
    const newFrame = cloneFrame(template)
    onChange?.({ ...test, frames: [...test.frames, newFrame] })
  }

  const handleRemoveFrame = () => {
    if (test.frames.length <= 1) return
    onChange?.({ ...test, frames: test.frames.slice(0, -1) })
  }

  return (
    <div className="test-editor-panel">
      <div className="test-metadata">
        <div className="metadata-field">
          <label>Name</label>
          <input type="text" value={test.name} onChange={handleFieldChange('name')} />
        </div>
        <div className="metadata-inline">
          <span>Width: {test.width}</span>
          <span>Height: {test.height}</span>
          <span>Frames: {test.frames.length}</span>
        </div>
        <div className="metadata-actions">
          <button type="button" onClick={handleAddFrame}>
            + Add Frame
          </button>
          <button type="button" onClick={handleRemoveFrame} disabled={test.frames.length <= 1}>
            Remove Frame
          </button>
        </div>
      </div>
      <div className="editor-layout">
        <div className="editor-sidebar">
          <CellTypePalette
            selectedType={selectedCellType}
            onSelectType={setSelectedCellType}
          />
        </div>
        <div className="frame-editor-list">
          {test.frames.map((frame, idx) => (
            <FrameEditorGrid
              key={`frame-editor-${idx}`}
              frameIndex={idx}
              frame={frame}
              channelIndex={channelIndex}
              selectedCellType={selectedCellType}
              onCellChange={handleCellChange}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
