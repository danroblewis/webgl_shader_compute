/**
 * Fitness Evaluator
 * Evaluates rule sets by running simulations and comparing with expected results
 */

import { GENERIC_RULE_SHADER, ruleSetToUniforms } from './genericRuleShader.js'

/**
 * Create a fitness evaluation function
 * @param {Object} options
 * @param {Array} options.testGroups - Test case groups
 * @param {GPUCompute} options.gpuCompute - GPU compute instance (shared, reused)
 * @param {TestEvaluator} options.testEvaluator - Test evaluator instance
 * @param {Object} options.baseConfig - Base evolution config (for grid_simulation_code)
 * @param {number} options.simulationSteps - Number of simulation steps to run
 * @returns {Function} Async function that takes a ruleSet and returns fitness score (0-1)
 */
export function createFitnessEvaluator({ testGroups, gpuCompute, testEvaluator, baseConfig, simulationSteps = 1 }) {
  // Cache for compiled kernel (generic shader is compiled once)
  let cachedKernel = null
  
  return async (ruleSet) => {
    // Track textures to cleanup at the end
    const ruleTextures = []
    const texturesToCleanup = [] // Declare outside try block so it's available in catch
    const timings = {
      uniformPreparation: 0,
      bufferPreparation: 0,
      shaderCompilation: 0,
      bufferUpload: 0,
      simulationExecution: 0,
      testEvaluation: 0,
      total: 0
    }
    const startTotal = performance.now()
    
    try {
      // Stage 1: Convert rule set to texture data
      const startUniforms = performance.now()
      const uniformData = ruleSetToUniforms(ruleSet, gpuCompute)
      ruleTextures.push(uniformData.rulesTexture, uniformData.metadataTexture)
      timings.uniformPreparation = performance.now() - startUniforms
      
      // Stage 2: Combine test cases to get initial state (frame 0)
      const startBufferPrep = performance.now()
      const initialBufferData = combineTestCases(testGroups, 0)
      if (!initialBufferData) {
        timings.total = performance.now() - startTotal
        return { fitness: 0.0, timings } // No test cases
      }
      timings.bufferPreparation = performance.now() - startBufferPrep
      
      // Stage 3: Compile generic kernel (only once, cached)
      const startCompile = performance.now()
      if (!cachedKernel) {
        cachedKernel = gpuCompute.compileKernel(GENERIC_RULE_SHADER)
      }
      timings.shaderCompilation = performance.now() - startCompile
      
      // Stage 4: Create input and output buffers using the shared GPUCompute instance
      const startUpload = performance.now()
      const inputTexture = gpuCompute.createBuffer(
        initialBufferData.width,
        initialBufferData.height,
        initialBufferData.buffer
      )
      
      // Create ping-pong buffers for simulation steps
      let currentTexture = inputTexture
      let nextTexture = null
      texturesToCleanup.push(inputTexture)
      
      if (simulationSteps > 0) {
        nextTexture = gpuCompute.createBuffer(
          initialBufferData.width,
          initialBufferData.height
        )
        texturesToCleanup.push(nextTexture)
      }
      timings.bufferUpload = performance.now() - startUpload
      
      // Stage 5: Run simulation for specified number of steps
      const startSim = performance.now()
      if (simulationSteps > 0) {
        for (let step = 0; step < simulationSteps; step++) {
          // Run kernel with rule set textures
          gpuCompute.run(
            cachedKernel,
            {
              u_state: currentTexture,
              u_width: initialBufferData.width,
              u_height: initialBufferData.height,
              u_numCellTypes: uniformData.numCellTypes,
              u_totalRules: uniformData.totalRules,
              u_rulesTexture: uniformData.rulesTexture,
              u_ruleMetadataTexture: uniformData.metadataTexture
            },
            nextTexture,
            initialBufferData.width,
            initialBufferData.height
          )
          
          // Swap buffers (ping-pong)
          if (step < simulationSteps - 1) {
            // For intermediate steps, swap
            const temp = currentTexture
            currentTexture = nextTexture
            nextTexture = temp
          }
        }
      }
      timings.simulationExecution = performance.now() - startSim
      
      // Final result is in nextTexture (or currentTexture if no steps)
      const simulatedTexture = simulationSteps > 0 ? nextTexture : currentTexture
      
      // Get expected result (frame 1, or frame 0 if only 1 frame)
      let hasMultipleFrames = false
      for (const group of testGroups || []) {
        if (group.tests && Array.isArray(group.tests)) {
          for (const test of group.tests) {
            if (test.frames && test.frames.length > 1) {
              hasMultipleFrames = true
              break
            }
          }
          if (hasMultipleFrames) break
        }
      }
      const expectedFrameIndex = hasMultipleFrames ? 1 : 0
      const expectedBufferData = combineTestCases(testGroups, expectedFrameIndex)
      
      if (!expectedBufferData) {
        // Cleanup all textures
        const gl = gpuCompute.gl
        // Unbind textures first
        for (let i = 0; i < 32; i++) {
          gl.activeTexture(gl.TEXTURE0 + i)
          gl.bindTexture(gl.TEXTURE_2D, null)
        }
        texturesToCleanup.forEach(tex => {
          if (tex) {
            try {
              gl.deleteTexture(tex)
            } catch (e) {}
          }
        })
        ruleTextures.forEach(tex => {
          if (tex) {
            try {
              gl.deleteTexture(tex)
            } catch (e) {}
          }
        })
        timings.total = performance.now() - startTotal
        return { fitness: 0.0, timings }
      }
      
      // Upload expected results to texture
      const startExpectedUpload = performance.now()
      const expectedTexture = gpuCompute.createBuffer(
        expectedBufferData.width,
        expectedBufferData.height,
        expectedBufferData.buffer
      )
      timings.bufferUpload += performance.now() - startExpectedUpload
      
      // Stage 6: Evaluate using aggregated shader (returns single score)
      const startEval = performance.now()
      const config = {
        totalWidth: initialBufferData.width,
        totalHeight: initialBufferData.height,
        numTestCases: initialBufferData.numTestCases,
        testCaseWidth: initialBufferData.testCaseWidth,
        testCaseHeight: initialBufferData.testCaseHeight,
        spacing: 5
      }
      
      const results = testEvaluator.evaluate(simulatedTexture, expectedTexture, config, true)
      timings.testEvaluation = performance.now() - startEval
      
      // Fitness is the match ratio (first element of results)
      const fitness = results[0] || 0.0
      
      // Cleanup all textures (but keep kernels cached)
      // Unbind textures first to avoid "deleted object" errors
      const gl = gpuCompute.gl
      for (let i = 0; i < 32; i++) {  // Check all texture units
        gl.activeTexture(gl.TEXTURE0 + i)
        gl.bindTexture(gl.TEXTURE_2D, null)
      }
      
      texturesToCleanup.forEach(tex => {
        if (tex) {
          try {
            gl.deleteTexture(tex)
          } catch (e) {
            // Texture already deleted or invalid
          }
        }
      })
      if (expectedTexture) {
        try {
          gl.deleteTexture(expectedTexture)
        } catch (e) {
          // Texture already deleted or invalid
        }
      }
      // Cleanup rule textures
      ruleTextures.forEach(tex => {
        if (tex) {
          try {
            gl.deleteTexture(tex)
          } catch (e) {
            // Texture already deleted or invalid
          }
        }
      })
      
      timings.total = performance.now() - startTotal
      return { fitness, timings }
    } catch (error) {
      console.error('Fitness evaluation error:', error)
      // Cleanup on error
      texturesToCleanup.forEach(tex => {
        try { gpuCompute.gl.deleteTexture(tex) } catch (e) {}
      })
      ruleTextures.forEach(tex => {
        try { gpuCompute.gl.deleteTexture(tex) } catch (e) {}
      })
      timings.total = performance.now() - startTotal
      return { fitness: 0.0, timings } // Return 0 fitness on error
    }
  }
}

