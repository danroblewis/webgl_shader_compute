/**
 * Conway's Game of Life Simulation Engine
 * A classic cellular automaton demonstrating emergence from simple rules
 * 
 * Rules: B3/S23 (Birth with 3 neighbors, Survival with 2 or 3 neighbors)
 */

import { GridSimulation } from '../../grid-simulation.js';

export class GameOfLifeSimulation extends GridSimulation {
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
}

