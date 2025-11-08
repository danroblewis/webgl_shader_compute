// Counter Example - Demonstrates stateful GPU computation
export const title = 'Counter (Stateful)';
export const heading = 'GPU-Accelerated Counter';
export const description = 'A simple counter that increments using GPU computation and maintains state between runs.';
export const buttonText = 'Run Counter';
export const shaderFile = 'counter.glsl';

var counter = 0;

export async function run(compute) {
    const response = await fetch('./counter.glsl');
    const shaderSource = await response.text();
    const shader = compute.compile(shaderSource);
    
    const value = [counter];
    const result = await shader.run({ value }, 1);
    counter = result[0];
    
    return { counter };
}

export function render(data) {
    return '<div style="font-size: 48px; font-weight: bold; color: #4CAF50;">' +
           Math.floor(data.counter) +
           '</div>';
}

