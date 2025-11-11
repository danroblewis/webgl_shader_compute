/**
 * GridVisualizer - Renders grid states as colored HTML divs
 */
export class GridVisualizer {
    constructor(containerId, cellTypeColors = null) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error(`Container #${containerId} not found`);
        }
        
        this.cellTypeColors = cellTypeColors || {
            0: '#1e1e1e',  // EMPTY
            1: '#f4d03f',  // SAND
            2: '#808080'   // STONE
        };
        
        this.cellSize = 20; // pixels
    }
    
    /**
     * Set cell type colors
     */
    setCellTypeColors(colors) {
        this.cellTypeColors = colors;
    }
    
    /**
     * Render a single grid
     * @param {Array<Array<number|Array<number>>>} grid - 2D array of cell values or RGBA arrays
     */
    renderGrid(grid) {
        if (!grid || grid.length === 0) {
            this.container.innerHTML = '<div>No grid data</div>';
            return;
        }
        
        const height = grid.length;
        const width = grid[0].length;
        
        let html = `<div class="grid-display" style="display: inline-block; border: 1px solid #3e3e42;">`;
        
        for (let y = 0; y < height; y++) {
            html += `<div style="display: flex; height: ${this.cellSize}px;">`;
            for (let x = 0; x < width; x++) {
                const cellData = grid[y][x];
                // Extract value from RGBA array if needed
                const cellValue = Array.isArray(cellData) ? cellData[0] : cellData;
                const color = this.cellTypeColors[cellValue] || '#ff00ff';
                html += `<div style="width: ${this.cellSize}px; height: ${this.cellSize}px; background-color: ${color}; border: 1px solid #00000033;"></div>`;
            }
            html += `</div>`;
        }
        
        html += `</div>`;
        this.container.innerHTML = html;
    }
    
    /**
     * Render side-by-side comparison
     * @param {Array} actualGrid - Actual grid from simulation
     * @param {Array} expectedGrid - Expected grid from test
     */
    renderComparison(actualGrid, expectedGrid) {
        if (!actualGrid || !expectedGrid) {
            this.container.innerHTML = '<div>No comparison data</div>';
            return;
        }
        
        const height = actualGrid.length;
        const width = actualGrid[0].length;
        
        let html = `<div style="display: flex; gap: 20px; justify-content: center;">`;
        
        // Actual grid
        html += `<div style="text-align: center;">`;
        html += `<div style="margin-bottom: 5px; font-weight: bold;">Actual</div>`;
        html += this.#gridToHTML(actualGrid);
        html += `</div>`;
        
        // Expected grid
        html += `<div style="text-align: center;">`;
        html += `<div style="margin-bottom: 5px; font-weight: bold;">Expected</div>`;
        html += this.#gridToHTML(expectedGrid);
        html += `</div>`;
        
        html += `</div>`;
        this.container.innerHTML = html;
    }
    
    /**
     * Helper to convert grid to HTML
     */
    #gridToHTML(grid) {
        const height = grid.length;
        const width = grid[0].length;
        
        let html = `<div style="display: inline-block; border: 1px solid #3e3e42;">`;
        
        for (let y = 0; y < height; y++) {
            html += `<div style="display: flex; height: ${this.cellSize}px;">`;
            for (let x = 0; x < width; x++) {
                const cellData = grid[y][x];
                const cellValue = Array.isArray(cellData) ? cellData[0] : cellData;
                const color = this.cellTypeColors[cellValue] || '#ff00ff';
                html += `<div style="width: ${this.cellSize}px; height: ${this.cellSize}px; background-color: ${color}; border: 1px solid #00000033;"></div>`;
            }
            html += `</div>`;
        }
        
        html += `</div>`;
        return html;
    }
    
    /**
     * Clear the container
     */
    clear() {
        this.container.innerHTML = '';
    }
}

