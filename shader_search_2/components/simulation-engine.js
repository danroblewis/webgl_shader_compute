import { GridSimulation } from '../../grid-simulation.js';

/**
 * SimulationEngine - Wrapper around GridSimulation for testing and interaction
 * 
 * Manages GridSimulation lifecycle and provides standardized test execution interface
 */
export class SimulationEngine {
    constructor(cellTypeDefinition, glslShader, canvas) {
        this.cellTypeDefinition = cellTypeDefinition;
        this.glslShader = glslShader;
        this.canvas = canvas;
        this.simulation = null;
        this.CellTypeClass = null;
        
        this.#initialize();
    }
    
    #initialize() {
        // Create CellType from definition by evaluating it
        try {
            // Create a temporary scope and evaluate the cell type definition
            const CellType = eval(`(${this.cellTypeDefinition})`);
            
            // Capture canvas in closure
            const canvasElement = this.canvas;
            
            // Create simulation class
            this.CellTypeClass = class extends GridSimulation {
                static CellType = CellType;
                
                constructor(width, height, fragmentShader) {
                    super({
                        width,
                        height,
                        canvas: canvasElement,
                        rule: fragmentShader,
                        initialState: new Float32Array(width * height * 4)
                    });
                }
            };
        } catch (error) {
            console.error('Failed to initialize cell types:', error);
            throw error;
        }
    }
    
    /**
     * Create a simulation instance for testing
     */
    #createSimulation(width, height) {
        return new this.CellTypeClass(width, height, this.glslShader);
    }
    
    /**
     * Load a grid into simulation (handles coordinate conversion)
     */
    #loadGrid(sim, grid) {
        // Grid is in reading order (top to bottom)
        // WebGL has Y=0 at bottom, so we flip
        for (let y = 0; y < grid.length; y++) {
            for (let x = 0; x < grid[y].length; x++) {
                const value = grid[y][x];
                const simY = grid.length - 1 - y;
                sim.setCell(x, simY, [value, 0, 0, 1]);
            }
        }
    }
    
    /**
     * Compare two grids (actual from getGrid(), expected from test)
     */
    #compareGrids(actual, expected) {
        if (actual.length !== expected.length) {
            return { match: false, reason: `Height mismatch: ${actual.length} vs ${expected.length}` };
        }
        
        for (let y = 0; y < actual.length; y++) {
            if (actual[y].length !== expected[y].length) {
                return { match: false, reason: `Width mismatch at row ${y}` };
            }
            
            for (let x = 0; x < actual[y].length; x++) {
                const actualValue = Array.isArray(actual[y][x]) ? actual[y][x][0] : actual[y][x];
                const expectedValue = expected[y][x];
                
                if (actualValue !== expectedValue) {
                    return {
                        match: false,
                        reason: `Cell mismatch at (${x}, ${y}): expected ${expectedValue}, got ${actualValue}`
                    };
                }
            }
        }
        
        return { match: true };
    }
    
    /**
     * Run a single test case
     * @param {Object} testCase - {name, width, height, frames}
     * @param {boolean} detailed - If true, returns frame-by-frame comparison
     * @returns {Object} - {passed, error, frames (if detailed)}
     */
    runTest(testCase, detailed = false) {
        const { width, height, frames } = testCase;
        const sim = this.#createSimulation(width, height);
        
        try {
            // Load initial state
            this.#loadGrid(sim, frames[0]);
            
            const results = {
                passed: true,
                error: null,
                frames: detailed ? [] : null,
                correctTransitions: 0,
                totalTransitions: frames.length - 1
            };
            
            if (detailed) {
                results.frames.push({
                    actual: sim.getGrid(),
                    expected: frames[0],
                    match: true
                });
            }
            
            // Run simulation and compare each frame
            for (let i = 1; i < frames.length; i++) {
                sim.step(1);
                const actualGrid = sim.getGrid();
                const check = this.#compareGrids(actualGrid, frames[i]);
                
                if (check.match) {
                    results.correctTransitions++;
                }
                
                if (detailed) {
                    results.frames.push({
                        actual: actualGrid,
                        expected: frames[i],
                        match: check.match,
                        error: check.reason
                    });
                }
                
                if (!check.match && !detailed) {
                    results.passed = false;
                    results.error = `Frame ${i}: ${check.reason}`;
                    break;
                }
            }
            
            if (detailed && results.correctTransitions < results.totalTransitions) {
                results.passed = false;
                results.error = `Failed ${results.totalTransitions - results.correctTransitions} frame(s)`;
            }
            
            sim.dispose();
            return results;
            
        } catch (error) {
            sim.dispose();
            return {
                passed: false,
                error: error.message,
                correctTransitions: 0,
                totalTransitions: frames.length - 1
            };
        }
    }
    
    /**
     * Run all test cases
     * @param {Array} testCases
     * @returns {Object} - {passed, failed, total, results}
     */
    runAllTests(testCases) {
        let passed = 0;
        let failed = 0;
        let correctTransitions = 0;
        let totalTransitions = 0;
        const results = [];
        
        for (const testCase of testCases) {
            const result = this.runTest(testCase, false);
            results.push({
                name: testCase.name,
                ...result
            });
            
            if (result.passed) {
                passed++;
            } else {
                failed++;
            }
            
            correctTransitions += result.correctTransitions;
            totalTransitions += result.totalTransitions;
        }
        
        return {
            passed,
            failed,
            total: testCases.length,
            correctTransitions,
            totalTransitions,
            results
        };
    }
    
    /**
     * Create an interactive simulation for drawing
     */
    createInteractive(width, height) {
        if (this.simulation) {
            this.simulation.dispose();
        }
        this.simulation = this.#createSimulation(width, height);
        return this.simulation;
    }
    
    /**
     * Get current simulation
     */
    getSimulation() {
        return this.simulation;
    }
    
    /**
     * Update shader and reinitialize
     */
    updateShader(newShader) {
        this.glslShader = newShader;
        if (this.simulation) {
            const oldSim = this.simulation;
            const width = oldSim.width;
            const height = oldSim.height;
            const state = oldSim.getCurrentBuffer();
            
            this.simulation = this.#createSimulation(width, height);
            this.simulation.syncBuffer(state);
            
            oldSim.dispose();
        }
    }
    
    /**
     * Update cell type definition and reinitialize
     */
    updateCellTypes(newDefinition) {
        this.cellTypeDefinition = newDefinition;
        this.#initialize();
        if (this.simulation) {
            const width = this.simulation.width;
            const height = this.simulation.height;
            const oldSim = this.simulation;
            
            this.simulation = this.#createSimulation(width, height);
            oldSim.dispose();
        }
    }
    
    /**
     * Dispose resources
     */
    dispose() {
        if (this.simulation) {
            this.simulation.dispose();
            this.simulation = null;
        }
    }
}

