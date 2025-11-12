import React from 'react'
import { CELL_TYPES } from './cellTypes.js'

export const GlobalCellTypeSelector = ({ selectedType, onSelectType, availableCellTypes = CELL_TYPES }) => {
  React.useEffect(() => {
    const handleKeyPress = (event) => {
      // Only handle number keys when not typing in an input/textarea
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return
      }
      
      const key = event.key
      if (key >= '0' && key <= '9') {
        const typeId = parseInt(key, 10)
        const cellType = availableCellTypes.find((ct) => ct.id === typeId)
        if (cellType) {
          event.preventDefault()
          onSelectType?.(typeId)
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [onSelectType, availableCellTypes])

  return (
    <div className="global-cell-type-selector">
      <div className="selector-header">
        <h4>Cell Type</h4>
        <span className="selector-hint">Press 0-9</span>
      </div>
      <div className="selector-buttons">
        {availableCellTypes.map((cellType) => (
          <button
            key={cellType.id}
            type="button"
            className={`selector-button ${selectedType === cellType.id ? 'selected' : ''}`}
            onClick={() => onSelectType?.(cellType.id)}
            style={{
              backgroundColor: cellType.color,
              borderColor: selectedType === cellType.id ? '#fff' : 'transparent',
            }}
            title={`${cellType.name} (Press ${cellType.id})`}
          >
            <span className="selector-button-number">{cellType.id}</span>
            <span className="selector-button-name">{cellType.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

