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

bool isSand(float mat) {
    return mat > 0.5 && mat < 1.5;
}

bool isWater(float mat) {
    return mat > 1.5 && mat < 2.5;
}

bool isOil(float mat) {
    return mat > 4.5 && mat < 5.5;
}

bool isStatic(float mat) {
    return (mat > 2.5 && mat < 3.5) || (mat > 3.5 && mat < 4.5);  // Stone or Wood
}

// Pseudo-random function for horizontal dispersion
float random(vec2 co) {
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    float current = getCell(vec2(0.0, 0.0));
    
    // Static materials never change
    if (isStatic(current)) {
        gl_FragColor = vec4(current, 0.0, 0.0, 1.0);
        return;
    }
    
    // Get neighbors
    float above = getCell(vec2(0.0, -1.0));
    float below = getCell(vec2(0.0, 1.0));
    float left = getCell(vec2(-1.0, 0.0));
    float right = getCell(vec2(1.0, 0.0));
    float aboveLeft = getCell(vec2(-1.0, -1.0));
    float aboveRight = getCell(vec2(1.0, -1.0));
    float belowLeft = getCell(vec2(-1.0, 1.0));
    float belowRight = getCell(vec2(1.0, 1.0));
    
    // SAND physics - falls down, displaces water/oil
    if (isSand(current)) {
        // Can we fall straight down?
        if (isEmpty(below)) {
            gl_FragColor = vec4(EMPTY, 0.0, 0.0, 1.0);
            return;
        }
        // Can we displace liquid below?
        if (isWater(below) || isOil(below)) {
            gl_FragColor = vec4(below, 0.0, 0.0, 1.0);
            return;
        }
        // Can we fall diagonally?
        bool canLeft = isEmpty(belowLeft) || isWater(belowLeft) || isOil(belowLeft);
        bool canRight = isEmpty(belowRight) || isWater(belowRight) || isOil(belowRight);
        
        if (canLeft && canRight) {
            // Choose randomly
            if (random(v_texCoord) > 0.5) {
                gl_FragColor = vec4(belowLeft, 0.0, 0.0, 1.0);
            } else {
                gl_FragColor = vec4(belowRight, 0.0, 0.0, 1.0);
            }
            return;
        }
        if (canLeft) {
            gl_FragColor = vec4(belowLeft, 0.0, 0.0, 1.0);
            return;
        }
        if (canRight) {
            gl_FragColor = vec4(belowRight, 0.0, 0.0, 1.0);
            return;
        }
        // Can't move, stay as sand
        gl_FragColor = vec4(SAND, 0.0, 0.0, 1.0);
        return;
    }
    
    // WATER physics - falls down, flows horizontally, displaced by sand
    if (isWater(current)) {
        // Displaced by sand from above?
        if (isSand(above) && isEmpty(below)) {
            gl_FragColor = vec4(SAND, 0.0, 0.0, 1.0);
            return;
        }
        if (isSand(aboveLeft) && isEmpty(belowLeft) && isEmpty(below)) {
            gl_FragColor = vec4(SAND, 0.0, 0.0, 1.0);
            return;
        }
        if (isSand(aboveRight) && isEmpty(belowRight) && isEmpty(below)) {
            gl_FragColor = vec4(SAND, 0.0, 0.0, 1.0);
            return;
        }
        // Can we fall?
        if (isEmpty(below)) {
            gl_FragColor = vec4(EMPTY, 0.0, 0.0, 1.0);
            return;
        }
        // Can we fall diagonally?
        if (isEmpty(belowLeft) && isEmpty(belowRight)) {
            gl_FragColor = vec4(EMPTY, 0.0, 0.0, 1.0);
            return;
        }
        if (isEmpty(belowLeft)) {
            gl_FragColor = vec4(EMPTY, 0.0, 0.0, 1.0);
            return;
        }
        if (isEmpty(belowRight)) {
            gl_FragColor = vec4(EMPTY, 0.0, 0.0, 1.0);
            return;
        }
        // Can we flow horizontally?
        if (isEmpty(left) && isEmpty(right)) {
            if (random(v_texCoord) > 0.5) {
                gl_FragColor = vec4(EMPTY, 0.0, 0.0, 1.0);
            } else {
                gl_FragColor = vec4(WATER, 0.0, 0.0, 1.0);
            }
            return;
        }
        if (isEmpty(left)) {
            gl_FragColor = vec4(EMPTY, 0.0, 0.0, 1.0);
            return;
        }
        if (isEmpty(right)) {
            gl_FragColor = vec4(EMPTY, 0.0, 0.0, 1.0);
            return;
        }
        // Can't move, stay as water
        gl_FragColor = vec4(WATER, 0.0, 0.0, 1.0);
        return;
    }
    
    // OIL physics - similar to water but floats on water, displaced by sand
    if (isOil(current)) {
        // Displaced by sand from above?
        if (isSand(above) && isEmpty(below)) {
            gl_FragColor = vec4(SAND, 0.0, 0.0, 1.0);
            return;
        }
        // Displaced by water from above? (oil floats)
        if (isWater(above) && isEmpty(below)) {
            gl_FragColor = vec4(WATER, 0.0, 0.0, 1.0);
            return;
        }
        // Can we fall into empty?
        if (isEmpty(below)) {
            gl_FragColor = vec4(EMPTY, 0.0, 0.0, 1.0);
            return;
        }
        // Can we fall diagonally?
        if (isEmpty(belowLeft) || isEmpty(belowRight)) {
            gl_FragColor = vec4(EMPTY, 0.0, 0.0, 1.0);
            return;
        }
        // Can we float on water?
        if (isWater(below)) {
            gl_FragColor = vec4(WATER, 0.0, 0.0, 1.0);
            return;
        }
        // Can we flow horizontally?
        if (isEmpty(left) || isEmpty(right)) {
            gl_FragColor = vec4(EMPTY, 0.0, 0.0, 1.0);
            return;
        }
        // Can't move, stay as oil
        gl_FragColor = vec4(OIL, 0.0, 0.0, 1.0);
        return;
    }
    
    // EMPTY cell - check what can fall into us
    if (isEmpty(current)) {
        // Sand falls straight into empty
        if (isSand(above)) {
            gl_FragColor = vec4(SAND, 0.0, 0.0, 1.0);
            return;
        }
        // Sand rolls diagonally - only if there's something blocking on that side
        // (sand is above-left AND left is occupied = sand rolls over the obstacle)
        bool sandLeft = isSand(aboveLeft) && !isEmpty(left);
        bool sandRight = isSand(aboveRight) && !isEmpty(right);
        if (sandLeft && sandRight) {
            if (random(v_texCoord) > 0.5) {
                gl_FragColor = vec4(SAND, 0.0, 0.0, 1.0);
            } else {
                gl_FragColor = vec4(EMPTY, 0.0, 0.0, 1.0);
            }
            return;
        }
        if (sandLeft) {
            gl_FragColor = vec4(SAND, 0.0, 0.0, 1.0);
            return;
        }
        if (sandRight) {
            gl_FragColor = vec4(SAND, 0.0, 0.0, 1.0);
            return;
        }
        
        // Water falls straight into empty
        if (isWater(above)) {
            gl_FragColor = vec4(WATER, 0.0, 0.0, 1.0);
            return;
        }
        // Water flows horizontally - only if it's resting (has something below it)
        bool waterFlowsLeft = isWater(left) && !isEmpty(belowLeft);
        bool waterFlowsRight = isWater(right) && !isEmpty(belowRight);
        if (waterFlowsLeft || waterFlowsRight) {
            gl_FragColor = vec4(WATER, 0.0, 0.0, 1.0);
            return;
        }
        
        // Oil falls straight into empty
        if (isOil(above)) {
            gl_FragColor = vec4(OIL, 0.0, 0.0, 1.0);
            return;
        }
        // Oil flows horizontally - only if it's resting (has something below it)
        bool oilFlowsLeft = isOil(left) && !isEmpty(belowLeft);
        bool oilFlowsRight = isOil(right) && !isEmpty(belowRight);
        if (oilFlowsLeft || oilFlowsRight) {
            gl_FragColor = vec4(OIL, 0.0, 0.0, 1.0);
            return;
        }
        
        // Stay empty
        gl_FragColor = vec4(EMPTY, 0.0, 0.0, 1.0);
        return;
    }
    
    // Default: keep current state
    gl_FragColor = vec4(current, 0.0, 0.0, 1.0);
}
