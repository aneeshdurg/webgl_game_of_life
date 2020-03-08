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

// TODO add some way to offset the tile_x_idx and tile_y_idx to "pan" the camera
// TODO add a small border around each tile
void main() {
    float num_x_tiles = ceil(CANVAS_WIDTH / u_tile_width);
    float num_y_tiles = ceil(CANVAS_HEIGHT / u_tile_height);

    float tile_x_idx = floor(gl_FragCoord.x / u_tile_width);
    float tile_y_idx = floor(gl_FragCoord.y / u_tile_height);

    float tile_x_coord = tile_x_idx / textureSize.x;
    float tile_y_coord = tile_y_idx / textureSize.y;

    gl_FragColor = texture2D(u_texture, vec2(tile_x_coord, tile_y_coord));
}
