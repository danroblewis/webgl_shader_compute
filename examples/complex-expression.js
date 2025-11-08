// Complex Expression Example
export const title = 'Complex Expression';
export const heading = 'Multi-Operation Expression';
export const description = 'Compute a complex expression on the GPU: (a * 2.0) + (b * 3.0) - 5.0';
export const buttonText = 'Run Expression';
export const shaderFile = 'complex-expression.glsl';

export async function run(compute) {
    const response = await fetch('./complex-expression.glsl');
    const shaderSource = await response.text();
    const shader = compute.compile(shaderSource);
    
    const a = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const b = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    const result = await shader.run({ a, b }, a.length);

    return [
        { label: 'a', values: a },
        { label: 'b', values: b },
        { label: '(a * 2) + (b * 3) - 5', values: Array.from(result) }
    ];
}

