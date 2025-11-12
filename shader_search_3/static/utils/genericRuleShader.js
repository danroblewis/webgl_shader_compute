/**
 * Generic GLSL shader that evaluates rules from uniform arrays
 * This avoids recompiling shaders for each rule set
 */

export const GENERIC_RULE_SHADER = `#version 300 es
precision highp float;

uniform sampler2D u_state;
uniform float u_width;
uniform float u_height;

// Rule data stored in textures (to avoid uniform limits)
// Texture layout:
// - u_rulesTexture: stores rule patterns and becomes values
//   Format: width = 10 (one column per rule), height = MAX_TOTAL_RULES
//   Column 0-8: pattern values (NW, N, NE, W, C, E, SW, S, SE)
//   Column 9: becomes value
// - u_ruleMetadataTexture: stores metadata
//   Format: width = 3, height = MAX_CELL_TYPES
//   Column 0: cell type value
//   Column 1: number of rules for this type
//   Column 2: starting rule index for this type

uniform sampler2D u_rulesTexture;
uniform sampler2D u_ruleMetadataTexture;
uniform int u_numCellTypes;
uniform int u_totalRules;

// Maximum 10 cell types, 20 rules per type = 200 rules max
#define MAX_CELL_TYPES 10
#define MAX_RULES_PER_TYPE 20
#define MAX_TOTAL_RULES 200

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

// Neighbor offsets (NW, N, NE, W, C, E, SW, S, SE)
const vec2 neighborOffsets[9] = vec2[](
    vec2(-1.0,  1.0),  // 0: NW
    vec2( 0.0,  1.0),  // 1: N
    vec2( 1.0,  1.0),  // 2: NE
    vec2(-1.0,  0.0),  // 3: W
    vec2( 0.0,  0.0),  // 4: C (center)
    vec2( 1.0,  0.0),  // 5: E
    vec2(-1.0, -1.0),  // 6: SW
    vec2( 0.0, -1.0),  // 7: S
    vec2( 1.0, -1.0)   // 8: SE
);

// Helper to read from rules texture
float readRuleValue(int ruleIndex, int column) {
    vec2 coord = vec2(float(column) / 10.0, (float(ruleIndex) + 0.5) / float(MAX_TOTAL_RULES));
    return texture(u_rulesTexture, coord).r;
}

// Helper to read metadata
float readMetadata(int cellTypeIndex, int column) {
    vec2 coord = vec2(float(column) / 3.0, (float(cellTypeIndex) + 0.5) / float(MAX_CELL_TYPES));
    return texture(u_ruleMetadataTexture, coord).r;
}

void main() {
    float current = getCell(vec2(0.0, 0.0));
    float newState = current;  // Default: stay the same
    
    // Find which cell type index matches current
    int currentTypeIndex = -1;
    for (int i = 0; i < MAX_CELL_TYPES && i < u_numCellTypes; i++) {
        float cellTypeValue = readMetadata(i, 0);
        // Use epsilon comparison for floating point
        if (abs(current - cellTypeValue) < 0.01) {
            currentTypeIndex = i;
            break;
        }
    }
    
    // If we found a matching cell type, check its rules
    if (currentTypeIndex >= 0) {
        // Get starting rule index and number of rules from metadata
        float ruleStartIndexFloat = readMetadata(currentTypeIndex, 2);
        float numRulesFloat = readMetadata(currentTypeIndex, 1);
        int ruleStartIndex = int(ruleStartIndexFloat);
        int numRules = int(numRulesFloat);
        
        // Check each rule for this cell type
        for (int r = 0; r < MAX_RULES_PER_TYPE && r < numRules && (ruleStartIndex + r) < u_totalRules; r++) {
            int ruleIndex = ruleStartIndex + r;
            
            // Check if this rule matches
            bool ruleMatches = true;
            
            for (int p = 0; p < 9; p++) {
                float patternValue = readRuleValue(ruleIndex, p);
                
                // -1.0 means wildcard (match anything)
                if (patternValue < -0.5) {
                    continue;  // Wildcard, skip check
                }
                
                // Get neighbor value
                float neighborValue = getCell(neighborOffsets[p]);
                
                // Check if it matches (use epsilon for floating point comparison)
                if (abs(neighborValue - patternValue) > 0.01) {
                    ruleMatches = false;
                    break;
                }
            }
            
            // If rule matches, apply it
            if (ruleMatches) {
                newState = readRuleValue(ruleIndex, 9);  // Column 9 is the "becomes" value
                break;  // First matching rule wins
            }
        }
    }
    
    fragColor = vec4(newState, 0.0, 0.0, 1.0);
}
`

