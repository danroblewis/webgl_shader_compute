/**
 * Conway's Game of Life Simulation Engine
 * A classic cellular automaton demonstrating emergence from simple rules
 */

import { GridSimulation } from '../../grid-simulation.js';

const GAME_OF_LIFE_SHADER = `
    precision highp float;
    uniform sampler2D u_state;
    uniform float u_width;
    uniform float u_height;
    varying vec2 v_texCoord;
    
    void main() {
        float cellWidth = 1.0 / u_width;
        float cellHeight = 1.0 / u_height;
        
        // Count neighbors
        int neighbors = 0;
        for (int y = -1; y <= 1; y++) {
            for (int x = -1; x <= 1; x++) {
                if (x == 0 && y == 0) continue;
                
                vec2 offset = vec2(float(x) * cellWidth, float(y) * cellHeight);
                vec2 coord = v_texCoord + offset;
                
                // Wrap coordinates (toroidal topology)
                coord = fract(coord);
                
                float cell = texture2D(u_state, coord).r;
                if (cell > 0.5) neighbors++;
            }
        }
        
        float current = texture2D(u_state, v_texCoord).r;
        float alive = 0.0;
        
        // Conway's rules: B3/S23
        // Birth if exactly 3 neighbors, Survival if 2 or 3 neighbors
        if (current > 0.5) {
            alive = (neighbors == 2 || neighbors == 3) ? 1.0 : 0.0;
        } else {
            alive = (neighbors == 3) ? 1.0 : 0.0;
        }
        
        gl_FragColor = vec4(alive, 0.0, 0.0, 1.0);
    }
`;

export class GameOfLifeSimulation {
    constructor(width, height, options = {}) {
        this.width = width;
        this.height = height;
        
        // Create underlying grid simulation
        this.sim = new GridSimulation({
            width,
            height,
            rule: GAME_OF_LIFE_SHADER,
            initialState: options.initialState || 'empty',
            canvas: options.canvas
        });
    }
    
    // === High-Level API ===
    
    /**
     * Add a glider pattern at the specified position
     */
    addGlider(x, y) {
        this.sim.setCell(x + 1, y, 1);
        this.sim.setCell(x + 2, y + 1, 1);
        this.sim.setCell(x, y + 2, 1);
        this.sim.setCell(x + 1, y + 2, 1);
        this.sim.setCell(x + 2, y + 2, 1);
    }
    
    /**
     * Add a blinker pattern (oscillator) at the specified position
     */
    addBlinker(x, y) {
        this.sim.setCell(x, y, 1);
        this.sim.setCell(x + 1, y, 1);
        this.sim.setCell(x + 2, y, 1);
    }
    
    /**
     * Add a block pattern (still life) at the specified position
     */
    addBlock(x, y) {
        this.sim.setCell(x, y, 1);
        this.sim.setCell(x + 1, y, 1);
        this.sim.setCell(x, y + 1, 1);
        this.sim.setCell(x + 1, y + 1, 1);
    }
    
    /**
     * Toggle cell state at the specified position
     */
    toggleCell(x, y) {
        const current = this.sim.getCellState(x, y);
        this.sim.setCell(x, y, current > 0.5 ? 0 : 1);
    }
    
    /**
     * Run simulation for N steps
     */
    step(count = 1) {
        this.sim.step(count);
    }
    
    /**
     * Randomize grid with given density
     */
    randomize(density = 0.3) {
        this.sim.randomize(density);
    }
    
    /**
     * Clear all cells
     */
    clear() {
        this.sim.clear();
    }
    
    /**
     * Get current generation number
     */
    get generation() {
        return this.sim.generation;
    }
    
    /**
     * Count alive cells
     */
    countAlive() {
        return this.sim.countAlive();
    }
    
    // === Performance API (Layer 2) ===
    
    /**
     * Get direct buffer access for efficient operations
     */
    getBuffer() {
        return this.sim.getCurrentBuffer();
    }
    
    /**
     * Sync modified buffer back to GPU
     */
    syncBuffer(buffer) {
        this.sim.syncBuffer(buffer);
    }
    
    // === GPU Access (Layer 1) ===
    
    /**
     * Get WebGL texture for custom rendering
     */
    getTexture() {
        return this.sim.getTexture();
    }
    
    /**
     * Get WebGL context
     */
    getContext() {
        return this.sim.getContext();
    }
    
    /**
     * Clean up resources
     */
    dispose() {
        this.sim.dispose();
    }
}

