// Array Addition Example
export const title = 'Array Addition';
export const heading = 'GPU-Accelerated Array Addition';
export const description = 'Add two arrays element-wise on the GPU using a fragment shader.';
export const buttonText = 'Run Addition';

const SHADER = `
precision highp float;
uniform sampler2D u_a;
uniform sampler2D u_b;
varying vec2 v_texCoord;

void main() {
    float a = texture2D(u_a, v_texCoord).r;
    float b = texture2D(u_b, v_texCoord).r;
    float result = a + b;
    gl_FragColor = vec4(result, 0.0, 0.0, 1.0);
}
`;

export async function run(compute) {
    const shader = compute.compile(SHADER);
    
    const a = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const b = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18];

    const result = await shader.run({ a, b }, a.length);

    return [
        { label: 'a', values: a },
        { label: 'b', values: b },
        { label: 'a + b', values: Array.from(result) }
    ];
}

