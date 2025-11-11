import { GridSimulation } from '../../grid-simulation.js';

/**
 * GPUBatchTester - Ultra-fast GPU-based batch test execution
 * 
 * Packs all tests into texture atlas, runs simulations in parallel,
 * uses GPU shaders to compare results, and reads back minimal data.
 * 
 * This is MUCH faster than CPU-based testing but provides less debugging info.
 */
export class GPUBatchTester {
    constructor(cellTypeDefinition, glslShader, canvas) {
        this.cellTypeDefinition = cellTypeDefinition;
        this.glslShader = glslShader;
        this.canvas = canvas;
        this.CellTypeClass = null;
        
        // Test atlas layout info
        this.atlasLayout = null;
        this.expectedFrameTextures = [];
        
        // Reusable simulation (to avoid creating/destroying on every test)
        this.simulation = null;
        this.currentAtlasSize = null;
        
        this.#initialize();
    }
    
    #initialize() {
        // Create CellType from definition
        try {
            const CellType = eval(`(${this.cellTypeDefinition})`);
            const canvasElement = this.canvas;
            
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
     * Calculate optimal atlas layout for test cases
     * Packs tests efficiently into a single texture
     */
    #calculateAtlasLayout(testCases) {
        // For now, simple horizontal packing
        // TODO: Could optimize with 2D bin packing for many tests
        
        let totalWidth = 0;
        let maxHeight = 0;
        const testLayouts = [];
        
        for (const test of testCases) {
            testLayouts.push({
                name: test.name,
                x: totalWidth,
                y: 0,
                width: test.width,
                height: test.height,
                frames: test.frames
            });
            
            totalWidth += test.width;
            maxHeight = Math.max(maxHeight, test.height);
        }
        
        // Round up to power of 2 for better GPU performance
        const atlasWidth = Math.pow(2, Math.ceil(Math.log2(totalWidth)));
        const atlasHeight = Math.pow(2, Math.ceil(Math.log2(maxHeight)));
        
        return {
            width: atlasWidth,
            height: atlasHeight,
            tests: testLayouts
        };
    }
    
    /**
     * Pack initial states into atlas texture
     */
    #packInitialStates(layout) {
        const data = new Float32Array(layout.width * layout.height * 4);
        data.fill(0); // Initialize to EMPTY
        
        for (const test of layout.tests) {
            const frame0 = test.frames[0];
            
            // Copy test data into atlas
            for (let y = 0; y < test.height; y++) {
                for (let x = 0; x < test.width; x++) {
                    const atlasX = test.x + x;
                    const atlasY = test.y + (test.height - 1 - y); // Flip Y for WebGL
                    const atlasIdx = (atlasY * layout.width + atlasX) * 4;
                    
                    const cellValue = frame0[y][x];
                    data[atlasIdx + 0] = cellValue; // cell type
                    data[atlasIdx + 1] = 0;
                    data[atlasIdx + 2] = 0;
                    data[atlasIdx + 3] = 1;
                }
            }
        }
        
