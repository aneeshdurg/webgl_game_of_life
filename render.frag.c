#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
precision highp int;
#else
precision mediump float;
precision mediump int;
#endif

uniform sampler2D u_texture;


uniform float u_tile_width;
uniform float u_tile_height;

uniform float u_canvas_width;
uniform float u_canvas_height;

uniform vec2 u_texture_size;

// TODO add some way to offset the tile_x_idx and tile_y_idx to "pan" the camera
// TODO add a small border around each tile
void main() {
    float num_x_tiles = ceil(u_canvas_width / u_tile_width);
    float num_y_tiles = ceil(u_canvas_height / u_tile_height);

    float tile_x_idx = floor(gl_FragCoord.x / u_tile_width);
    float tile_y_idx = floor(gl_FragCoord.y / u_tile_height);

    if (tile_x_idx > u_texture_size.x || tile_y_idx > u_texture_size.y) {
        gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
        return;
    }

    float tile_x_coord = tile_x_idx / u_texture_size.x;
    float tile_y_coord = tile_y_idx / u_texture_size.y;

    gl_FragColor = texture2D(u_texture, vec2(tile_x_coord, tile_y_coord));
}
