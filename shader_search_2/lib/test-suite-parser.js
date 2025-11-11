/**
 * Parser for test_suite.txt format
 * Format: TEST: name\nGRID: WxH\n\nFRAME:\ngrid...\n\nFRAME:\ngrid...
 */

// Map characters to cell type indices
const CHAR_TO_CELL = {
    '.': 0,  // EMPTY
    's': 1,  // SAND
    'S': 1,  // SAND (alternate)
    '#': 2   // STONE
};

/**
 * Parse grid lines into a 2D array
 */
function parseGridLines(lines) {
    const grid = [];
    for (const line of lines) {
        const row = [];
        const chars = line.split(/\s+/);
        for (const char of chars) {
            const cellType = CHAR_TO_CELL[char];
            if (cellType !== undefined) {
                row.push(cellType);
            }
        }
        if (row.length > 0) {
            grid.push(row);
        }
    }
    return grid;
}

/**
 * Parse test_suite.txt format into test cases
 * @param {string} content - Content of test_suite.txt
 * @returns {Array<{name: string, width: number, height: number, frames: Array}>}
 */
export function parseTestSuite(content) {
    const tests = [];
    const testBlocks = content.split(/TEST:/);
    
    for (const block of testBlocks) {
        if (!block.trim()) continue;
        
        const lines = block.trim().split('\n');
        const testName = lines[0].trim();
        
        // Find GRID: line
        const gridLine = lines.find(l => l.trim().startsWith('GRID:'));
        if (!gridLine) continue;
        
        const [width, height] = gridLine.split(':')[1].trim().toLowerCase().split('x').map(Number);
        
        // Parse frames
        const frames = [];
        let currentFrame = [];
        let inFrame = false;
        
        for (const line of lines) {
            if (line.trim().startsWith('FRAME:')) {
                if (currentFrame.length > 0) {
                    frames.push(parseGridLines(currentFrame));
                    currentFrame = [];
                }
                inFrame = true;
            } else if (inFrame && line.trim()) {
                currentFrame.push(line.trim());
            }
        }
        
        if (currentFrame.length > 0) {
            frames.push(parseGridLines(currentFrame));
        }
        
        if (frames.length > 0) {
            tests.push({
                name: testName,
                width,
                height,
                frames
            });
        }
    }
    
    return tests;
}

/**
 * Load test suite from file or localStorage
 * @param {string} [customContent] - Optional custom test suite content
 * @returns {Promise<Array<TestCase>>}
 */
export async function loadTestSuite(customContent = null) {
    // Use custom content if provided
    if (customContent) {
        return parseTestSuite(customContent);
    }
    
    // Check localStorage
    const stored = localStorage.getItem('customTestSuite');
    if (stored) {
        try {
            return parseTestSuite(stored);
        } catch (error) {
            console.error('Failed to parse stored test suite:', error);
        }
    }
    
    // Load from file
    try {
        const response = await fetch('../shader_search/test_suite.txt');
        const content = await response.text();
        return parseTestSuite(content);
    } catch (error) {
        console.error('Failed to load test_suite.txt:', error);
        return [];
    }
}

export { CHAR_TO_CELL };

