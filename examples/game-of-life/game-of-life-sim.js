/**
 * Conway's Game of Life Simulation Engine
 * A classic cellular automaton demonstrating emergence from simple rules
 * 
 * Rules: B3/S23 (Birth with 3 neighbors, Survival with 2 or 3 neighbors)
 */

import { GridSimulation } from '../../grid-simulation.js';

export class GameOfLifeSimulation extends GridSimulation {
    /**
     * Cell types for Game of Life - stores RGBA vec4 values directly
     */
    static CellType = {
        EMPTY: new Float32Array([0, 0, 0, 0]),
        ALIVE: new Float32Array([1, 0, 0, 0])
    };
    
    /**
     * Create a new Game of Life simulation
     * @param {number} width - Grid width
     * @param {number} height - Grid height
     * @param {Object} options - Optional configuration
     * @returns {Promise<GameOfLifeSimulation>} The simulation instance
     */
    static async create(width, height, options = {}) {
        // Use import.meta.url to get path relative to this module
        const shaderUrl = new URL('./game-of-life.glsl', import.meta.url);
        const shaderSource = await fetch(shaderUrl).then(r => r.text());
        return new GameOfLifeSimulation(width, height, shaderSource, options);
    }
    
    constructor(width, height, shaderSource, options = {}) {
        super({
            width,
            height,
            rule: shaderSource,
            cellTypes: GameOfLifeSimulation.CellType,  // Pass cell types to base class for reverse lookup
            initialState: options.initialState || 'empty',
            canvas: options.canvas
        });
    }
    
    // ============================================
    // No overrides needed - CellType values are already RGBA!
    // Users access via: GameOfLifeSimulation.CellType.ALIVE
    // Example: sim.setCell(x, y, GameOfLifeSimulation.CellType.ALIVE)
    // Base class handles everything.
    // ============================================
    
    /**
     * Randomize grid with given probability
     * @param {number} probability - Probability of cell being alive (0-1)
     */
    randomize(probability = 0.5) {
        const buffer = this.getCurrentBuffer();
        const { ALIVE, EMPTY } = this.constructor.CellType;
        for (let i = 0; i < this.width * this.height; i++) {
            const cellType = Math.random() < probability ? ALIVE : EMPTY;
            buffer.set(cellType, i * 4);
        }
        this.syncBuffer(buffer);
    }
    
    /**
     * Count alive cells
     * @returns {number} Number of alive cells
     */
    countAlive() {
        return this.countWhere(cell => cell[0] > 0.5);
    }
    
    // ============================================
    // Convenience Methods
    // ============================================
    
    /**
     * Check if cell is alive
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {boolean} True if cell is alive
     */
    isAlive(x, y) {
        const state = this.getCellState(x, y);  // Returns RGBA vec4
        return state[0] > 0.5;  // Check R channel
    }
}
