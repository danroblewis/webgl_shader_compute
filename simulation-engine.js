/**
 * Base Simulation Engine
 * Provides common functionality for all simulation engines
 * 
 * Extend this class and provide:
 * - shader: GLSL fragment shader source
 * - width, height: grid dimensions
 * - Optional: initialState, canvas
 */

import { GridSimulation } from './grid-simulation.js';

export class SimulationEngine {
    constructor(config) {
        if (!config.shader) {
            throw new Error('SimulationEngine requires a "shader" (GLSL fragment shader source)');
        }
        
        this.width = config.width;
        this.height = config.height;
        
        // Create underlying grid simulation
        this.sim = new GridSimulation({
            width: config.width,
            height: config.height,
            rule: config.shader,
            initialState: config.initialState || 'empty',
            canvas: config.canvas,
            wrap: config.wrap
        });
    }
    
    // === Core Simulation Methods ===
    
    /**
     * Run simulation for N steps
     */
    step(count = 1) {
        this.sim.step(count);
    }
    
    /**
     * Clear all cells
     */
    clear() {
        this.sim.clear();
    }
    
    /**
     * Set individual cell value
     */
    setCell(x, y, value) {
        this.sim.setCell(x, y, value);
    }
    
    /**
     * Get individual cell value
     */
    getCellState(x, y) {
        return this.sim.getCellState(x, y);
    }
    
    /**
     * Fill rectangular region
     */
    fillRect(x, y, w, h, value) {
        this.sim.fillRect(x, y, w, h, value);
    }
    
    /**
     * Get current generation number
     */
    get generation() {
        return this.sim.generation;
    }
    
    // === Layer 2: Performance API (Buffer Access) ===
    
    /**
     * Get direct buffer access for efficient operations
     * Returns Float32Array view of GPU state
     */
    getBuffer() {
        return this.sim.getCurrentBuffer();
    }
    
    /**
     * Get a snapshot buffer (doesn't cache)
     */
    getSnapshotBuffer() {
        return this.sim.getSnapshotBuffer();
    }
    
    /**
     * Sync modified buffer back to GPU
     */
    syncBuffer(buffer) {
        this.sim.syncBuffer(buffer);
    }
    
    // === Layer 1: GPU Access (WebGL Resources) ===
    
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
     * Get both ping-pong buffers
     */
    getBuffers() {
        return this.sim.getBuffers();
    }
    
    /**
     * Get compiled shader program
     */
    getProgram() {
        return this.sim.getProgram();
    }
    
    /**
     * Get GPU compute engine
     */
    getComputeEngine() {
        return this.sim.getComputeEngine();
    }
    
    /**
     * Clean up resources
     */
    dispose() {
        this.sim.dispose();
    }
}

