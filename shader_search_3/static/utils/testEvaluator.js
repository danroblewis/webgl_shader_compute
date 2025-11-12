/**
 * Test Evaluator
 * High-level utility for evaluating test cases using GPU compute
 * 
 * This class manages the evaluation process:
 * 1. Takes simulated results (from GridSimulation) and expected results (from test cases)
 * 2. Runs the evaluation shader to compare them
 * 3. Returns match statistics
 */

import { generateTestEvaluationShader, generateAggregatedTestEvaluationShader } from './testEvaluationShader.js'

export class TestEvaluator {
  constructor(gpuCompute) {
    this.compute = gpuCompute
    this.evaluationKernel = null
    this.aggregatedKernel = null
    this.outputBuffer = null
    this.aggregatedOutputBuffer = null
  }

  /**
   * Initialize the evaluator with test case configuration
   * @param {Object} config - Test case configuration
   * @param {number} config.totalWidth - Total width of combined texture
   * @param {number} config.totalHeight - Total height of combined texture
   * @param {number} config.numTestCases - Number of test cases
   * @param {number} config.testCaseWidth - Width of each test case slot
   * @param {number} config.testCaseHeight - Height of each test case slot
   * @param {number} config.spacing - Spacing between test cases
   * @param {boolean} aggregated - If true, use aggregated shader (1 pixel output), else per-test-case (numTestCases pixels)
   */
  initialize(config, aggregated = false) {
    const {
      totalWidth,
      totalHeight,
      numTestCases,
      testCaseWidth,
      testCaseHeight,
      spacing = 5
    } = config

    // Generate and compile shader
    const shaderSource = aggregated
      ? generateAggregatedTestEvaluationShader(config)
      : generateTestEvaluationShader(config)

    if (aggregated) {
      this.aggregatedKernel = this.compute.compileKernel(shaderSource)
      // Output is 1x1 (single pixel)
      this.aggregatedOutputBuffer = this.compute.createBuffer(1, 1)
    } else {
      this.evaluationKernel = this.compute.compileKernel(shaderSource)
      // Output is numTestCases x 1 (one pixel per test case)
      this.outputBuffer = this.compute.createBuffer(numTestCases, 1)
    }
  }

  /**
   * Evaluate test cases by comparing simulated vs expected results
   * @param {WebGLTexture} simulatedTexture - Texture containing simulated results
   * @param {WebGLTexture} expectedTexture - Texture containing expected results
   * @param {Object} config - Configuration (same as initialize)
   * @param {boolean} aggregated - If true, return aggregated result, else per-test-case
   * @returns {Float32Array} Results array
   *   - If aggregated: [matchRatio, totalMatches, totalPixels, 1.0]
   *   - If not aggregated: Array of [matchRatio, totalPixels, 0.0, 1.0] per test case
   */
  evaluate(simulatedTexture, expectedTexture, config, aggregated = false) {
    const {
      totalWidth,
      totalHeight,
      numTestCases,
      testCaseWidth,
      testCaseHeight,
      spacing = 5
    } = config

    // Ensure initialized
    if (aggregated) {
      if (!this.aggregatedKernel) {
        this.initialize(config, true)
      }
    } else {
      if (!this.evaluationKernel) {
        this.initialize(config, false)
      }
    }

    const kernel = aggregated ? this.aggregatedKernel : this.evaluationKernel
    const output = aggregated ? this.aggregatedOutputBuffer : this.outputBuffer
    const outputWidth = aggregated ? 1 : numTestCases
    const outputHeight = 1

    // Run evaluation shader
    this.compute.run(
      kernel,
      {
        u_simulated: simulatedTexture,
        u_expected: expectedTexture,
        u_totalWidth: totalWidth,
        u_totalHeight: totalHeight,
        u_numTestCases: numTestCases,
        u_testCaseWidth: testCaseWidth,
        u_testCaseHeight: testCaseHeight,
        u_spacing: spacing
      },
      output,
      outputWidth,
      outputHeight
    )

    // Download results
    const resultSize = outputWidth * outputHeight * 4 // RGBA
    const results = new Float32Array(resultSize)
    this.compute.download(output, results, outputWidth, outputHeight)

    return results
  }

  /**
   * Get per-test-case evaluation results
   * @param {WebGLTexture} simulatedTexture - Simulated results texture
   * @param {WebGLTexture} expectedTexture - Expected results texture
   * @param {Object} config - Configuration
   * @returns {Array<Object>} Array of results, one per test case
   *   Each object: { matchRatio: number, totalPixels: number, matchCount: number }
   */
  getPerTestCaseResults(simulatedTexture, expectedTexture, config) {
    const results = this.evaluate(simulatedTexture, expectedTexture, config, false)
    const numTestCases = config.numTestCases
    const perTestCaseResults = []

    for (let i = 0; i < numTestCases; i++) {
      const baseIndex = i * 4 // RGBA per pixel
      const matchRatio = results[baseIndex] // R channel
      const totalPixels = results[baseIndex + 1] // G channel
      const matchCount = matchRatio * totalPixels

      perTestCaseResults.push({
        matchRatio,
        totalPixels,
        matchCount
      })
    }

    return perTestCaseResults
  }

  /**
   * Get aggregated evaluation result (all test cases combined)
   * @param {WebGLTexture} simulatedTexture - Simulated results texture
   * @param {WebGLTexture} expectedTexture - Expected results texture
   * @param {Object} config - Configuration
   * @returns {Object} Aggregated result
   *   { matchRatio: number, totalMatches: number, totalPixels: number }
   */
  getAggregatedResult(simulatedTexture, expectedTexture, config) {
    const results = this.evaluate(simulatedTexture, expectedTexture, config, true)
    
    // Results are in a single pixel: [matchRatio, totalMatches, totalPixels, 1.0]
    return {
      matchRatio: results[0],
      totalMatches: results[1],
      totalPixels: results[2]
    }
  }

  /**
   * Dispose of resources
   * Note: GPUCompute manages texture cleanup via dispose(), so we just clear references
   */
  dispose() {
    // Note: Textures are managed by GPUCompute's dispose() method
    // We just clear our references
    this.outputBuffer = null
    this.aggregatedOutputBuffer = null
    this.evaluationKernel = null
    this.aggregatedKernel = null
  }
}

