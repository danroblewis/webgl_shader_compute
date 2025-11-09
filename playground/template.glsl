precision highp float;

uniform sampler2D u_state;
uniform float u_width;
uniform float u_height;

varying vec2 v_texCoord;

// Material constants
const float EMPTY = 0.0;
const float SAND = 1.0;
const float WATER = 2.0;
const float STONE = 3.0;

vec4 getCell(vec2 offset) {
    vec2 pixelSize = vec2(1.0) / vec2(u_width, u_height);
    return texture2D(u_state, v_texCoord + offset * pixelSize);
}

void main() {
    vec4 current = getCell(vec2(0.0, 0.0));
    float material = current.r;
    
    // Stone never moves
    if (material == STONE) {
        gl_FragColor = current;
        return;
    }
    
    vec4 below = getCell(vec2(0.0, 1.0));
    vec4 left = getCell(vec2(-1.0, 0.0));
    vec4 right = getCell(vec2(1.0, 0.0));
    
    // Sand falls down or slides diagonally
    if (material == SAND) {
        if (below.r == EMPTY) {
            gl_FragColor = vec4(EMPTY, 0.0, 0.0, 0.0);
        } else if (getCell(vec2(-1.0, 1.0)).r == EMPTY) {
            gl_FragColor = vec4(EMPTY, 0.0, 0.0, 0.0);
        } else if (getCell(vec2(1.0, 1.0)).r == EMPTY) {
            gl_FragColor = vec4(EMPTY, 0.0, 0.0, 0.0);
        } else {
            gl_FragColor = current;
        }
    }
    // Empty cells can be filled from above
    else if (material == EMPTY) {
        vec4 above = getCell(vec2(0.0, -1.0));
        if (above.r == SAND) {
            gl_FragColor = above;
        } else {
            vec4 aboveLeft = getCell(vec2(-1.0, -1.0));
            vec4 aboveRight = getCell(vec2(1.0, -1.0));
            if (aboveLeft.r == SAND && right.r != EMPTY) {
                gl_FragColor = aboveLeft;
            } else if (aboveRight.r == SAND && left.r != EMPTY) {
                gl_FragColor = aboveRight;
            } else {
                gl_FragColor = current;
            }
        }
    }
    else {
        gl_FragColor = current;
    }
}

