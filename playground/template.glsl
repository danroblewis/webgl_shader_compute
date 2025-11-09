precision highp float;
uniform sampler2D u_state;
uniform float u_width;
uniform float u_height;
varying vec2 v_texCoord;

// Material types
const float EMPTY = 0.0;
const float SAND = 1.0;
const float WATER = 2.0;
const float STONE = 3.0;
const float WOOD = 4.0;
const float OIL = 5.0;

// ============================================================================
// HELPERS
// ============================================================================

float getCell(vec2 offset) {
    vec2 coord = v_texCoord + offset / vec2(u_width, u_height);
    if (coord.x < 0.0 || coord.x > 1.0 || coord.y < 0.0 || coord.y > 1.0) {
        return STONE;
    }
    return texture2D(u_state, coord).r;
}

bool isEmpty(float mat) { return mat == EMPTY; }
bool isSand(float mat) { return mat == SAND; }
bool isWater(float mat) { return mat == WATER; }
bool isStone(float mat) { return mat == STONE; }
bool isWood(float mat) { return mat == WOOD; }
bool isOil(float mat) { return mat == OIL; }

bool isSolid(float mat) { return isStone(mat) || isWood(mat); }
bool isLiquid(float mat) { return isWater(mat) || isOil(mat); }
bool hasGravity(float mat) { return isSand(mat) || isLiquid(mat); }


float getDensity(float mat) {
    if (isSand(mat)) return 3.0;
    if (isWater(mat)) return 2.0;
    if (isOil(mat)) return 1.0;
    return 0.0;
}

bool canDisplace(float mover, float target) {
    if (isEmpty(target)) return true;
    if (isSolid(target)) return false;
    return getDensity(mover) > getDensity(target);
}

bool preferLeft(vec2 coord) {
    return mod(floor(coord.x * u_width), 2.0) < 0.5;
}

// ============================================================================
// MAIN: What should I become?
// ============================================================================

void main() {
    float current = getCell(vec2(0.0, 0.0));
    float up = getCell(vec2(0.0, -1.0));
    float down = getCell(vec2(0.0, 1.0));
    float left = getCell(vec2(-1.0, 0.0));
    float right = getCell(vec2(1.0, 0.0));
    float upleft = getCell(vec2(-1.0, -1.0));
    float upright = getCell(vec2(1.0, -1.0));
    float downleft = getCell(vec2(-1.0, 1.0));
    float downright = getCell(vec2(1.0, 1.0));

    float nextState = current;
    
    // Empty cells: accept falling materials from above
    if (isEmpty(current)) {
        if (hasGravity(up) && isEmpty(down)) {
            nextState = up;
        } else if (isSand(upleft) && !isEmpty(left) && preferLeft(gl_FragCoord.xy)) {
            nextState = upleft;
        } else if (isSand(upright) && !isEmpty(right) && !preferLeft(gl_FragCoord.xy)) {
            nextState = upright;
        }
    }
    // Gravity materials: vacate if something below accepts us
    else if (hasGravity(current)) {
        if (isEmpty(down)) {
            nextState = EMPTY;
        } else if (!isSolid(current)) {
            // Liquids spread horizontally if can't fall
            if (isEmpty(left) && preferLeft(gl_FragCoord.xy)) {
                nextState = EMPTY;
            } else if (isEmpty(right) && !preferLeft(gl_FragCoord.xy)) {
                nextState = EMPTY;
            }
        } else if (isSand(current)) {
            // Sand rolls diagonally if blocked
            if (isEmpty(downleft) && !isEmpty(left) && preferLeft(gl_FragCoord.xy)) {
                nextState = EMPTY;
            } else if (isEmpty(downright) && !isEmpty(right) && !preferLeft(gl_FragCoord.xy)) {
                nextState = EMPTY;
            }
        }
    }
    
    gl_FragColor = vec4(nextState, 0.0, 0.0, 1.0);
}
