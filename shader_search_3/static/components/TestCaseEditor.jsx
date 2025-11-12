import React from 'react'
import { FrameEditorGrid } from './FrameEditorGrid.jsx'
import { CellTypePalette } from './CellTypePalette.jsx'
import { CELL_TYPES } from './cellTypes.js'

const createFloatCell = (value) => {
  const cell = new Float32Array(4)
  cell[0] = value
  return cell
}

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

  const handleDimensionChange = (field, newValue) => {
    const oldWidth = test.width
    const oldHeight = test.height
    const newWidth = field === 'width' ? newValue : oldWidth
    const newHeight = field === 'height' ? newValue : oldHeight

    // Resize all frames to match new dimensions
    const resizedFrames = test.frames.map((frame) => {
      const newFrame = []
      for (let y = 0; y < newHeight; y++) {
        const newRow = []
        for (let x = 0; x < newWidth; x++) {
          // Get existing cell if within old bounds, otherwise create empty cell
          if (y < oldHeight && x < oldWidth) {
            newRow.push(cloneCell(frame[y][x]))
          } else {
            newRow.push(createFloatCell(0))
          }
        }
        newFrame.push(newRow)
      }
      return newFrame
    })

    onChange?.({
      ...test,
      width: newWidth,
      height: newHeight,
      frames: resizedFrames,
    })
  }

  const handleFieldChange = (field) => (event) => {
    const value = event.target.value
    if (field === 'width' || field === 'height') {
      const numValue = parseInt(value, 10)
      if (isNaN(numValue) || numValue < 1) return // Don't update if invalid
      handleDimensionChange(field, numValue)
    } else {
      onChange?.({ ...test, [field]: value })
    }
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
          <div className="metadata-field">
            <label>Width</label>
            <input
              type="number"
              min="1"
              value={test.width}
              onChange={handleFieldChange('width')}
              style={{ width: '80px' }}
            />
          </div>
          <div className="metadata-field">
            <label>Height</label>
            <input
              type="number"
              min="1"
              value={test.height}
              onChange={handleFieldChange('height')}
              style={{ width: '80px' }}
            />
          </div>
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
            availableCellTypes={CELL_TYPES}
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