/**
 * Convert a rule set to texture data for the generic shader
 * @param {Object} ruleSet - Rule set object with cell types as keys
 * @param {GPUCompute} gpuCompute - GPU compute instance for creating textures
 * @returns {Object} Uniform data object with textures
 */
export function ruleSetToUniforms(ruleSet, gpuCompute) {
  const cellTypeNames = Object.keys(ruleSet)
  const MAX_CELL_TYPES = 10
  const MAX_RULES_PER_TYPE = 20
  const MAX_TOTAL_RULES = 200
  
  // Build cell type value map (use index as value for now)
  const cellTypeValueMap = {}
  cellTypeNames.forEach((name, idx) => {
    cellTypeValueMap[name] = idx
  })
  
  // Rules texture: width = 10 (columns 0-8: pattern, column 9: becomes), height = MAX_TOTAL_RULES
  const rulesTextureData = new Float32Array(10 * MAX_TOTAL_RULES * 4)  // RGBA format
  
  // Metadata texture: width = 3 (col 0: cellTypeValue, col 1: numRules, col 2: ruleStartIndex), height = MAX_CELL_TYPES
  const metadataTextureData = new Float32Array(3 * MAX_CELL_TYPES * 4)  // RGBA format
  
  let ruleIndex = 0
  let ruleStartIndex = 0
  
  // Process each cell type
  for (let typeIdx = 0; typeIdx < cellTypeNames.length && typeIdx < MAX_CELL_TYPES; typeIdx++) {
    const cellTypeName = cellTypeNames[typeIdx]
    const cellTypeValue = cellTypeValueMap[cellTypeName]
    const rules = ruleSet[cellTypeName] || []
    const numRules = Math.min(rules.length, MAX_RULES_PER_TYPE)
    
    // Store metadata for this cell type
    // Column 0: cell type value
    metadataTextureData[(typeIdx * 3 + 0) * 4] = cellTypeValue
    // Column 1: number of rules
    metadataTextureData[(typeIdx * 3 + 1) * 4] = numRules
    // Column 2: starting rule index
    metadataTextureData[(typeIdx * 3 + 2) * 4] = ruleStartIndex
    
    // Process rules for this cell type
    for (let r = 0; r < rules.length && r < MAX_RULES_PER_TYPE && ruleIndex < MAX_TOTAL_RULES; r++) {
      const rule = rules[r]
      const pattern = rule.pattern || []
      
      // Store pattern (columns 0-8: NW, N, NE, W, C, E, SW, S, SE)
      for (let p = 0; p < 9; p++) {
        const patternValue = pattern[p]
        let value
        if (patternValue === '*' || patternValue === null || patternValue === undefined) {
          value = -1.0  // Wildcard
        } else {
          // Convert cell type name to value
          value = typeof patternValue === 'number' 
            ? patternValue 
            : (cellTypeValueMap[patternValue] ?? 0)
        }
        // Store in rules texture: row = ruleIndex, column = p
        rulesTextureData[(ruleIndex * 10 + p) * 4] = value
      }
      
      // Store "becomes" value in column 9
      const becomesValue = typeof rule.becomes === 'number'
        ? rule.becomes
        : (cellTypeValueMap[rule.becomes] ?? 0)
      rulesTextureData[(ruleIndex * 10 + 9) * 4] = becomesValue
      
      ruleIndex++
    }
    
    ruleStartIndex += numRules
  }
  
  // Create textures
  const rulesTexture = gpuCompute.createBuffer(10, MAX_TOTAL_RULES, rulesTextureData)
  const metadataTexture = gpuCompute.createBuffer(3, MAX_CELL_TYPES, metadataTextureData)
  
  return {
    numCellTypes: cellTypeNames.length,
    totalRules: ruleIndex,
    rulesTexture,
    metadataTexture
  }
}

