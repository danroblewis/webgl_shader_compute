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

bool isEmpty(float mat) { return mat < 0.5; }
bool isSand(float mat) { return mat > 0.5 && mat < 1.5; }
bool isWater(float mat) { return mat > 1.5 && mat < 2.5; }
bool isStone(float mat) { return mat > 2.5 && mat < 3.5; }
bool isWood(float mat) { return mat > 3.5 && mat < 4.5; }
bool isOil(float mat) { return mat > 4.5 && mat < 5.5; }

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
    
    // Sample all neighbors
    float above = getCell(vec2(0.0, -1.0));
    float below = getCell(vec2(0.0, 1.0));
    float left = getCell(vec2(-1.0, 0.0));
    float right = getCell(vec2(1.0, 0.0));
    float aboveLeft = getCell(vec2(-1.0, -1.0));
    float aboveRight = getCell(vec2(1.0, -1.0));
    float belowLeft = getCell(vec2(-1.0, 1.0));
    float belowRight = getCell(vec2(1.0, 1.0));
    
    // Solid blocks never change
    if (isSolid(current)) {
        gl_FragColor = vec4(current, 0.0, 0.0, 1.0);
        return;
    }
    
    // ========================================================================
    // GRAVITY MATERIALS: Should I vacate my position?
    // ========================================================================
    if (hasGravity(current)) {
        // Being displaced by heavier material from above?
        if (canDisplace(above, current) && canDisplace(current, below)) {
            gl_FragColor = vec4(above, 0.0, 0.0, 1.0);
            return;
        }
        
        // Can I fall straight down?
        if (canDisplace(current, below)) {
            gl_FragColor = vec4(below, 0.0, 0.0, 1.0);  // Swap with what's below
            return;
        }
        
        // Can I fall diagonally?
        bool canLeft = canDisplace(current, belowLeft);
        bool canRight = canDisplace(current, belowRight);
        if (canLeft && canRight) {
            gl_FragColor = preferLeft(v_texCoord) ? vec4(belowLeft, 0.0, 0.0, 1.0)
                                                    : vec4(belowRight, 0.0, 0.0, 1.0);
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
        
        // Liquids can flow horizontally when blocked from falling
        if (isLiquid(current)) {
            if (isEmpty(left) && isEmpty(right)) {
                // Both sides free - deterministically pick one to vacate
                gl_FragColor = preferLeft(v_texCoord) ? vec4(EMPTY, 0.0, 0.0, 1.0)
                                                        : vec4(current, 0.0, 0.0, 1.0);
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
        }
        
        // Can't move - stay put
        gl_FragColor = vec4(current, 0.0, 0.0, 1.0);
        return;
    }
    
    // ========================================================================
    // EMPTY CELLS: What should fall/flow into me?
    // ========================================================================
    if (isEmpty(current)) {
        // Priority 1: Things falling straight down
        if (hasGravity(above)) {
            gl_FragColor = vec4(above, 0.0, 0.0, 1.0);
            return;
        }
        
        // Priority 2: Things falling diagonally (rolling down slopes)
        // Only accept if they're blocked on that side
        bool acceptLeft = hasGravity(aboveLeft) && !isEmpty(left) && !canDisplace(aboveLeft, belowLeft);
        bool acceptRight = hasGravity(aboveRight) && !isEmpty(right) && !canDisplace(aboveRight, belowRight);
        if (acceptLeft && acceptRight) {
            gl_FragColor = preferLeft(v_texCoord) ? vec4(aboveLeft, 0.0, 0.0, 1.0)
                                                     : vec4(aboveRight, 0.0, 0.0, 1.0);
            return;
        }
        if (acceptLeft) {
            gl_FragColor = vec4(aboveLeft, 0.0, 0.0, 1.0);
            return;
        }
        if (acceptRight) {
            gl_FragColor = vec4(aboveRight, 0.0, 0.0, 1.0);
            return;
        }
        
        // Priority 3: Liquids flowing horizontally
        // Only accept if liquid is resting (blocked from falling)
        bool flowLeft = isLiquid(left) && !isEmpty(belowLeft);
        bool flowRight = isLiquid(right) && !isEmpty(belowRight);
        if (flowLeft && flowRight) {
            gl_FragColor = preferLeft(v_texCoord) ? vec4(left, 0.0, 0.0, 1.0)
                                                     : vec4(right, 0.0, 0.0, 1.0);
            return;
        }
        if (flowLeft) {
            gl_FragColor = vec4(left, 0.0, 0.0, 1.0);
            return;
        }
        if (flowRight) {
            gl_FragColor = vec4(right, 0.0, 0.0, 1.0);
            return;
        }
        
        // Stay empty
        gl_FragColor = vec4(EMPTY, 0.0, 0.0, 1.0);
        return;
    }
    
    // Default
    gl_FragColor = vec4(current, 0.0, 0.0, 1.0);
}
