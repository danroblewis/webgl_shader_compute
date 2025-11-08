// Complex Expression Example
export const title = 'Complex Expression';
export const heading = 'Multi-Operation Expression';
export const description = 'Compute a complex expression on the GPU: (a * 2.0) + (b * 3.0) - 5.0';
export const buttonText = 'Run Expression';

export async function run(compute, resultDiv) {
    const shader = `
        precision highp float;
        uniform sampler2D u_a;
        uniform sampler2D u_b;
        varying vec2 v_texCoord;
        
        void main() {
            float a = texture2D(u_a, v_texCoord).r;
            float b = texture2D(u_b, v_texCoord).r;
            float result = (a * 2.0) + (b * 3.0) - 5.0;
            gl_FragColor = vec4(result, 0.0, 0.0, 1.0);
        }
    `;

    const size = 10;
    const a = Array.from({ length: size }, (_, i) => i);
    const b = Array.from({ length: size }, (_, i) => i + 1);

    const result = await compute.computeArrays({ shader, inputs: { a, b }, size });

    let output = '<pre>';
    output += 'a:                         ' + a.join(', ') + '\n';
    output += 'b:                         ' + b.join(', ') + '\n';
    output += '(a * 2) + (b * 3) - 5:     ' + Array.from(result).map(x => x.toFixed(1)).join(', ');
    output += '</pre>';

    resultDiv.innerHTML = output;
}

