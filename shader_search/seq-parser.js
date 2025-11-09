// Parser for .seq (sequence) test files
// Format: grids separated by empty lines, using characters for cell types

const CellType = {
    EMPTY: 0,
    SAND: 1,
    STONE: 2
};

// Map characters to cell types
const CHAR_TO_CELL = {
    '.': CellType.EMPTY,
    's': CellType.SAND,
    'S': CellType.SAND,
    '#': CellType.STONE
};

/**
 * Parse a .seq file into a sequence of grids
 * @param {string} content - File content
 * @returns {{width: number, height: number, frames: Array<Array<Array<number>>>}}
 */
export function parseSeqFile(content) {
    // Split into frames by double newlines
    const frameTexts = content.trim().split(/\n\s*\n/);
    
    if (frameTexts.length === 0) {
        throw new Error('Empty sequence file');
    }
    
    const frames = [];
    let width = null;
    let height = null;
    
    for (let i = 0; i < frameTexts.length; i++) {
        const frameText = frameTexts[i].trim();
        if (!frameText) continue;
        
        // Parse this frame
        const lines = frameText.split('\n').map(line => line.trim()).filter(line => line);
        
        if (lines.length === 0) continue;
        
        // Parse each line into cells
        const grid = [];
        for (const line of lines) {
            const row = [];
            const chars = line.split(/\s+/); // Split by whitespace
            
            for (const char of chars) {
                if (char in CHAR_TO_CELL) {
                    row.push(CHAR_TO_CELL[char]);
                } else {
                    throw new Error(`Unknown character '${char}' in grid`);
                }
            }
            
            grid.push(row);
        }
        
        // Check dimensions
        if (width === null) {
            width = grid[0].length;
            height = grid.length;
        } else {
            if (grid.length !== height) {
                throw new Error(`Frame ${i + 1} has wrong height: expected ${height}, got ${grid.length}`);
            }
            if (grid[0].length !== width) {
                throw new Error(`Frame ${i + 1} has wrong width: expected ${width}, got ${grid[0].length}`);
            }
        }
        
        // Verify all rows have same width
        for (let j = 0; j < grid.length; j++) {
            if (grid[j].length !== width) {
                throw new Error(`Frame ${i + 1}, row ${j + 1} has wrong width: expected ${width}, got ${grid[j].length}`);
            }
        }
        
        frames.push(grid);
    }
    
    if (frames.length === 0) {
        throw new Error('No valid frames found in sequence file');
    }
    
    return { width, height, frames };
}

/**
 * Convert filename to test name
 * @param {string} filename - e.g. "sand_falls_down.seq"
 * @returns {string} - e.g. "Sand Falls Down"
 */
export function filenameToTestName(filename) {
    return filename
        .replace(/\.seq$/, '')
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Load all .seq files from test_cases directory
 * @returns {Promise<Array<{name: string, filename: string, sequence: Object}>>}
 */
export async function loadAllTests() {
    // Load manifest file
    const manifestResponse = await fetch('test_cases/manifest.json');
    const seqFiles = await manifestResponse.json();
    
    // Load each file
    const tests = [];
    for (const filename of seqFiles) {
        try {
            const response = await fetch(`test_cases/${filename}`);
            const content = await response.text();
            const sequence = parseSeqFile(content);
            
            tests.push({
                name: filenameToTestName(filename),
                filename,
                sequence
            });
        } catch (error) {
            console.error(`Failed to load ${filename}:`, error);
        }
    }
    
    return tests;
}