/**
 * Combine test cases into a single buffer (same logic as TestBufferViewer)
 */
function combineTestCases(testGroups, frameIndex) {
  if (!testGroups || testGroups.length === 0) {
    return null
  }

  const allTestCases = []
  for (const group of testGroups) {
    if (group.tests && Array.isArray(group.tests)) {
      for (const test of group.tests) {
        if (test.frames && test.frames.length > 0) {
          allTestCases.push(test)
        }
      }
    }
  }

  if (allTestCases.length === 0) {
    return null
  }

  // Find maximum dimensions
  let maxWidth = 0
  let maxHeight = 0
  for (const test of allTestCases) {
    if (test.width > maxWidth) {
      maxWidth = test.width
    }
    if (test.height > maxHeight) {
      maxHeight = test.height
    }
  }

  if (maxWidth === 0 || maxHeight === 0) {
    return null
  }

  const spacing = 5
  const totalWidth = allTestCases.length * maxWidth + (allTestCases.length - 1) * spacing
  const combinedBuffer = new Float32Array(totalWidth * maxHeight * 4)

  let currentX = 0
  for (const test of allTestCases) {
    const frame = test.frames[frameIndex] || null
    
    for (let y = 0; y < maxHeight; y++) {
      const row = frame && y < test.height ? frame[y] : null
      for (let x = 0; x < maxWidth; x++) {
        const dstIndex = (y * totalWidth + (currentX + x)) * 4
        
        if (x < test.width && y < test.height && row) {
          const cell = row[x]
          let r, g, b, a
          if (cell instanceof Float32Array) {
            r = cell[0] || 0
            g = cell[1] || 0
            b = cell[2] || 0
            a = cell[3] || 0
          } else if (Array.isArray(cell)) {
            r = cell[0] || 0
            g = cell[1] || 0
            b = cell[2] || 0
            a = cell[3] || 0
          } else {
            r = Number(cell) || 0
            g = 0
            b = 0
            a = 0
          }
          
          combinedBuffer[dstIndex] = r
          combinedBuffer[dstIndex + 1] = g
          combinedBuffer[dstIndex + 2] = b
          combinedBuffer[dstIndex + 3] = a
        } else {
          // Empty cell
          combinedBuffer[dstIndex] = 0
          combinedBuffer[dstIndex + 1] = 0
          combinedBuffer[dstIndex + 2] = 0
          combinedBuffer[dstIndex + 3] = 0
        }
      }
    }

    currentX += maxWidth
    if (currentX < totalWidth) {
      for (let y = 0; y < maxHeight; y++) {
        for (let s = 0; s < spacing; s++) {
          const dstIndex = (y * totalWidth + (currentX + s)) * 4
          combinedBuffer[dstIndex] = 0
          combinedBuffer[dstIndex + 1] = 0
          combinedBuffer[dstIndex + 2] = 0
          combinedBuffer[dstIndex + 3] = 0
        }
      }
      currentX += spacing
    }
  }

  return {
    buffer: combinedBuffer,
    width: totalWidth,
    height: maxHeight,
    numTestCases: allTestCases.length,
    testCaseWidth: maxWidth,
    testCaseHeight: maxHeight
  }
}

/**
 * Get default cell types (fallback if not in config)
 */
function getDefaultCellTypes() {
  return {
    EMPTY: new Float32Array([0, 0, 0, 0]),
    SAND: new Float32Array([1, 0, 0, 0]),
    WATER: new Float32Array([2, 0, 0, 0]),
    STONE: new Float32Array([3, 0, 0, 0])
  }
}

