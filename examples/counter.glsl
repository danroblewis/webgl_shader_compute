precision highp float;
uniform sampler2D u_value;
varying vec2 v_texCoord;

void main() {
    float value = texture2D(u_value, v_texCoord).r;
    float result = value + 1.0;
    gl_FragColor = vec4(result, 0.0, 0.0, 1.0);
}

