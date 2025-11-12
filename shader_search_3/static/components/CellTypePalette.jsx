import React from 'react'
import { CELL_TYPES } from './cellTypes.js'

export const CellTypePalette = ({ selectedType, onSelectType }) => {
  React.useEffect(() => {
    const handleKeyPress = (event) => {
      // Only handle number keys when not typing in an input/textarea
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return
      }
      
      const key = event.key
      if (key >= '0' && key <= '9') {
        const typeId = parseInt(key, 10)
        const cellType = CELL_TYPES.find((ct) => ct.id === typeId)
        if (cellType) {
          event.preventDefault()
          onSelectType?.(typeId)
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [onSelectType])

  return (
    <div className="cell-type-palette">
      <div className="palette-header">
        <h4>Cell Types</h4>
        <span className="palette-hint">Press 0-9 to select</span>
      </div>
      <div className="palette-buttons">
        {CELL_TYPES.map((cellType) => (
          <button
            key={cellType.id}
            type="button"
            className={`palette-button ${selectedType === cellType.id ? 'selected' : ''}`}
            onClick={() => onSelectType?.(cellType.id)}
            style={{
              backgroundColor: cellType.color,
              borderColor: selectedType === cellType.id ? '#fff' : 'transparent',
            }}
            title={`${cellType.name} (Press ${cellType.id})`}
          >
            <span className="palette-button-number">{cellType.id}</span>
            <span className="palette-button-name">{cellType.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

