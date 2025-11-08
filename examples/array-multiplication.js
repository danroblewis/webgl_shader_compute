// Array Multiplication Example
export const title = 'Array Multiplication';
export const heading = 'GPU-Accelerated Array Multiplication';
export const description = 'Multiply two arrays element-wise on the GPU using a fragment shader.';
export const buttonText = 'Run Multiplication';

export async function run(compute, resultDiv) {
    const shader = `
        precision highp float;
        uniform sampler2D u_a;
        uniform sampler2D u_b;
        varying vec2 v_texCoord;
        
        void main() {
            float a = texture2D(u_a, v_texCoord).r;
            float b = texture2D(u_b, v_texCoord).r;
            float result = a * b;
            gl_FragColor = vec4(result, 0.0, 0.0, 1.0);
        }
    `;

    const size = 10;
    const a = Array.from({ length: size }, (_, i) => i + 1);
    const b = Array.from({ length: size }, (_, i) => 2.0);

    const result = await compute.computeArrays({ shader, inputs: { a, b }, size });

    let output = '<pre>';
    output += 'a:      ' + a.join(', ') + '\n';
    output += 'b:      ' + b.map(x => x.toFixed(1)).join(', ') + '\n';
    output += 'a * b:  ' + Array.from(result).map(x => x.toFixed(1)).join(', ');
    output += '</pre>';

    resultDiv.innerHTML = output;
}

