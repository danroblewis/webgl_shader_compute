// Cellular Automaton Example
export const title = 'Cellular Automaton';
export const heading = '1D Cellular Automaton (Rule 110)';
export const description = 'Compute one step of a 1D cellular automaton on the GPU. Each cell\'s next state depends on itself and its neighbors.';
export const buttonText = 'Run Automaton';

export async function run(compute, resultDiv) {
    // Simple rule: if exactly one neighbor is 1, cell becomes 1
    const shader = `
        precision highp float;
        uniform sampler2D u_state;
        varying vec2 v_texCoord;
        
        void main() {
            float size = 32.0;
            float cellWidth = 1.0 / size;
            
            // Sample neighbors (with wrapping)
            float left = texture2D(u_state, v_texCoord - vec2(cellWidth, 0.0)).r;
            float center = texture2D(u_state, v_texCoord).r;
            float right = texture2D(u_state, v_texCoord + vec2(cellWidth, 0.0)).r;
            
            // Apply rule: cell is alive if center OR (left XOR right)
            float sum = left + center + right;
            float leftXorRight = mod(left + right, 2.0);
            float result = max(center, leftXorRight);
            
            gl_FragColor = vec4(result, 0.0, 0.0, 1.0);
        }
    `;

    const size = 32;
    const state = new Array(size).fill(0);
    state[size / 2] = 1; // Single cell in middle

    const result = await compute.computeArrays({ shader, inputs: { state }, size });

    let output = '<div class="code">';
    output += 'Initial: ' + state.map(x => x ? '█' : '·').join('') + '<br>';
    output += 'Step 1:  ' + Array.from(result).map(x => x > 0.5 ? '█' : '·').join('');
    output += '</div>';

    resultDiv.innerHTML = output;
}

