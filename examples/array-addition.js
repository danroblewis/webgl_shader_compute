// Array Addition Example
export const title = 'Array Addition';
export const heading = 'GPU-Accelerated Array Addition';
export const description = 'Add two arrays element-wise on the GPU using a fragment shader.';
export const buttonText = 'Run Addition';
export const shaderFile = 'array-addition.glsl';

export async function run(compute) {
    const response = await fetch('./array-addition.glsl');
    const shaderSource = await response.text();
    const shader = compute.compile(shaderSource);
    
    const a = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const b = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18];

    const result = await shader.run({ a, b }, a.length);

    return [
        { label: 'a', values: a },
        { label: 'b', values: b },
        { label: 'a + b', values: Array.from(result) }
    ];
}

