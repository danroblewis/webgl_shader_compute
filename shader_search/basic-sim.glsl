precision highp float;
uniform sampler2D u_state;
uniform float u_width;
uniform float u_height;
varying vec2 v_texCoord;

// Cell types
const float EMPTY = 0.0;
const float SAND = 1.0;
const float STONE = 2.0;

// Helper to get cell at offset
float getCell(vec2 offset) {
    vec2 coord = v_texCoord + offset / vec2(u_width, u_height);
    if (coord.x < 0.0 || coord.x > 1.0 || coord.y < 0.0 || coord.y > 1.0) {
        return STONE; // Walls
    }
    return texture2D(u_state, coord).r;
}

void main() {
    float current = getCell(vec2(0.0, 0.0));
    
    // Stone never moves
    if (current == STONE) {
        gl_FragColor = vec4(STONE, 0.0, 0.0, 1.0);
        return;
    }
    
    // Sand falls down
    if (current == SAND) {
        float below = getCell(vec2(0.0, -1.0));
        
        // If there's space below, the sand will fall (become empty here)
        if (below == EMPTY) {
            gl_FragColor = vec4(EMPTY, 0.0, 0.0, 1.0);
            return;
        }
        
        // Can't fall, stay as sand
        gl_FragColor = vec4(SAND, 0.0, 0.0, 1.0);
        return;
    }
    
    // Empty cell - check if sand is falling into it
    if (current == EMPTY) {
        float above = getCell(vec2(0.0, 1.0));
        
        // If sand is above and can fall, receive it
        if (above == SAND) {
            gl_FragColor = vec4(SAND, 0.0, 0.0, 1.0);
            return;
        }
        
        gl_FragColor = vec4(EMPTY, 0.0, 0.0, 1.0);
        return;
    }
    
    // Default
    gl_FragColor = vec4(current, 0.0, 0.0, 1.0);
}

