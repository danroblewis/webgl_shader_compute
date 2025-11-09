// Define your CellType enum
static CellType = {
    EMPTY: new Float32Array([0, 0, 0, 0]),
    ALIVE: new Float32Array([1, 0, 0, 0])
};

// Optional: Override randomize for custom behavior
randomize(probability = 0.3) {
    const buffer = this.getCurrentBuffer();
    const { ALIVE, EMPTY } = this.constructor.CellType;
    for (let cellIdx = 0; cellIdx < this.width * this.height; cellIdx++) {
        const cellType = Math.random() < probability ? ALIVE : EMPTY;
        const bufferIdx = cellIdx * 4;
        buffer.set(cellType, bufferIdx);
    }
    this.syncBuffer(buffer);
}
