import { GridSimulation } from '../grid-simulation.js';
import { loadAllTests } from './seq-parser.js';

// Cell type constants
const CellType = {
    EMPTY: 0,
    SAND: 1,
    STONE: 2
};

// Test simulation class - extends GridSimulation with single-value cell API
class TestSimulation extends GridSimulation {
    constructor(width, height, fragmentShader) {
        super({
            width,
            height,
            canvas: document.getElementById('canvas'),
            rule: fragmentShader,
            initialState: new Float32Array(width * height * 4) // Empty
        });
    }
    
    // Override setCell to accept single value instead of RGBA array
    setCell(x, y, value) {
        // Convert single value to RGBA array
        super.setCell(x, y, [value, 0, 0, 1]);
    }
    
    // Add getCell method that returns single value
    getCell(x, y) {
        const rgba = this.getCellState(x, y);
        return rgba[0]; // Return just the R component
    }
    
    // Get entire grid as 2D array of single values
    getGrid() {
        const buffer = this.getCurrentBuffer();
        
        // Return grid in reading order (top to bottom)
        // Don't reverse - read directly in order
        const grid = [];
        for (let y = 0; y < this.height; y++) {
            const row = [];
            for (let x = 0; x < this.width; x++) {
                const idx = (y * this.width + x) * 4;
                row.push(buffer[idx]); // Just the R component
            }
            grid.push(row);
        }
        return grid;
    }
}

// Visualization
function gridToString(grid) {
    const symbols = {
        [CellType.EMPTY]: '·',
        [CellType.SAND]: 'S',
        [CellType.STONE]: '#'
    };
    
    // Grid is already in reading order (top to bottom)
    // Don't reverse - display as-is so floor appears at bottom
    return grid.map(row =>
        row.map(cell => symbols[cell] || '?').join('')
    ).join('\n');
}

// Render grid as HTML divs with colors
function gridToHTML(grid) {
    const colors = {
        [CellType.EMPTY]: '#1e1e1e',
        [CellType.SAND]: '#f4d03f',
        [CellType.STONE]: '#808080'
    };
    
    const cellSize = 20; // pixels
    const width = grid[0]?.length || 0;
    const height = grid.length;
    
    let html = `<div style="display: inline-block; border: 1px solid #3e3e42;">`;
    
    for (let y = 0; y < height; y++) {
        html += `<div style="display: flex; height: ${cellSize}px;">`;
        for (let x = 0; x < width; x++) {
            const cell = grid[y][x];
            const color = colors[cell] || '#ff00ff';
            html += `<div style="width: ${cellSize}px; height: ${cellSize}px; background-color: ${color}; border: 1px solid #00000033;"></div>`;
        }
        html += `</div>`;
    }
    
    html += `</div>`;
    return html;
}

// Helper to load grid into simulation
function loadGridIntoSim(sim, grid) {
    // Grid is in reading order (top to bottom)
    // DON'T flip - just load directly
    // First line in file (y=0) goes to simY=0
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < grid[y].length; x++) {
            const value = grid[y][x];
            sim.setCell(x, y, value);
        }
    }
}

// Helper to compare two grids
function compareGrids(actual, expected) {
    if (actual.length !== expected.length) {
        return { match: false, reason: `Height mismatch: ${actual.length} vs ${expected.length}` };
    }
    
    for (let y = 0; y < actual.length; y++) {
        if (actual[y].length !== expected[y].length) {
            return { match: false, reason: `Width mismatch at row ${y}: ${actual[y].length} vs ${expected[y].length}` };
        }
        
        for (let x = 0; x < actual[y].length; x++) {
            if (actual[y][x] !== expected[y][x]) {
                // Convert to reading coordinates for error message
                const readingY = actual.length - 1 - y;
                return {
                    match: false,
                    reason: `Cell mismatch at (${x}, ${readingY}): expected ${expected[y][x]}, got ${actual[y][x]}`
                };
            }
        }
    }
    
    return { match: true };
}

// Test framework
class TestRunner {
    constructor() {
        this.tests = [];
        this.results = [];
        this.testDetails = []; // Store detailed results for each test
        this.currentVisualization = null;
        this.animationState = {
            frames: [],
            currentFrame: 0,
            isPlaying: false,
            intervalId: null,
            speed: 100 // ms per frame
        };
    }
    
    test(name, description, fn) {
        this.tests.push({ name, description, fn });
    }
    
