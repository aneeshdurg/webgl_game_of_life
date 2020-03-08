#ifdef GL_VERTEX_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

attribute vec2 a_position;
void main() {
    gl_Position = vec4(a_position, 0, 1);
}
