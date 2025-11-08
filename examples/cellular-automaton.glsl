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

