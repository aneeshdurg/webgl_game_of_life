#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
precision highp int;
#else
precision mediump float;
precision mediump int;
#endif

uniform sampler2D u_texture;
uniform vec2 u_texture_size;

float
neighborState(int x_off, int y_off)
{
    // Can look at any channel except alpha here
    float x = (gl_FragCoord.x + float(x_off)) / u_texture_size.x;
    float y = (gl_FragCoord.y + float(y_off)) / u_texture_size.y;
    return texture2D(u_texture, vec2(x, y)).r;
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
