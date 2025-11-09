# Shader Search - Genetic Algorithm for Cellular Automata

This directory contains a system for evolving cellular automata shaders using genetic algorithms.

## The Problem

Writing cellular automata shaders for GPU execution is difficult because:

1. **CPU algorithms are single-buffered**: They process cells left-to-right, top-to-bottom, and can directly swap cells, making them deterministic and preserving quantities (e.g., sand particles don't duplicate or vanish).

2. **GPU shaders are double-buffered**: They use ping-pong buffers where all cells are processed in parallel, reading from one buffer and writing to another. This makes it harder to write deterministic algorithms without duplication or loss of particles.

## The Solution

Use **genetic algorithms** to evolve shader code that properly handles double-buffering:

1. **Unit tests as fitness function**: Define expected behaviors through unit tests
2. **CPU-based simulation**: Fast simulation for testing thousands of candidates
3. **Genetic evolution**: Evolve shader logic that passes the tests

## Architecture

### Browser-Based Test Runner

The system runs entirely in the browser using real GPU/WebGL2:

### `index.html`
Web interface for running tests:
- Visual test results
- Grid visualization
- Real-time feedback

### `test-runner.js`
Test framework using actual GPU compute:
- Uses our existing `GPUCompute` library
- Tests real GLSL shaders on real GPU
- No interpretation or simulation needed
- Fast enough for genetic algorithm

### `basic-sim.glsl`
Example GLSL shader being tested:
- Working double-buffered falling sand algorithm
- Can be mutated by genetic algorithm

### Unit Tests

5 unit tests that define expected cellular automata behaviors:
- Stone remains stationary
- Sand falls through empty space
- Sand stops on solid surfaces
- Multiple grains stack properly
- Empty grids stay empty

These tests serve as the fitness function for the genetic algorithm.

## Current Status

✅ Browser-based test runner with real GPU testing  
✅ 5 unit tests ready to run on actual WebGL2  
✅ Visual feedback and grid visualization  
⏳ Genetic algorithm (next step)  
⏳ Shader mutation operators (next step)  
⏳ Evolution loop (next step)  

## Running Tests

1. Start a local web server in the project root:
```bash
python3 -m http.server 8765
```

2. Open in browser:
```
http://localhost:8765/shader_search/
```

3. Click "▶️ Run All Tests"

## Example: Working Double-Buffered Algorithm

The key insight for double-buffered falling sand:

```javascript
// For a SAND cell:
if (below === EMPTY) {
    return EMPTY;  // Sand leaves this cell
}
return SAND;  // Sand stays

// For an EMPTY cell:
if (above === SAND) {
    return SAND;  // Receive falling sand
}
return EMPTY;  // Stay empty
```

Both the source (sand) and destination (empty) cells coordinate the movement without direct communication, avoiding duplication.

## Next Steps

1. Implement genetic algorithm framework
2. Define mutation operators for update functions
3. Add more complex behaviors (diagonal movement, liquids, etc.)
4. Generate GLSL shader code from successful candidates
5. Verify results on actual GPU

