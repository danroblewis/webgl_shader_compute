precision highp float;
uniform sampler2D u_state;
uniform float u_width;
uniform float u_height;
varying vec2 v_texCoord;

const float EMPTY = 0.0;
const float SAND = 1.0;
const float WATER = 2.0;
const float STONE = 3.0;
const float WOOD = 4.0;
const float OIL = 5.0;

float getCell(vec2 offset) {
    vec2 coord = v_texCoord + offset / vec2(u_width, u_height);
    if (coord.x < 0.0 || coord.x > 1.0 || coord.y < 0.0 || coord.y > 1.0) {
        return STONE; // Walls
    }
    return texture2D(u_state, coord).r;
}

bool isEmpty(float mat) {
    return mat < 0.5;
}

bool isLiquid(float mat) {
    return mat > 1.5 && mat < 5.5;
}

bool canDisplace(float current, float target) {
    if (isEmpty(target)) return true;
    
    // Sand can displace water and oil
    if (current > 0.5 && current < 1.5) {
        return isLiquid(target);
    }
    
    // Water can displace oil (oil floats)
    if (current > 1.5 && current < 2.5) {
        return target > 4.5 && target < 5.5; // OIL
    }
    
    return false;
}

void main() {
    float current = getCell(vec2(0.0, 0.0));
    
    // Static materials don't move
    if (current > 2.5 && current < 4.5) {
        gl_FragColor = vec4(current, 0.0, 0.0, 1.0);
        return;
    }
    
    // Empty cells stay empty
    if (isEmpty(current)) {
        gl_FragColor = vec4(EMPTY, 0.0, 0.0, 1.0);
        return;
    }
    
    float below = getCell(vec2(0.0, 1.0));
    float belowLeft = getCell(vec2(-1.0, 1.0));
    float belowRight = getCell(vec2(1.0, 1.0));
    float left = getCell(vec2(-1.0, 0.0));
    float right = getCell(vec2(1.0, 0.0));
    
    // SAND physics
    if (current > 0.5 && current < 1.5) {
        if (canDisplace(current, below)) {
            gl_FragColor = vec4(below, 0.0, 0.0, 1.0);
            return;
        }
        if (canDisplace(current, belowLeft) && isEmpty(left)) {
            gl_FragColor = vec4(belowLeft, 0.0, 0.0, 1.0);
            return;
        }
        if (canDisplace(current, belowRight) && isEmpty(right)) {
            gl_FragColor = vec4(belowRight, 0.0, 0.0, 1.0);
            return;
        }
        gl_FragColor = vec4(current, 0.0, 0.0, 1.0);
        return;
    }
    
    // WATER physics
    if (current > 1.5 && current < 2.5) {
        if (canDisplace(current, below)) {
            gl_FragColor = vec4(below, 0.0, 0.0, 1.0);
            return;
        }
        if (canDisplace(current, belowLeft)) {
            gl_FragColor = vec4(belowLeft, 0.0, 0.0, 1.0);
            return;
        }
        if (canDisplace(current, belowRight)) {
            gl_FragColor = vec4(belowRight, 0.0, 0.0, 1.0);
            return;
        }
        // Spread horizontally
        if (isEmpty(left) && isEmpty(right)) {
            float rand = fract(sin(dot(v_texCoord, vec2(12.9898, 78.233))) * 43758.5453);
            if (rand > 0.5) {
                gl_FragColor = vec4(left, 0.0, 0.0, 1.0);
            } else {
                gl_FragColor = vec4(right, 0.0, 0.0, 1.0);
            }
            return;
        }
        if (isEmpty(left)) {
            gl_FragColor = vec4(left, 0.0, 0.0, 1.0);
            return;
        }
        if (isEmpty(right)) {
            gl_FragColor = vec4(right, 0.0, 0.0, 1.0);
            return;
        }
        gl_FragColor = vec4(current, 0.0, 0.0, 1.0);
        return;
    }
    
    // OIL physics (similar to water but floats)
    if (current > 4.5 && current < 5.5) {
        if (isEmpty(below)) {
            gl_FragColor = vec4(below, 0.0, 0.0, 1.0);
            return;
        }
        if (isEmpty(belowLeft)) {
            gl_FragColor = vec4(belowLeft, 0.0, 0.0, 1.0);
            return;
        }
        if (isEmpty(belowRight)) {
            gl_FragColor = vec4(belowRight, 0.0, 0.0, 1.0);
            return;
        }
        // Float on water
        if (below > 1.5 && below < 2.5) {
            gl_FragColor = vec4(below, 0.0, 0.0, 1.0);
            return;
        }
        // Spread horizontally
        if (isEmpty(left)) {
            gl_FragColor = vec4(left, 0.0, 0.0, 1.0);
            return;
        }
        if (isEmpty(right)) {
            gl_FragColor = vec4(right, 0.0, 0.0, 1.0);
            return;
        }
        gl_FragColor = vec4(current, 0.0, 0.0, 1.0);
        return;
    }
    
    gl_FragColor = vec4(current, 0.0, 0.0, 1.0);
}

