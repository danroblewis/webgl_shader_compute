import React from 'react'
import { CELL_TYPES } from './cellTypes.js'

/**
 * Visualizes a rule set by showing decision boxes for each cell type
 * Each rule is displayed as a 3x3 grid showing the pattern and what it becomes
 */
export default function RuleSetVisualizer({ ruleSet }) {
  if (!ruleSet || typeof ruleSet !== 'object') {
    return <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>No rule set to display</p>
  }

  // Get cell type map for looking up names
  const cellTypeMap = {}
  CELL_TYPES.forEach(ct => {
    cellTypeMap[ct.name] = ct
    cellTypeMap[ct.id] = ct
  })

  // Helper to get cell type info
  const getCellTypeInfo = (cellTypeNameOrId) => {
    if (typeof cellTypeNameOrId === 'number') {
      return CELL_TYPES.find(ct => ct.id === cellTypeNameOrId) || CELL_TYPES[0]
    }
    return cellTypeMap[cellTypeNameOrId] || CELL_TYPES[0]
  }

  // Helper to render a single rule pattern (3x3 grid)
  const renderRulePattern = (rule, cellTypeName) => {
    const { pattern, becomes } = rule
    if (!pattern || pattern.length !== 9) {
      return null
    }

    // Pattern layout: [NW, N, NE, W, C, E, SW, S, SE]
    const positions = [
      { idx: 6, label: 'NW' },
      { idx: 7, label: 'N' },
      { idx: 8, label: 'NE' },
      { idx: 3, label: 'W' },
      { idx: 4, label: 'C' },
      { idx: 5, label: 'E' },
      { idx: 1, label: 'SW' },
      { idx: 2, label: 'S' },
      { idx: 3, label: 'SE' },
    ]

    return (
      <div style={{
        display: 'inline-block',
        margin: '0.5rem',
        padding: '0.75rem',
        backgroundColor: 'rgba(15, 23, 42, 0.3)',
        borderRadius: '8px',
        border: '1px solid rgba(148, 163, 184, 0.2)'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '2px',
          width: '120px',
          height: '120px',
          marginBottom: '0.5rem'
        }}>
          {positions.map(({ idx, label }) => {
            const cellValue = pattern[idx]
            const isCenter = idx === 4
            const isWildcard = cellValue === '*'
            const cellInfo = isWildcard ? null : getCellTypeInfo(cellValue)
            
            return (
              <div
                key={idx}
                style={{
                  backgroundColor: isWildcard 
                    ? 'rgba(148, 163, 184, 0.2)' 
                    : (cellInfo?.color || '#222222'),
                  border: isCenter ? '2px solid #3b82f6' : '1px solid rgba(148, 163, 184, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.7rem',
                  color: isWildcard ? '#94a3b8' : '#fff',
                  fontWeight: isCenter ? 'bold' : 'normal',
                  position: 'relative'
                }}
                title={isCenter ? `Center (${cellTypeName})` : `${label}: ${isWildcard ? 'Any' : cellInfo?.name || cellValue}`}
              >
                {isWildcard ? '•' : (cellInfo?.id ?? cellValue)}
              </div>
            )
          })}
        </div>
        <div style={{
          textAlign: 'center',
          fontSize: '0.85rem',
          marginTop: '0.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem'
        }}>
          <span style={{ color: '#64748b' }}>→</span>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0.25rem 0.5rem',
            backgroundColor: getCellTypeInfo(becomes)?.color || '#222222',
            color: '#fff',
            fontWeight: 'bold',
            borderRadius: '4px',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            <span style={{
              display: 'inline-block',
              width: '12px',
              height: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.3)',
              borderRadius: '2px'
            }} />
            {getCellTypeInfo(becomes)?.name || becomes}
          </span>
        </div>
      </div>
    )
  }

  // Render each cell type section
  const cellTypeNames = Object.keys(ruleSet).filter(key => Array.isArray(ruleSet[key]))

  if (cellTypeNames.length === 0) {
    return <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>No rules defined</p>
  }

  return (
    <div style={{ marginTop: '1rem' }}>
      {cellTypeNames.map(cellTypeName => {
        const rules = ruleSet[cellTypeName] || []
        const cellTypeInfo = getCellTypeInfo(cellTypeName)

        return (
          <div
            key={cellTypeName}
            style={{
              marginBottom: '1.5rem',
              padding: '1rem',
              backgroundColor: 'rgba(15, 23, 42, 0.2)',
              borderRadius: '8px',
              border: `1px solid ${cellTypeInfo?.color || 'rgba(148, 163, 184, 0.3)'}`
            }}
          >
            <h5 style={{
              marginTop: 0,
              marginBottom: '0.75rem',
              color: cellTypeInfo?.color || '#fff',
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span style={{
                display: 'inline-block',
                width: '16px',
                height: '16px',
                backgroundColor: cellTypeInfo?.color || '#222222',
                borderRadius: '2px',
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }} />
              {cellTypeInfo?.name || cellTypeName}
              <span style={{
                fontSize: '0.85rem',
                color: '#94a3b8',
                fontWeight: 'normal',
                marginLeft: '0.5rem'
              }}>
                ({rules.length} rule{rules.length !== 1 ? 's' : ''})
              </span>
            </h5>
            
            {rules.length === 0 ? (
              <p style={{ color: '#94a3b8', fontStyle: 'italic', margin: 0 }}>
                No rules defined for this cell type
              </p>
            ) : (
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem'
              }}>
                {rules.map((rule, ruleIndex) => (
                  <div key={ruleIndex}>
                    {renderRulePattern(rule, cellTypeName)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

