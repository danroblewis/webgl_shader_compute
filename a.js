class GridSimulation {
    static CellType = {
        EMPTY: new Float32Array([0, 0, 0, 0])
    };
    printCellTypes() {
        console.log(this.CellType)
    }
}

class GameOfLifeSimulation extends GridSimulation {
    static CellType = {
        EMPTY: new Float32Array([0, 0, 0, 0]),
        ALIVE: new Float32Array([1, 0, 0, 0])
    }
}

var g = new GameOfLifeSimulation();
g.printCellTypes()
