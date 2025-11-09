precision highp float;
uniform sampler2D u_state;
uniform float u_width;
uniform float u_height;
varying vec2 v_texCoord;

void main() {
    float cellWidth = 1.0 / u_width;
    float cellHeight = 1.0 / u_height;
    
    // Count neighbors
    int neighbors = 0;
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            if (x == 0 && y == 0) continue;
            
            vec2 offset = vec2(float(x) * cellWidth, float(y) * cellHeight);
            vec2 coord = v_texCoord + offset;
            
            // Wrap coordinates (toroidal topology)
            coord = fract(coord);
            
            float cell = texture2D(u_state, coord).r;
            if (cell > 0.5) neighbors++;
        }
    }
    
    float current = texture2D(u_state, v_texCoord).r;
    float alive = 0.0;
    
    // Conway's rules: B3/S23
    // Birth if exactly 3 neighbors, Survival if 2 or 3 neighbors
    if (current > 0.5) {
        alive = (neighbors == 2 || neighbors == 3) ? 1.0 : 0.0;
    } else {
        alive = (neighbors == 3) ? 1.0 : 0.0;
    }
    
    gl_FragColor = vec4(alive, 0.0, 0.0, 1.0);
}

