#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
precision highp int;
#else
precision mediump float;
precision mediump int;
#endif

uniform sampler2D u_texture;

#define CANVAS_WIDTH   640.0
#define CANVAS_HEIGHT  480.0

uniform float u_tile_width;
uniform float u_tile_height;

// TODO pass this in via js
vec2 textureSize = vec2(128.0, 128.0);

float
neighborState(int x_off, int y_off)
{
    // Can look at any channel except alpha here
    return texture2D(
        u_texture,
        (gl_FragCoord.xy + vec2(float(x_off), float(y_off))) / textureSize).r;
}

float
isGEq(float a, float b)
{
    return sign(sign(a - b) + 1.0);
}

float
isEq(float a, float b)
{
    return isGEq(a, b) * isGEq(b, a);
}

void main() {
    float gol_score =
        neighborState(-1, -1) + neighborState(0, -1) + neighborState(1, -1) +
        neighborState(-1,  0) +                        neighborState(1,  0) +
        neighborState(-1,  1) + neighborState(0,  1) + neighborState(1,  1);

    float my_state = neighborState(0, 0);
    vec4 dead = vec4(0.0, 0.0, 0.0, 1.0);
    vec4 alive = vec4(1.0, 1.0, 1.0, 1.0);

    // TODO consider edges as dead
    gl_FragColor =
        my_state * (
            isGEq(gol_score, 4.0) * dead + // >= 4 neighbors => dead
            isGEq(1.0, gol_score) * dead + // <= 1 neighbors => dead
            isGEq(gol_score, 2.0) * isGEq(3.0, gol_score) * alive)
        + (1.0 - my_state) * (
            isEq(gol_score, 3.0) * alive +
            (1.0 - isEq(gol_score, 3.0)) * dead);
}
