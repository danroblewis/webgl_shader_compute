import { CELL_TYPES } from '../components/cellTypes.js'

/**
 * Extract available cell types from an evolution config
 * @param {Object} config - Evolution config with rule_set
 * @returns {Array} Array of cell type objects from CELL_TYPES that match the config
 */
export function getCellTypesFromConfig(config) {
  if (!config || !config.rule_set) {
    // If no config, return all cell types (fallback)
    return CELL_TYPES
  }
  
  // Extract cell type names from rule_set keys
  const configCellTypeNames = Object.keys(config.rule_set)
  
  // Map to CELL_TYPES by matching name
  const availableTypes = configCellTypeNames
    .map(name => {
      // Find matching cell type by name (case-insensitive)
      return CELL_TYPES.find(ct => 
        ct.name.toUpperCase() === name.toUpperCase()
      )
    })
    .filter(Boolean) // Remove undefined entries
  
  // If we found types, return them; otherwise fallback to all
  return availableTypes.length > 0 ? availableTypes : CELL_TYPES
}