    async runAll(fastMode = true) {
        this.results = [];
        this.testDetails = [];
        const testListEl = document.getElementById('testList');
        testListEl.innerHTML = '';
        
        // Create test item elements
        const testElements = this.tests.map((test, idx) => {
            const el = document.createElement('div');
            el.className = 'test-item';
            el.innerHTML = `<div class="test-name">${idx + 1}. ${test.name}</div>`;
            testListEl.appendChild(el);
            return el;
        });
        
        // Run tests
        for (let i = 0; i < this.tests.length; i++) {
            const test = this.tests[i];
            const el = testElements[i];
            
            el.className = 'test-item running';
            
            const details = {
                name: test.name,
                frames: [],
                testIndex: i
            };
            
            try {
                if (fastMode) {
                    // Fast mode: no visualization, no intermediate checks
                    await test.fn(null); // null callback = skip visualization
                } else {
                    // Slow mode: capture all frames for debugging
                    await test.fn((msg, grid) => {
                        this.visualize(msg, grid);
                        details.frames.push({ msg, grid: JSON.parse(JSON.stringify(grid)) });
                    });
                }
                
                el.className = 'test-item passed';
                this.results.push({ name: test.name, passed: true });
                details.passed = true;
            } catch (error) {
                el.className = 'test-item failed';
                this.results.push({ name: test.name, passed: false, error: error.message });
                details.passed = false;
                details.error = error.message;
            }
            
            this.testDetails.push(details);
            
            // Add click handler to re-run test in detailed mode
            el.addEventListener('click', async () => {
                await this.runSingleTestDetailed(i);
            });
        }
        
        this.showSummary();
    }
    
    async runSingleTestDetailed(testIndex) {
        const test = this.tests[testIndex];
        
        document.getElementById('stepInfo').textContent = `Re-running: ${test.name}...`;
        document.getElementById('gridDisplay').textContent = 'Running detailed test...';
        
        const details = {
            name: test.name,
            frames: [],
            actualFrames: [],
            expectedFrames: []
        };
        
        try {
            // Re-run test with full visualization
            await test.fn((msg, grid, expected) => {
                details.frames.push({ msg, grid: JSON.parse(JSON.stringify(grid)) });
                if (expected) {
                    details.expectedFrames.push({ msg, expected: JSON.parse(JSON.stringify(expected)) });
                }
            });
            details.passed = true;
        } catch (error) {
            details.passed = false;
            details.error = error.message;
        }
        
        // Display detailed results
        this.showDetailedTestResults(details);
    }
    
    visualize(stepInfo, grid) {
        document.getElementById('stepInfo').textContent = stepInfo;
        document.getElementById('gridDisplay').textContent = gridToString(grid);
    }
    
    showTestDetails(testIndex) {
        // This is now handled by runSingleTestDetailed
        this.runSingleTestDetailed(testIndex);
    }
    
    showDetailedTestResults(details) {
        // Stop any existing animation
        this.stopAnimation();
        
        // Prepare frames for animation
        this.animationState.frames = details.frames.map((frame, idx) => ({
            msg: frame.msg,
            actual: frame.grid,
            expected: details.expectedFrames[idx]?.expected || null
        }));
        
        this.animationState.currentFrame = 0;
        this.animationState.testName = details.name;
        this.animationState.testStatus = details.passed ? '✅ PASSED' : `❌ FAILED`;
        this.animationState.testError = details.error || '';
        
        // Setup controls - animation controls at top
        document.getElementById('stepInfo').innerHTML = `
            <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 10px;">
                <button id="animPlayPause" style="padding: 5px 15px;">▶️ Play</button>
                <button id="animPrev" style="padding: 5px 10px;">⏮</button>
                <button id="animNext" style="padding: 5px 10px;">⏭</button>
                <span id="animFrameInfo" style="color: #858585;"></span>
                <label style="margin-left: auto; color: #858585;">
                    Speed: 
                    <select id="animSpeed" style="background: #2d2d30; color: #d4d4d4; border: 1px solid #3e3e42; padding: 2px;">
                        <option value="500">Slow</option>
                        <option value="250">Normal</option>
                        <option value="100" selected>Fast</option>
                        <option value="50">Very Fast</option>
                    </select>
                </label>
            </div>
        `;
        
        // Create status area after gridDisplay if it doesn't exist
        let statusDiv = document.getElementById('animStatusInfo');
        if (!statusDiv) {
            statusDiv = document.createElement('div');
            statusDiv.id = 'animStatusInfo';
            statusDiv.style.marginTop = '15px';
            statusDiv.style.paddingTop = '15px';
            statusDiv.style.borderTop = '1px solid #3e3e42';
            document.getElementById('gridDisplay').parentElement.appendChild(statusDiv);
        }
        
        // Setup event listeners
        document.getElementById('animPlayPause').addEventListener('click', () => this.toggleAnimation());
        document.getElementById('animPrev').addEventListener('click', () => this.prevFrame());
        document.getElementById('animNext').addEventListener('click', () => this.nextFrame());
        document.getElementById('animSpeed').addEventListener('change', (e) => {
            this.animationState.speed = parseInt(e.target.value);
            if (this.animationState.isPlaying) {
                this.stopAnimation();
                this.startAnimation();
            }
        });
        
        // Show first frame (will include status at bottom)
        this.renderCurrentFrame();
        
        // Auto-play
        this.startAnimation();
        document.getElementById('animPlayPause').textContent = '⏸️ Pause';
    }
    
