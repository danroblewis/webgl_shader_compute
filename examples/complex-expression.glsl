precision highp float;
uniform sampler2D u_a;
uniform sampler2D u_b;
varying vec2 v_texCoord;

void main() {
    float a = texture2D(u_a, v_texCoord).r;
    float b = texture2D(u_b, v_texCoord).r;
    float result = (a * 2.0) + (b * 3.0) - 5.0;
    gl_FragColor = vec4(result, 0.0, 0.0, 1.0);
}