        return data;
    }
    
    /**
     * Create textures for expected frames
     * One texture per frame index (frame 1, frame 2, etc.)
     */
    #createExpectedFrameTextures(layout) {
        // Find max number of frames across all tests
        const maxFrames = Math.max(...layout.tests.map(t => t.frames.length));
        const textures = [];
        
        for (let frameIdx = 1; frameIdx < maxFrames; frameIdx++) {
            const data = new Float32Array(layout.width * layout.height * 4);
            data.fill(-1); // -1 = no test at this location
            
            for (const test of layout.tests) {
                if (frameIdx < test.frames.length) {
                    const frame = test.frames[frameIdx];
                    
                    for (let y = 0; y < test.height; y++) {
                        for (let x = 0; x < test.width; x++) {
                            const atlasX = test.x + x;
                            const atlasY = test.y + (test.height - 1 - y);
                            const atlasIdx = (atlasY * layout.width + atlasX) * 4;
                            
                            const cellValue = frame[y][x];
                            data[atlasIdx + 0] = cellValue;
                            data[atlasIdx + 1] = 0;
                            data[atlasIdx + 2] = 0;
                            data[atlasIdx + 3] = 1;
                        }
                    }
                }
            }
            
            textures.push(data);
        }
        
        return textures;
    }
    
    /**
     * Check each test individually for mismatches
     * Returns map of test index to mismatch count
     */
    #checkTests(sim, expectedData, testLayout) {
        const actualData = sim.getCurrentBuffer();
        const results = new Map();
        
        for (let testIdx = 0; testIdx < testLayout.tests.length; testIdx++) {
            const test = testLayout.tests[testIdx];
            let mismatches = 0;
            
            for (let y = 0; y < test.height; y++) {
                for (let x = 0; x < test.width; x++) {
                    const atlasX = test.x + x;
                    const atlasY = test.y + y;
                    const idx = (atlasY * testLayout.width + atlasX) * 4;
                    
                    const actual = actualData[idx];
                    const expected = expectedData[idx];
                    
                    // Skip if no expected value (-1)
                    if (expected >= 0 && Math.abs(actual - expected) > 0.01) {
                        mismatches++;
                    }
                }
            }
            
            results.set(testIdx, mismatches);
        }
        
        return results;
    }
    
    /**
     * Get or create simulation for the given atlas size
     * Reuses existing simulation if size matches
     */
    #getSimulation(width, height) {
        const sizeKey = `${width}x${height}`;
        
        // If size changed or shader changed, recreate simulation
        if (!this.simulation || this.currentAtlasSize !== sizeKey) {
            // Dispose old simulation
            if (this.simulation) {
                this.simulation.dispose();
            }
            
            // Create new simulation
            this.simulation = new this.CellTypeClass(width, height, this.glslShader);
            this.currentAtlasSize = sizeKey;
        }
        
        return this.simulation;
    }
    
    /**
     * Run all tests in batch on GPU
     * Returns minimal results (pass/fail per test)
     */
    runBatch(testCases) {
        if (testCases.length === 0) {
            return {
                passed: 0,
                failed: 0,
                total: 0,
                correctTransitions: 0,
                totalTransitions: 0,
                results: []
            };
        }
        
        // Calculate layout and pack tests
        const layout = this.#calculateAtlasLayout(testCases);
        const initialState = this.#packInitialStates(layout);
        const expectedFrames = this.#createExpectedFrameTextures(layout);
        
        // Get or create reusable simulation
        const sim = this.#getSimulation(layout.width, layout.height);
        
        try {
            // Load initial state
            sim.syncBuffer(initialState);
            
            // Track results per test
            const testResults = layout.tests.map(test => ({
                name: test.name,
                totalFrames: test.frames.length - 1,
                correctFrames: 0,
                firstError: null
            }));
            
            // Step through each frame and compare
            for (let frameIdx = 0; frameIdx < expectedFrames.length; frameIdx++) {
                // Run simulation step
                sim.step(1);
                
                // Check each test individually
                const testMismatches = this.#checkTests(sim, expectedFrames[frameIdx], layout);
                
                // Update each test's results
                for (let testIdx = 0; testIdx < testResults.length; testIdx++) {
                    const result = testResults[testIdx];
                    
                    // Skip if this test doesn't have this frame
                    if (frameIdx >= result.totalFrames) {
                        continue;
                    }
                    
                    const mismatches = testMismatches.get(testIdx) || 0;
                    
                    if (mismatches === 0) {
                        // This test passed this frame
                        result.correctFrames++;
                    } else if (result.firstError === null) {
                        // First error for this test
                        result.firstError = `Frame ${frameIdx + 1}: ${mismatches} mismatch(es)`;
                    }
                }
            }
            
            // NOTE: Don't dispose sim - we reuse it across batches!
            
            // Calculate summary statistics
            let passed = 0;
            let failed = 0;
            let correctTransitions = 0;
            let totalTransitions = 0;
            
            const results = testResults.map(result => {
                const testPassed = result.correctFrames === result.totalFrames;
                if (testPassed) {
                    passed++;
                } else {
                    failed++;
                }
                
                correctTransitions += result.correctFrames;
                totalTransitions += result.totalFrames;
                
                return {
                    name: result.name,
                    passed: testPassed,
                    error: result.firstError,
                    correctTransitions: result.correctFrames,
                    totalTransitions: result.totalFrames
                };
            });
            
            return {
                passed,
                failed,
                total: testCases.length,
                correctTransitions,
                totalTransitions,
                results
            };
            
        } catch (error) {
            // NOTE: Don't dispose sim - we reuse it across batches!
            
            // Return all tests as failed
            return {
                passed: 0,
                failed: testCases.length,
                total: testCases.length,
                correctTransitions: 0,
                totalTransitions: testCases.reduce((sum, t) => sum + t.frames.length - 1, 0),
                results: testCases.map(t => ({
                    name: t.name,
                    passed: false,
                    error: error.message,
                    correctTransitions: 0,
                    totalTransitions: t.frames.length - 1
                }))
            };
        }
    }
    
    /**
     * Update shader and reinitialize
     */
    updateShader(newShader) {
        this.glslShader = newShader;
        // Force recreation of simulation on next runBatch
        if (this.simulation) {
            this.simulation.dispose();
            this.simulation = null;
            this.currentAtlasSize = null;
        }
    }
    
    /**
     * Update cell type definition and reinitialize
     */
    updateCellTypes(newDefinition) {
        this.cellTypeDefinition = newDefinition;
        // Dispose existing simulation
        if (this.simulation) {
            this.simulation.dispose();
            this.simulation = null;
            this.currentAtlasSize = null;
        }
        this.#initialize();
    }
    
    /**
     * Clean up GPU resources
     */
    dispose() {
        if (this.simulation) {
            this.simulation.dispose();
            this.simulation = null;
            this.currentAtlasSize = null;
        }
    }
}