    renderCurrentFrame() {
        const frame = this.animationState.frames[this.animationState.currentFrame];
        if (!frame) return;
        
        const gridDisplayEl = document.getElementById('gridDisplay');
        
        let html = `<div style="margin-bottom: 15px; color: #d4d4d4;">${frame.msg}</div>`;
        
        if (frame.expected) {
            // Show actual and expected side-by-side
            html += `<div style="display: flex; gap: 30px; justify-content: center;">`;
            html += `<div>${gridToHTML(frame.actual)}</div>`;
            html += `<div>${gridToHTML(frame.expected)}</div>`;
            html += `</div>`;
        } else {
            html += `<div style="display: flex; justify-content: center;">${gridToHTML(frame.actual)}</div>`;
        }
        
        gridDisplayEl.innerHTML = html;
        document.getElementById('animFrameInfo').textContent = 
            `Frame ${this.animationState.currentFrame + 1} / ${this.animationState.frames.length}`;
        
        // Update status in separate area
        const statusDiv = document.getElementById('animStatusInfo');
        if (statusDiv) {
            let statusText = `${this.animationState.testStatus} ${this.animationState.testName}`;
            if (this.animationState.testError) {
                statusText += `\n${this.animationState.testError}`;
            }
            statusDiv.textContent = statusText;
        }
    }
    
    toggleAnimation() {
        if (this.animationState.isPlaying) {
            this.stopAnimation();
            document.getElementById('animPlayPause').textContent = '▶️ Play';
        } else {
            this.startAnimation();
            document.getElementById('animPlayPause').textContent = '⏸️ Pause';
        }
    }
    
    startAnimation() {
        this.animationState.isPlaying = true;
        this.animationState.intervalId = setInterval(() => {
            if (this.animationState.currentFrame < this.animationState.frames.length - 1) {
                this.nextFrame();
            } else {
                // Loop back to start
                this.animationState.currentFrame = 0;
                this.renderCurrentFrame();
            }
        }, this.animationState.speed);
    }
    
    stopAnimation() {
        this.animationState.isPlaying = false;
        if (this.animationState.intervalId) {
            clearInterval(this.animationState.intervalId);
            this.animationState.intervalId = null;
        }
    }
    
    nextFrame() {
        if (this.animationState.currentFrame < this.animationState.frames.length - 1) {
            this.animationState.currentFrame++;
            this.renderCurrentFrame();
        }
    }
    
    prevFrame() {
        if (this.animationState.currentFrame > 0) {
            this.animationState.currentFrame--;
            this.renderCurrentFrame();
        }
    }
    
    showSummary() {
        const passed = this.results.filter(r => r.passed).length;
        const failed = this.results.filter(r => !r.passed).length;
        
        const summaryEl = document.getElementById('summary');
        const summaryTextEl = document.getElementById('summaryText');
        
        summaryEl.style.display = 'block';
        summaryTextEl.textContent = `${passed} passed, ${failed} failed`;
        
        if (failed === 0) {
            summaryEl.className = 'summary all-passed';
        } else {
            summaryEl.className = 'summary has-failures';
        }
    }
    
