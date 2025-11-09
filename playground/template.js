class PlaygroundSimulation extends GridSimulation {
    // Define your CellType enum
    static CellType = {
        EMPTY: new Float32Array([0, 0, 0, 0]),
        SAND: new Float32Array([1, 0, 0, 0]),
        WATER: new Float32Array([2, 0, 0, 0]),
        STONE: new Float32Array([3, 0, 0, 0]),
        WOOD: new Float32Array([4, 0, 0, 0]),
        OIL: new Float32Array([5, 0, 0, 0])
    };

}
