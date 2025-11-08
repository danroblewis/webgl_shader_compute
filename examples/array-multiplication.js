// Array Multiplication Example
export const title = 'Array Multiplication';
export const heading = 'GPU-Accelerated Array Multiplication';
export const description = 'Multiply two arrays element-wise on the GPU using a fragment shader.';
export const buttonText = 'Run Multiplication';
export const shaderFile = 'array-multiplication.glsl';

export async function run(compute) {
    const response = await fetch('./array-multiplication.glsl');
    const shaderSource = await response.text();
    const shader = compute.compile(shaderSource);
    
    const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const b = [2, 2, 2, 2, 2, 2, 2, 2, 2, 2];

    const result = await shader.run({ a, b }, a.length);

    return [
        { label: 'a', values: a },
        { label: 'b', values: b },
        { label: 'a * b', values: Array.from(result) }
    ];
}

