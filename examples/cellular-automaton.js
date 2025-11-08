// Cellular Automaton Example
export const title = 'Cellular Automaton';
export const heading = '1D Cellular Automaton (Rule 110)';
export const description = 'Compute one step of a 1D cellular automaton on the GPU. Each cell\'s next state depends on itself and its neighbors.';
export const buttonText = 'Run Automaton';
export const shaderFile = 'cellular-automaton.glsl';

export async function run(compute) {
    const response = await fetch('./cellular-automaton.glsl');
    const shaderSource = await response.text();
    const shader = compute.compile(shaderSource);
    
    const state = [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        1,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
    ];

    const result = await shader.run({ state }, state.length);

    return {
        initial: state,
        result: Array.from(result)
    };
}

// Custom renderer for cellular automaton visualization
export function render(data) {
    let output = '<div class="code">';
    output += 'Initial: ' + data.initial.map(x => x ? '█' : '·').join('') + '<br>';
    output += 'Step 1:  ' + data.result.map(x => x > 0.5 ? '█' : '·').join('');
    output += '</div>';
    return output;
}

