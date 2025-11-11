# Shader Search 2.0 - Unified Interface

A complete rewrite of the shader search system with a clean, modular architecture and unified interface.

## Architecture

### Component Structure

```
shader_search_2/
├── index.html              # Single unified UI
├── styles.css              # All styles
├── components/
│   ├── simulation-engine.js    # GridSimulation wrapper for testing
│   ├── test-manager.js         # Test case management
│   ├── grid-visualizer.js      # Grid rendering (HTML divs)
│   ├── code-editor.js          # Monaco editor wrapper
│   ├── interactive-canvas.js   # Drawable simulation widget
│   └── evolution-engine.js     # Genetic algorithm orchestrator
└── lib/
    ├── test-suite-parser.js    # Parse test_suite.txt format
    ├── genome.js               # GLSL genome representation
    └── evolution.js            # Genetic operators (mutation, crossover)
```

## Key Features

### Unified Interface
- **Single page** - No context switching between test runner, evolution, and interactive sim
- **Real-time updates** - Changes to cell types or shaders immediately reflected
- **Integrated workflow** - Test → Evolve → Interact → Refine

### Modular Components
- **Clear interfaces** - Each component has well-defined API
- **Dependency injection** - No global state
- **Event-driven** - Components communicate via callbacks
- **Reusable** - Same visualizer for tests, comparisons, and interactive sim

### Better UX
- **3-column layout** - Code editors, test runner, evolution all visible
- **Test detail view** - Side-by-side actual/expected with animation
- **Interactive simulation** - Draw and test shaders in real-time
- **Evolution monitoring** - See progress and best results live

## Usage

### Running the Application

1. Start a web server:
   ```bash
   python3 -m http.server 8765
   ```

2. Navigate to:
   ```
   http://localhost:8765/shader_search_2/
   ```

### Defining Cell Types

The cell type editor accepts an object mapping:

```javascript
{
    EMPTY: new Float32Array([0, 0, 0, 0]),
    SAND: new Float32Array([1, 0, 0, 0]),
    STONE: new Float32Array([2, 0, 0, 0])
}
```

Add more types as needed. The system will automatically create a `GridSimulation` subclass.

### Writing Shaders

Shaders are GLSL 3.0 ES fragment shaders. Use the `getCell()` helper:

```glsl
float getCell(vec2 offset) // offset in grid coordinates
```

Example:
```glsl
float below = getCell(vec2(0.0, 1.0));  // Cell below current
float current = getCell(vec2(0.0, 0.0)); // Current cell
```

### Test Suite Format

Tests are defined in `test_suite.txt`:

```
TEST: sand_falls_down_unimpeded
GRID: 5x5

FRAME:
. . . . .
. . s . .
. . . . .
. . . . .
. . . . .

FRAME:
. . . . .
. . . . .
. . s . .
. . . . .
. . . . .
```

Characters:
- `.` = EMPTY (0)
- `s` = SAND (1)
- `#` = STONE (2)

## Component APIs

### SimulationEngine
```javascript
const engine = new SimulationEngine(cellTypeDefinition, glslShader, canvas);

// Run tests
engine.runTest(testCase, detailed) → { passed, error, frames }
engine.runAllTests(testCases) → { passed, failed, results }

// Interactive
engine.createInteractive(width, height) → GridSimulation
engine.updateShader(newShader)
engine.updateCellTypes(newDefinition)
```

### TestManager
```javascript
const manager = new TestManager();

await manager.loadTests() → Array<TestCase>
manager.setTestsFromContent(content) → Array<TestCase>
manager.onTestsChanged(callback)
```

### GridVisualizer
```javascript
const visualizer = new GridVisualizer(containerId, cellTypeColors);

visualizer.renderGrid(grid)
visualizer.renderComparison(actual, expected)
```

### CodeEditor
```javascript
const editor = new CodeEditor(containerId, options);

editor.getValue() → string
editor.setValue(value)
editor.onDidChangeContent(callback)
```

### InteractiveCanvas
```javascript
const canvas = new InteractiveCanvas(canvasId, simulationEngine, cellTypeColors);

canvas.setPaintMaterial(type)
canvas.play() / canvas.pause()
canvas.clear() / canvas.randomize()
```

### EvolutionEngine
```javascript
const evolution = new EvolutionEngine(testManager, simulationEngine, options);

await evolution.start() → Genome
evolution.stop()
evolution.onGenerationComplete(callback)
evolution.getBestGenome() → Genome
evolution.getBestShader() → string
```

## Benefits Over v1

1. **No code duplication** - Single visualizer, single simulation engine
2. **Clear separation** - Each component has one responsibility
3. **Better UX** - Everything in one view, no page switching
4. **Easier to extend** - Add features without touching core logic
5. **More maintainable** - Clean interfaces and dependency injection
6. **Better performance** - Shared resources, efficient GPU usage

## Fitness Function

The fitness function rewards:
- **Correct state transitions**: +1 point per correct frame
- **Fully passing tests**: Bonus points scaled by average transitions per test

```javascript
fitness = correctTransitions + (passedTests * (totalTransitions / totalTests))
```

This provides a smooth gradient for the genetic algorithm to optimize.

## Future Enhancements

- [ ] Save/load genome library
- [ ] Export shaders to files
- [ ] Multi-threaded evolution (Web Workers)
- [ ] Custom cell type colors
- [ ] Test case templates
- [ ] Performance profiling
- [ ] Shader debugging tools

## Migration from v1

The new system is not backward-compatible with saved test cases from v1, but test_suite.txt from v1 can be directly loaded. No manual migration needed for test cases.

