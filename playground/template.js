// Define your CellType enum
static CellType = {
    EMPTY: new Float32Array([0, 0, 0, 0]),
    SAND: new Float32Array([1, 0, 0, 0]),
    WATER: new Float32Array([2, 0, 0, 0]),
    STONE: new Float32Array([3, 0, 0, 0])
};

// Optional: Override randomize for custom behavior
randomize(probability = 0.3) {
    const buffer = this.getCurrentBuffer();
    const { SAND, EMPTY } = this.constructor.CellType;
    for (let cellIdx = 0; cellIdx < this.width * this.height; cellIdx++) {
        const cellType = Math.random() < probability ? SAND : EMPTY;
        const bufferIdx = cellIdx * 4;
        buffer.set(cellType, bufferIdx);
    }
    this.syncBuffer(buffer);
}

