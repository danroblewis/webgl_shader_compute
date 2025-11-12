/**
 * Test Evaluation Shader
 * Compares simulated results with expected results and outputs match counts
 * 
 * This shader performs a map-reduce operation entirely on the GPU:
 * - Input: simulated texture (from running simulation) and expected texture (from test cases)
 * - Output: one pixel per test case, with RGBA values representing match statistics
 * 
 * The shader iterates through all pixels in each test case's region and counts matches.
 */

/**
 * Generate the test evaluation fragment shader
 * @param {Object} config - Configuration object
 * @param {number} config.totalWidth - Total width of the combined texture
 * @param {number} config.totalHeight - Total height of the combined texture
 * @param {number} config.numTestCases - Number of test cases
 * @param {number} config.testCaseWidth - Width of each test case slot (maxWidth)
 * @param {number} config.testCaseHeight - Height of each test case slot (maxHeight)
 * @param {number} config.spacing - Spacing between test cases (default 5)
 * @returns {string} GLSL fragment shader source
 */
export function generateTestEvaluationShader(config) {
  const {
    totalWidth,
    totalHeight,
    numTestCases,
    testCaseWidth,
    testCaseHeight,
    spacing = 5
  } = config

  return `#version 300 es
precision highp float;

// Input textures
uniform sampler2D u_simulated;  // Simulated result from running the simulation
uniform sampler2D u_expected;  // Expected result from test cases

// Configuration uniforms
uniform float u_totalWidth;
uniform float u_totalHeight;
uniform float u_numTestCases;
uniform float u_testCaseWidth;
uniform float u_testCaseHeight;
uniform float u_spacing;

// Output: one pixel per test case
// R = match count (normalized to 0-1 range, where 1.0 = all pixels match)
// G = total pixels compared
// B = unused
// A = unused
out vec4 fragColor;

// Helper function to get cell value from texture
float getCell(sampler2D tex, vec2 coord) {
    vec4 texel = texture(tex, coord);
    return texel.r;  // Cell type is stored in red channel
}

// Helper function to check if two cell values match (with tolerance for floating point)
bool cellsMatch(float a, float b) {
    return abs(a - b) < 0.1;  // Tolerance for floating point comparison
}

void main() {
    // Determine which test case we're evaluating based on output pixel X coordinate
    float testCaseIndex = gl_FragCoord.x;
    
    // Clamp to valid range
    if (testCaseIndex < 0.0 || testCaseIndex >= u_numTestCases) {
        fragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }
    
    // Calculate the X offset for this test case in the combined texture
    // Each test case takes up testCaseWidth + spacing (except the last one)
    float testCaseXOffset = testCaseIndex * (u_testCaseWidth + u_spacing);
    
    // Initialize match counter
    float matchCount = 0.0;
    float totalPixels = 0.0;
    
    // Iterate through all pixels in this test case's region
    // We need to sample every pixel in the test case area
    for (float y = 0.0; y < u_testCaseHeight; y += 1.0) {
        for (float x = 0.0; x < u_testCaseWidth; x += 1.0) {
            // Calculate texture coordinates for this pixel
            // Texture coordinates are normalized (0.0 to 1.0)
            float texX = (testCaseXOffset + x) / u_totalWidth;
            float texY = y / u_totalHeight;
            
            // Clamp to valid texture coordinate range
            texX = clamp(texX, 0.0, 1.0);
            texY = clamp(texY, 0.0, 1.0);
            
            vec2 texCoord = vec2(texX, texY);
            
            // Sample both textures
            float simulatedValue = getCell(u_simulated, texCoord);
            float expectedValue = getCell(u_expected, texCoord);
            
            // Only count non-empty cells (cell type 0 is EMPTY)
            // Check if expected value is non-empty
            if (expectedValue > 0.1) {
                totalPixels += 1.0;
                // Compare and count matches
                if (cellsMatch(simulatedValue, expectedValue)) {
                    matchCount += 1.0;
                }
            }
        }
    }
    
    // Output normalized match count (0.0 to 1.0)
    // R = match ratio (matches / total pixels)
    // G = total pixels (for debugging/verification)
    float matchRatio = totalPixels > 0.0 ? matchCount / totalPixels : 0.0;
    fragColor = vec4(matchRatio, totalPixels, 0.0, 1.0);
}
`
}

/**
 * Alternative shader that outputs a single aggregated value (all test cases combined)
 * This compresses the result to just 1 pixel
 */
export function generateAggregatedTestEvaluationShader(config) {
  const {
    totalWidth,
    totalHeight,
    numTestCases,
    testCaseWidth,
    testCaseHeight,
    spacing = 5
  } = config

  return `#version 300 es
precision highp float;

uniform sampler2D u_simulated;
uniform sampler2D u_expected;
uniform float u_totalWidth;
uniform float u_totalHeight;
uniform float u_numTestCases;
uniform float u_testCaseWidth;
uniform float u_testCaseHeight;
uniform float u_spacing;

out vec4 fragColor;

float getCell(sampler2D tex, vec2 coord) {
    vec4 texel = texture(tex, coord);
    return texel.r;
}

bool cellsMatch(float a, float b) {
    return abs(a - b) < 0.1;
}

void main() {
    float totalMatches = 0.0;
    float totalPixels = 0.0;
    
    // Iterate through all test cases
    for (float testCaseIndex = 0.0; testCaseIndex < u_numTestCases; testCaseIndex += 1.0) {
        float testCaseXOffset = testCaseIndex * (u_testCaseWidth + u_spacing);
        
        // Iterate through all pixels in this test case
        for (float y = 0.0; y < u_testCaseHeight; y += 1.0) {
            for (float x = 0.0; x < u_testCaseWidth; x += 1.0) {
                float texX = (testCaseXOffset + x) / u_totalWidth;
                float texY = y / u_totalHeight;
                
                texX = clamp(texX, 0.0, 1.0);
                texY = clamp(texY, 0.0, 1.0);
                
                vec2 texCoord = vec2(texX, texY);
                
                float simulatedValue = getCell(u_simulated, texCoord);
                float expectedValue = getCell(u_expected, texCoord);
                
                // Only count non-empty cells (cell type 0 is EMPTY)
                // Check if expected value is non-empty
                if (expectedValue > 0.1) {
                    totalPixels += 1.0;
                    if (cellsMatch(simulatedValue, expectedValue)) {
                        totalMatches += 1.0;
                    }
                }
            }
        }
    }
    
    // Output aggregated result
    float matchRatio = totalPixels > 0.0 ? totalMatches / totalPixels : 0.0;
    fragColor = vec4(matchRatio, totalMatches, totalPixels, 1.0);
}
`
}

