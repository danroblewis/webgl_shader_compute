precision highp float;

uniform sampler2D u_textureA;
uniform sampler2D u_textureB;
varying vec2 v_texCoord;

void main() {
    // Read values from both textures
    vec4 valueA = texture2D(u_textureA, v_texCoord);
    vec4 valueB = texture2D(u_textureB, v_texCoord);
    
    // Perform computation (addition in this case)
    vec4 result = valueA + valueB;
    
    // Output the result
    gl_FragColor = result;
}

