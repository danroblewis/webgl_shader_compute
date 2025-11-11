/**
 * Genome representation for cellular automata rules
 * Uses pattern-based rules with wildcards
 */

const CellType = {
    EMPTY: 0,
    SAND: 1,
    STONE: 2,
    ANY: -1  // Wildcard - matches any cell type
};

/**
 * A rule is a pattern of 9 cells and what the center becomes
 * Pattern layout:
 *   [0, 1, 2,     [NW, N, NE,
 *    3, 4, 5,  =   W, C,  E,
 *    6, 7, 8]      SW, S, SE]
 * 
 * Pattern[4] is the current cell (center)
 * Other positions are neighbors
 */
class Rule {
    constructor(pattern, becomes) {
        if (pattern.length !== 9) {
            throw new Error('Pattern must have exactly 9 elements');
        }
        this.pattern = pattern;  // Array of 9 cell types (including ANY as wildcard)
        this.becomes = becomes;  // What the center cell becomes
    }
    
    // Check if this rule matches the given neighborhood
    matches(center, neighbors) {
        // neighbors = [NW, N, NE, W, E, SW, S, SE] (8 neighbors)
        // Reconstruct the 9-cell pattern
        const actual = [
            neighbors[0], neighbors[1], neighbors[2],  // NW, N, NE
            neighbors[3], center,       neighbors[4],  // W,  C, E
            neighbors[5], neighbors[6], neighbors[7]   // SW, S, SE
        ];
        
        // Check if pattern matches
        for (let i = 0; i < 9; i++) {
            if (this.pattern[i] !== CellType.ANY && this.pattern[i] !== actual[i]) {
                return false;
            }
        }
        return true;
    }
    
    clone() {
        return new Rule([...this.pattern], this.becomes);
    }
}

/**
 * Genome: collection of rules for each cell type
 */
class Genome {
    constructor() {
        // Rules organized by current cell type
        this.rules = {
            [CellType.EMPTY]: [],
            [CellType.SAND]: [],
            [CellType.STONE]: []
        };
    }
    
    addRule(currentCellType, pattern, becomes) {
        // Set pattern[4] to match the current cell type
        const fullPattern = [...pattern];
        fullPattern[4] = currentCellType;
        this.rules[currentCellType].push(new Rule(fullPattern, becomes));
    }
    
    // Generate GLSL code from this genome
    toGLSL() {
        const glsl = `precision highp float;

uniform sampler2D u_state;
varying vec2 v_texCoord;

const float EMPTY = 0.0;
const float SAND = 1.0;
const float STONE = 2.0;

// Helper to get cell value at offset
float getCell(vec2 offset) {
    vec2 texSize = vec2(textureSize(u_state, 0));
    vec2 pixelSize = 1.0 / texSize;
    vec2 coord = v_texCoord + offset * pixelSize;
    return texture2D(u_state, coord).r;
}

void main() {
    float current = getCell(vec2(0.0, 0.0));
    
    // Get 8 neighbors
    float NW = getCell(vec2(-1.0,  1.0));
    float N  = getCell(vec2( 0.0,  1.0));
    float NE = getCell(vec2( 1.0,  1.0));
    float W  = getCell(vec2(-1.0,  0.0));
    float E  = getCell(vec2( 1.0,  0.0));
    float SW = getCell(vec2(-1.0, -1.0));
    float S  = getCell(vec2( 0.0, -1.0));
    float SE = getCell(vec2( 1.0, -1.0));
    
    float newState = current;  // Default: stay the same
    
${this.generateRulesForType(CellType.EMPTY)}
${this.generateRulesForType(CellType.SAND)}
${this.generateRulesForType(CellType.STONE)}
    
    gl_FragColor = vec4(newState, 0.0, 0.0, 1.0);
}
`;
        return glsl;
    }
    
    generateRulesForType(cellType) {
        const rules = this.rules[cellType];
        if (rules.length === 0) return '';
        
        const cellTypeName = ['EMPTY', 'SAND', 'STONE'][cellType];
        let code = `    // Rules for ${cellTypeName}\n`;
        code += `    if (current == ${cellTypeName}) {\n`;
        
        for (let i = 0; i < rules.length; i++) {
            const rule = rules[i];
            const condition = this.patternToCondition(rule.pattern);
            const becomesName = ['EMPTY', 'SAND', 'STONE'][rule.becomes];
            
            if (i === 0) {
                code += `        if (${condition}) {\n`;
            } else {
                code += `        } else if (${condition}) {\n`;
            }
            code += `            newState = ${becomesName};\n`;
        }
        
        if (rules.length > 0) {
            code += `        }\n`;
        }
        code += `    }\n`;
        
        return code;
    }
    
    patternToCondition(pattern) {
        // pattern = [NW, N, NE, W, C, E, SW, S, SE]
        const neighbors = ['NW', 'N', 'NE', 'W', 'E', 'SW', 'S', 'SE'];
        const conditions = [];
        
        for (let i = 0; i < 9; i++) {
            if (i === 4) continue;  // Skip center (already checked in outer if)
            if (pattern[i] === CellType.ANY) continue;  // Wildcard
            
            const neighborIdx = i < 4 ? i : i - 1;  // Adjust index for skipping center
            const neighborName = neighbors[neighborIdx];
            const typeName = ['EMPTY', 'SAND', 'STONE'][pattern[i]];
            conditions.push(`${neighborName} == ${typeName}`);
        }
        
        return conditions.length > 0 ? conditions.join(' && ') : 'true';
    }
    
    clone() {
        const newGenome = new Genome();
        for (const cellType in this.rules) {
            newGenome.rules[cellType] = this.rules[cellType].map(rule => rule.clone());
        }
        return newGenome;
    }
}

// Create a seed genome with basic sand physics
function createSeedGenome() {
    const genome = new Genome();
    const ANY = CellType.ANY;
    const E = CellType.EMPTY;
    const S = CellType.SAND;
    const ST = CellType.STONE;
    
    // STONE never changes
    genome.addRule(ST, [ANY, ANY, ANY, ANY, ST, ANY, ANY, ANY, ANY], ST);
    
    // SAND rules: try to fall down
    genome.addRule(S, [ANY, ANY, ANY, ANY, S, ANY, ANY, E, ANY], E);  // Fall down
    genome.addRule(S, [ANY, ANY, ANY, ANY, S, ANY, E, S, ANY], E);    // Fall down-left
    genome.addRule(S, [ANY, ANY, ANY, ANY, S, ANY, ANY, S, E], E);    // Fall down-right
    genome.addRule(S, [ANY, ANY, ANY, ANY, S, ANY, ANY, ANY, ANY], S); // Stay sand
    
    // EMPTY rules: become sand if sand above
    genome.addRule(E, [ANY, S, ANY, ANY, E, ANY, ANY, ANY, ANY], S);   // Sand falls into empty
    genome.addRule(E, [ANY, ANY, S, ANY, E, ANY, ANY, ANY, ANY], S);   // Sand from above-right
    genome.addRule(E, [S, ANY, ANY, ANY, E, ANY, ANY, ANY, ANY], S);   // Sand from above-left
    genome.addRule(E, [ANY, ANY, ANY, ANY, E, ANY, ANY, ANY, ANY], E); // Stay empty
    
    return genome;
}

export { Genome, Rule, CellType, createSeedGenome };

