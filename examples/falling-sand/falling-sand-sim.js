/**
 * Falling Sand Simulation Engine
 * Physics simulation with multiple particle types (sand, water, oil, stone, wood)
 */

import { GridSimulation } from '../../grid-simulation.js';

// Material types
export const MATERIALS = {
    EMPTY: 0.0,
    SAND: 1.0,
    WATER: 2.0,
    STONE: 3.0,
    WOOD: 4.0,
    OIL: 5.0
};

// Material colors for rendering
export const MATERIAL_COLORS = {
    [MATERIALS.EMPTY]: [10, 10, 10],
    [MATERIALS.SAND]: [194, 178, 128],
    [MATERIALS.WATER]: [74, 144, 226],
    [MATERIALS.STONE]: [102, 102, 102],
    [MATERIALS.WOOD]: [139, 69, 19],
    [MATERIALS.OIL]: [42, 42, 42]
};

export class FallingSandSimulation extends GridSimulation {
    /**
     * Create a new Falling Sand simulation
     * @param {number} width - Grid width
     * @param {number} height - Grid height
     * @param {Object} options - Optional configuration
     * @returns {Promise<FallingSandSimulation>} The simulation instance
     */
    static async create(width, height, options = {}) {
        const shaderSource = await fetch('./falling-sand.glsl').then(r => r.text());
        return new FallingSandSimulation(width, height, shaderSource, options);
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
    
    /**
     * Place material in a circular brush pattern
     */
    placeMaterial(x, y, material, brushSize = 1) {
        const buffer = this.getCurrentBuffer();
        
        for (let dy = -brushSize; dy <= brushSize; dy++) {
            for (let dx = -brushSize; dx <= brushSize; dx++) {
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist <= brushSize) {
                    const px = x + dx;
                    const py = y + dy;
                    
                    if (px >= 0 && px < this.width && py >= 0 && py < this.height) {
                        buffer[py * this.width + px] = material;
                    }
                }
            }
        }
        
        this.syncBuffer(buffer);
    }
}

