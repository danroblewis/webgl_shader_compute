/**
 * Conway's Game of Life Simulation Engine
 * A classic cellular automaton demonstrating emergence from simple rules
 * 
 * Rules: B3/S23 (Birth with 3 neighbors, Survival with 2 or 3 neighbors)
 */

import { GridSimulation } from '../../grid-simulation.js';

// Cell type enumeration
const CellType = {
    EMPTY: 0,
    ALIVE: 1
};

export class GameOfLifeSimulation extends GridSimulation {
    /**
     * Cell types for Game of Life
     */
    static CellType = CellType;
    
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
            initialState: options.initialState || 'empty',
            canvas: options.canvas
        });
    }
    
    // ============================================
    // Cell Type Conversion
    // ============================================
    
    /**
     * Convert cell type enum to RGBA vec4
     * @param {number} cellType - CellType enum value
     * @returns {Array<number>} RGBA vec4 [r, g, b, a]
     */
    #cellTypeToRGBA(cellType) {
        switch (cellType) {
            case CellType.EMPTY:
                return [0, 0, 0, 0];
            case CellType.ALIVE:
                return [1, 0, 0, 0];
            default:
                throw new Error(`Invalid cell type: ${cellType}`);
        }
    }
    
    /**
     * Convert RGBA vec4 to cell type enum
     * @param {Array<number>} rgba - RGBA vec4 [r, g, b, a]
     * @returns {number} CellType enum value
     */
    #rgbaToCellType(rgba) {
        return rgba[0] > 0.5 ? CellType.ALIVE : CellType.EMPTY;
    }
    
    // ============================================
    // Overridden Methods - Binary Interface
    // ============================================
    
    /**
     * Get cell type at position
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {number} CellType enum value
     */
    getCellState(x, y) {
        const rgba = super.getCellState(x, y);
        return this.#rgbaToCellType(rgba);
    }
    
    /**
     * Set cell type at position
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} cellType - CellType enum value
     */
    setCell(x, y, cellType) {
        const rgba = this.#cellTypeToRGBA(cellType);
        super.setCell(x, y, rgba);
    }
    
    /**
     * Fill rectangular region with cell type
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} w - Width
     * @param {number} h - Height
     * @param {number} cellType - CellType enum value
     */
    fillRect(x, y, w, h, cellType) {
        const rgba = this.#cellTypeToRGBA(cellType);
        super.fillRect(x, y, w, h, rgba);
    }
    
    /**
     * Fill circular region with cell type
     * @param {number} cx - Center X
     * @param {number} cy - Center Y
     * @param {number} radius - Radius
     * @param {number} cellType - CellType enum value
     */
    fillCircle(cx, cy, radius, cellType) {
        const rgba = this.#cellTypeToRGBA(cellType);
        super.fillCircle(cx, cy, radius, rgba);
    }
    
    /**
     * Randomize grid with given probability
     * @param {number} probability - Probability of cell being alive (0-1)
     */
    randomize(probability = 0.5) {
        const buffer = this.getCurrentBuffer();
        for (let i = 0; i < this.width * this.height; i++) {
            const alive = Math.random() < probability ? 1.0 : 0.0;
            buffer[i * 4] = alive;
            buffer[i * 4 + 1] = 0.0;
            buffer[i * 4 + 2] = 0.0;
            buffer[i * 4 + 3] = 0.0;
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
        return this.getCellState(x, y) === CellType.ALIVE;
    }
    
    /**
     * Toggle cell state
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    toggleCell(x, y) {
        const current = this.getCellState(x, y);
        this.setCell(x, y, current === CellType.ALIVE ? CellType.EMPTY : CellType.ALIVE);
    }
}
