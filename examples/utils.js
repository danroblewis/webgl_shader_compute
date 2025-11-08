// Shared utilities for examples and playground

// Generic renderer for array-based data
export function renderGeneric(data) {
    // Check if data is an array of objects with label/values
    if (Array.isArray(data) && data.length > 0 && data[0].label && data[0].values) {
        let output = '<pre>';
        const maxLabelLength = Math.max(...data.map(d => d.label.length));
        
        data.forEach(item => {
            const label = item.label.padEnd(maxLabelLength);
            const values = item.values.map(v => 
                typeof v === 'number' ? v.toFixed(1) : v
            ).join(', ');
            output += `${label}:  ${values}\n`;
        });
        
        output += '</pre>';
        return output;
    }
    
    // Fallback: JSON stringify
    return '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
}

// Default template for playground
export const defaultShader = `precision highp float;
uniform sampler2D u_a;
uniform sampler2D u_b;
varying vec2 v_texCoord;

void main() {
    float a = texture2D(u_a, v_texCoord).r;
    float b = texture2D(u_b, v_texCoord).r;
    float result = a + b;
    gl_FragColor = vec4(result, 0.0, 0.0, 1.0);
}`;

export const defaultRunner = `// Run function: receives compute instance
async function run(compute, shaderSource) {
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

// Optional: Custom render function
// If not defined, uses default renderer
// function render(data) {
//     return '<pre>' + JSON.stringify(data) + '</pre>';
// }`;