    clear() {
        this.results = [];
        this.testDetails = [];
        document.getElementById('testList').innerHTML = '';
        document.getElementById('summary').style.display = 'none';
        document.getElementById('gridDisplay').textContent = '';
        document.getElementById('stepInfo').textContent = '';
    }
    
    /**
     * Run all tests with a given GLSL shader (for genetic algorithm)
     * Returns: { passed: number, failed: number, total: number }
     */
    async runAllWithGLSL(glslShader) {
        let passed = 0;
        let failed = 0;
        
        for (let i = 0; i < this.tests.length; i++) {
            const test = this.tests[i];
            try {
                await test.fn(null, glslShader); // null = no visualization, custom shader
                passed++;
            } catch (error) {
                failed++;
            }
            
            // Yield to browser every few tests to keep UI responsive
            if (i % 3 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
        
        return {
            passed,
            failed,
            total: this.tests.length
        };
    }
}

// Load shader
async function loadShader(path) {
    const response = await fetch(path);
    return await response.text();
}

// Main
(async () => {
    const runner = new TestRunner();
    
    // Load the GLSL shader
    const shaderSource = await loadShader('basic-sim.glsl');
    
    // Load all test sequences
    console.log('📂 Loading test cases from .seq files...');
    const testCases = await loadAllTests();
    console.log(`✅ Loaded ${testCases.length} test cases`);
    
    // Create tests from sequences
    for (const testCase of testCases) {
        const { name, filename, sequence } = testCase;
        const { width, height, frames } = sequence;
        
        const description = `${frames.length} frame sequence (${width}×${height})`;
        
        runner.test(name, description, async (visualize, customShader) => {
            const shader = customShader || shaderSource;
            const sim = new TestSimulation(width, height, shader);
            
            // Load initial state (frame 0)
            loadGridIntoSim(sim, frames[0]);
            
            if (visualize) {
                // Detailed mode: check every frame
                visualize(`Frame 1:`, sim.getGrid(), frames[0]);
                
                // Verify initial state matches
                const initialGrid = sim.getGrid();
                const initialCheck = compareGrids(initialGrid, frames[0]);
                
                let errors = [];
                if (!initialCheck.match) {
                    errors.push(`Initial state mismatch: ${initialCheck.reason}`);
                }
                
                // Run simulation and check each frame (continue even if errors occur)
                for (let i = 1; i < frames.length; i++) {
                    sim.step();
                    
                    const actualGrid = sim.getGrid();
                    visualize(`Frame ${i+1}:`, actualGrid, frames[i]);
                    
                    const check = compareGrids(actualGrid, frames[i]);
                    if (!check.match) {
                        errors.push(`Frame ${i+1}: ${check.reason}`);
                    }
                }
                
                // If there were any errors, throw them all at once
                if (errors.length > 0) {
                    sim.dispose();
                    throw new Error(errors.join('\n'));
                }
            } else {
                // Fast mode: check every frame but without visualization
                // Verify initial state matches
                const initialGrid = sim.getGrid();
                const initialCheck = compareGrids(initialGrid, frames[0]);
                
                if (!initialCheck.match) {
                    sim.dispose();
                    throw new Error(`Initial state mismatch: ${initialCheck.reason}`);
                }
                
                // Run simulation and check each frame
                for (let i = 1; i < frames.length; i++) {
                    sim.step();
                    
                    const actualGrid = sim.getGrid();
                    const check = compareGrids(actualGrid, frames[i]);
                    
                    if (!check.match) {
                        sim.dispose();
                        throw new Error(`Frame ${i+1}: ${check.reason}`);
                    }
                }
            }
            
            sim.dispose();
        });
    }
    
    // Setup UI (only if elements exist)
    const runAllBtn = document.getElementById('runAllBtn');
    const clearBtn = document.getElementById('clearBtn');
    
    if (runAllBtn) {
        runAllBtn.addEventListener('click', () => {
            runner.runAll();
        });
    }
    
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            runner.clear();
        });
    }
    
    console.log('✅ Test runner initialized');
    console.log('📊 Loaded', runner.tests.length, 'tests');
    
    // Auto-run tests on load (only if in test UI)
    if (runAllBtn) {
        runner.runAll();
    }
    
    // Export for genetic algorithm (if running in module context)
    if (typeof window !== 'undefined') {
        window.TestRunner = TestRunner;
        window.testRunnerInstance = runner; // Export the actual initialized instance
    }
})();

// Also export for use as ES module
export { TestRunner, CellType };

