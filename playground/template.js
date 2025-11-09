class PlaygroundSimulation extends GridSimulation {
    // Define your CellType enum
    static CellType = {
        ALIVE: new Float32Array([1, 0, 0, 0]),
        EMPTY: new Float32Array([0, 0, 0, 0])
    };

}
