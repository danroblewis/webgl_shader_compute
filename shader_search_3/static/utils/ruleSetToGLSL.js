/**
 * Convert a rule set (from EvolutionConfig) to GLSL shader code
 * 
 * Rule set format:
 * {
 *   "EMPTY": [{ pattern: ["*", "*", "*", "*", "EMPTY", "*", "*", "SAND", "*"], becomes: "SAND" }],
 *   "SAND": [{ pattern: ["*", "*", "*", "*", "SAND", "*", "*", "EMPTY", "*"], becomes: "EMPTY" }],
 *   ...
 * }
 * 
 * Pattern layout (3x3 grid):
 * [0, 1, 2,     [NW, N, NE,
 *  3, 4, 5,  =   W,  C,  E,
 *  6, 7, 8]      SW, S, SE]
 */

// Map cell type names to their numeric values (from the first channel)
const CELL_TYPE_MAP = {
  'EMPTY': 0,
  'SAND': 1,
  'WATER': 2,
  'STONE': 3,
  // Add more as needed
}

function getCellTypeValue(cellTypeName) {
  // If it's already a number, return it
  if (typeof cellTypeName === 'number') {
    return cellTypeName
  }
  // Otherwise look it up in the map
  return CELL_TYPE_MAP[cellTypeName] ?? 0
}

function generateRuleCondition(pattern, becomes) {
  // Pattern is a 3x3 grid: [NW, N, NE, W, C, E, SW, S, SE]
  // We need to check if the current cell matches the center (index 4)
  // and all neighbors match their positions
  
  const conditions = []
  
  // Check center cell (index 4)
  if (pattern[4] !== '*') {
    const centerType = getCellTypeValue(pattern[4])
    conditions.push(`current == ${centerType}.0`)
  }
  
  // Check neighbors
  const neighborOffsets = [
    { idx: 0, name: 'NW', offset: 'vec2(-1.0,  1.0)' },
    { idx: 1, name: 'N',  offset: 'vec2( 0.0,  1.0)' },
    { idx: 2, name: 'NE', offset: 'vec2( 1.0,  1.0)' },
    { idx: 3, name: 'W',  offset: 'vec2(-1.0,  0.0)' },
    { idx: 5, name: 'E',  offset: 'vec2( 1.0,  0.0)' },
    { idx: 6, name: 'SW', offset: 'vec2(-1.0, -1.0)' },
    { idx: 7, name: 'S',  offset: 'vec2( 0.0, -1.0)' },
    { idx: 8, name: 'SE', offset: 'vec2( 1.0, -1.0)' },
  ]
  
  for (const { idx, name, offset } of neighborOffsets) {
    if (pattern[idx] !== '*') {
      const neighborType = getCellTypeValue(pattern[idx])
      conditions.push(`getCell(${offset}) == ${neighborType}.0`)
    }
  }
  
  if (conditions.length === 0) {
    return 'true' // Always matches
  }
  
  return conditions.join(' && ')
}

function generateRulesForType(cellTypeName, rules) {
  if (!rules || rules.length === 0) {
    return ''
  }
  
  const cellTypeValue = getCellTypeValue(cellTypeName)
  const ruleBlocks = []
  
  for (const rule of rules) {
    const condition = generateRuleCondition(rule.pattern, rule.becomes)
    const becomesValue = getCellTypeValue(rule.becomes)
    ruleBlocks.push(`    if (${condition}) {
      newState = ${becomesValue}.0;
    }`)
  }
  
  return `
    if (current == ${cellTypeValue}.0) {
${ruleBlocks.join('\n')}
    }`
}

export function ruleSetToGLSL(ruleSet) {
  // Extract cell type names from rule set keys
  const cellTypeNames = Object.keys(ruleSet)
  
  // Build cell type map from rule set keys
  // Try to extract numeric values from the simulation code if available
  // For now, use index as value (EMPTY=0, SAND=1, etc.)
  const typeMap = {}
  cellTypeNames.forEach((name, idx) => {
    typeMap[name] = idx
  })
  
  // Update global map
  Object.assign(CELL_TYPE_MAP, typeMap)
  
  // Generate rule blocks for each cell type
  const ruleBlocks = []
  for (const cellTypeName of cellTypeNames) {
    const rules = ruleSet[cellTypeName] || []
    if (rules.length > 0) {
      ruleBlocks.push(generateRulesForType(cellTypeName, rules))
    }
  }
  
  const glsl = `#version 300 es
precision highp float;

uniform sampler2D u_state;
uniform float u_width;
uniform float u_height;
in vec2 v_texCoord;
out vec4 fragColor;

// Helper to get cell value at offset
float getCell(vec2 offset) {
    vec2 texSize = vec2(u_width, u_height);
    vec2 pixelSize = 1.0 / texSize;
    vec2 coord = v_texCoord + offset * pixelSize;
    vec4 texel = texture(u_state, coord);
    return texel.r; // Return red channel (cell type value)
}

void main() {
    float current = getCell(vec2(0.0, 0.0));
    float newState = current;  // Default: stay the same
    
${ruleBlocks.join('\n')}
    
    fragColor = vec4(newState, 0.0, 0.0, 1.0);
}`
  
  return glsl
}

