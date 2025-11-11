/**
 * InteractiveCanvas - Drawable simulation widget
 */
export class InteractiveCanvas {
    constructor(canvasId, simulationEngine, cellTypeColors) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            throw new Error(`Canvas #${canvasId} not found`);
        }
        
        this.simulationEngine = simulationEngine;
        this.cellTypeColors = cellTypeColors;
        this.simulation = null;
        
        this.isPlaying = false;
        this.animationId = null;
        this.paintMaterial = 1; // Default to SAND
        this.isDrawing = false;
        
        this.#setupCanvas();
        this.#setupEventListeners();
    }
    
    /**
     * Setup canvas
     */
    #setupCanvas() {
        const width = parseInt(this.canvas.getAttribute('width')) || 100;
        const height = parseInt(this.canvas.getAttribute('height')) || 100;
        
        this.simulation = this.simulationEngine.createInteractive(width, height);
        this.ctx = this.canvas.getContext('2d');
        
        // Initial render
        this.render();
    }
    
    /**
     * Setup event listeners for drawing
     */
    #setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => {
            this.isDrawing = true;
            this.#draw(e);
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isDrawing) {
                this.#draw(e);
            }
        });
        
        this.canvas.addEventListener('mouseup', () => {
            this.isDrawing = false;
        });
        
        this.canvas.addEventListener('mouseleave', () => {
            this.isDrawing = false;
        });
    }
    
    /**
     * Draw at mouse position
     */
    #draw(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.simulation.width / rect.width;
        const scaleY = this.simulation.height / rect.height;
        
        const x = Math.floor((e.clientX - rect.left) * scaleX);
        // Flip Y coordinate: WebGL has Y=0 at bottom, but mouse Y=0 is at top
        const y = this.simulation.height - 1 - Math.floor((e.clientY - rect.top) * scaleY);
        
        if (x >= 0 && x < this.simulation.width && y >= 0 && y < this.simulation.height) {
            this.simulation.setCell(x, y, [this.paintMaterial, 0, 0, 1]);
            this.render();
        }
    }
    
    /**
     * Set paint material
     */
    setPaintMaterial(materialIndex) {
        this.paintMaterial = materialIndex;
    }
    
    /**
     * Play simulation
     */
    play() {
        if (this.isPlaying) return;
        
        this.isPlaying = true;
        const animate = () => {
            if (!this.isPlaying) return;
            
            this.simulation.step(1);
            this.render();
            
            this.animationId = requestAnimationFrame(animate);
        };
        animate();
    }
    
    /**
     * Pause simulation
     */
    pause() {
        this.isPlaying = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
    
    /**
     * Step one frame
     */
    step() {
        this.simulation.step(1);
        this.render();
    }
    
    /**
     * Clear simulation
     */
    clear() {
        this.simulation.clear();
        this.render();
    }
    
    /**
     * Randomize simulation
     */
    randomize() {
        this.simulation.randomize();
        this.render();
    }
    
    /**
     * Render current state to canvas
     */
    render() {
        const buffer = this.simulation.getCurrentBuffer();
        const width = this.simulation.width;
        const height = this.simulation.height;
        
        // Create image data
        const imageData = this.ctx.createImageData(width, height);
        const data = imageData.data;
        
        // Convert buffer to RGBA image
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const bufferIdx = (y * width + x) * 4;
                const cellValue = buffer[bufferIdx];
                
                // Get color for this cell type
                const color = this.cellTypeColors[cellValue] || '#000000';
                const rgb = this.#hexToRgb(color);
                
                // WebGL Y is bottom-up, canvas Y is top-down, so flip
                const canvasY = height - 1 - y;
                const dataIdx = (canvasY * width + x) * 4;
                
                data[dataIdx] = rgb.r;
                data[dataIdx + 1] = rgb.g;
                data[dataIdx + 2] = rgb.b;
                data[dataIdx + 3] = 255;
            }
        }
        
        // Draw to canvas
        this.ctx.putImageData(imageData, 0, 0);
    }
    
    /**
     * Convert hex color to RGB
     */
    #hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }
    
    /**
     * Update shader
     */
    updateShader(newShader) {
        const wasPlaying = this.isPlaying;
        if (wasPlaying) {
            this.pause();
        }
        
        this.simulationEngine.updateShader(newShader);
        this.simulation = this.simulationEngine.getSimulation();
        this.render();
        
        if (wasPlaying) {
            this.play();
        }
    }
    
    /**
     * Dispose resources
     */
    dispose() {
        this.pause();
        // Don't dispose simulation as it's managed by SimulationEngine
    }
}

