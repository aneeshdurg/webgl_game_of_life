function panic(msg) {
    alert(msg);
    throw new Error(msg);
}

function assert(cond, msg) {
    if (!cond)
        panic(msg);
}

const R = 0, G = 1, B = 2, A = 3;

/**
 * There are two gl instances created here. One is responsible for just
 * rendering the game state and handles scaling the state up from single pixels
 * to visible blocks. The other computes the next game state. We need two gl
 * instances since one of them will be rendering a smaller area. Maybe the need
 * for two can be eliminated with viewports.
 */
class Game {
    constructor(canvas, vertShaderUrl, fragShaderUrl, computeShaderUrl) {
        console.log("Creating game object...");
        this.texture_data_width = 128;
        this.texture_data_height = 128;
        this.texture_data_component_length = 4;// RGBA

        this.tile_width = 32;
        this.tile_height = 32;

        this.canvas = canvas;
        this.canvas.width = 640;
        this.canvas.height = 480;
        this.gl = this.canvas.getContext("webgl");
        assert(this.gl, "No webgl context found!");

        // Create the gl instance responsible for computing the next game state.
        this.com_canvas = document.createElement("canvas");
        this.com_canvas.width = this.texture_data_width;
        this.com_canvas.height = this.texture_data_height;
        this.com_gl = this.com_canvas.getContext("webgl");
        assert(this.com_gl);

        this.canvas.parentElement.appendChild(this.com_canvas);

        function setupVertexBuffer(gl) {
            const buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(
                gl.ARRAY_BUFFER,
                new Float32Array([
                    -1.0, -1.0,
                     1.0, -1.0,
                    -1.0,  1.0,
                    -1.0,  1.0,
                     1.0, -1.0,
                     1.0,  1.0]),
                gl.STATIC_DRAW);
        }

        setupVertexBuffer(this.gl);
        setupVertexBuffer(this.com_gl);

        this.vertShaderUrl = vertShaderUrl;
        this.fragShaderUrl = fragShaderUrl;
        this.computeShaderUrl = computeShaderUrl;

        this.renderVars = {};
        this.computeVars = {};

        console.log("Game object created");
    }

    async main() {
        await this.initShaders();
        await this.comInitShaders();
        console.log("Shaders initialized!");

        this.setupTexture();
        console.log("Texture initialized!");

        // TODO add a way to modify this
        this.gl.uniform1f(
            this.gl.getUniformLocation(this.shaderProgram, "u_tile_width"), this.tile_width);
        this.gl.uniform1f(
            this.gl.getUniformLocation(this.shaderProgram, "u_tile_height"), this.tile_height);
        console.log("u_tile_width", this.tile_width);
        console.log("u_tile_height", this.tile_height);

        this.canvas.addEventListener('click', this.clickHandler.bind(this));
        this.render();
    }

    clickHandler(e) {
        console.log("Got click", e);
        const canvas = e.target;
        const rect = canvas.getBoundingClientRect();
        const mousePosGL =  {
          x: e.clientX - rect.left,
          y: canvas.height - (e.clientY - rect.top), // flip y-axis for gl coords
        };

        const num_x_tiles = Math.ceil(canvas.width / this.tile_width);
        const num_y_tiles = Math.ceil(canvas.height / this.tile_height);

        const tileXidx = Math.floor(mousePosGL.x / this.tile_width);
        const tileYidx = Math.floor(mousePosGL.y / this.tile_height);

        console.log("    clicked on", tileXidx, tileYidx);
        const pixel = this.getPixel(tileXidx, tileYidx);
        console.log("        old value:", pixel);
        this.setPixel(tileXidx, tileYidx, [255 - pixel[R], 255 - pixel[G], 255 - pixel[B], pixel[A]]);
        this.updateTexture();
    }

    async _getShader(gl, url) {
        const isVertShader = url.endsWith('.vert.c');
        const isFragShader = url.endsWith('.frag.c');
        if (!isVertShader && !isFragShader)
            throw("Shader file " + url + " must end with one of ['.vert.c', '.frag.c']");

        const resp = await fetch(url);
        if (resp.status !== 200)
            throw("Could not find shader " + url);

        const shaderBody = await resp.body.getReader().read();
        const shaderSource = String.fromCharCode.apply(null, shaderBody.value)

        let shader;
        if (isFragShader) {
            shader = gl.createShader(gl.FRAGMENT_SHADER);
        } else {
            shader = gl.createShader(gl.VERTEX_SHADER);
        }

        gl.shaderSource(shader, shaderSource);
        gl.compileShader(shader);

        assert(
            gl.getShaderParameter(shader, gl.COMPILE_STATUS),
            "An error occurred compiling the shaders" + gl.getShaderInfoLog(shader));
        return shader;
    }

    _createGLProgram(gl, vertexShader, fragmentShader) {
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        assert(
            gl.getProgramParameter(program, gl.LINK_STATUS),
            "Unable to initialize the shader program");

        gl.useProgram(program);
        return program;
    }

    async initShaders() {
        const fragmentShader = await this._getShader(this.gl, this.fragShaderUrl);
        console.log("Got fragment shader");
        const vertexShader = await this._getShader(this.gl, this.vertShaderUrl);
        console.log("Got vertex shader");

        this.shaderProgram = this._createGLProgram(this.gl, vertexShader, fragmentShader);
        this.renderVars["a_position"] = this.gl.getAttribLocation(this.shaderProgram, "a_position");
        console.log("Initialized GL render program!");
    }

    async comInitShaders() {
        const fragmentShader = await this._getShader(this.com_gl, this.computeShaderUrl);
        console.log("Got fragment shader");
        const vertexShader = await this._getShader(this.com_gl, this.vertShaderUrl);
        console.log("Got vertex shader");

        this.computeProgram = this._createGLProgram(this.com_gl, vertexShader, fragmentShader);
        this.computeVars["a_position"] = this.com_gl.getAttribLocation(this.computeProgram, "a_position");
        console.log("Initialized GL compute program!");
    }

    render() {
        console.log("rendering...");
        {
            this.gl.clearColor(0.0, 0.0, 0.5, 1.0);
            this.gl.clear(this.gl.COLOR_BUFFER_BIT);

            //Directly before call to gl.drawArrays:
            this.gl.enableVertexAttribArray(this.renderVars["a_position"]);
            this.gl.vertexAttribPointer(this.renderVars["a_position"], 2, this.gl.FLOAT, false, 0, 0);
            this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
        }

        {
            this.com_gl.clearColor(0.0, 0.0, 0.5, 1.0);
            this.com_gl.clear(this.com_gl.COLOR_BUFFER_BIT);

            //Directly before call to gl.drawArrays:
            this.com_gl.enableVertexAttribArray(this.computeVars["a_position"]);
            this.com_gl.vertexAttribPointer(this.computeVars["a_position"], 2, this.gl.FLOAT, false, 0, 0);
            this.com_gl.drawArrays(this.com_gl.TRIANGLES, 0, 6);
        }

        requestAnimationFrame(this.render.bind(this));
    }

    setupTexture() {
        // 1-d representation of a grid of rgba values
        var arraylength =
            this.texture_data_width * this.texture_data_height * this.texture_data_component_length;
        this.texture_data = [new Uint8Array(arraylength), new Uint8Array(arraylength)];
        this.active_tex = 0;

        // TODO allow setting alive and dead color
        for (let i = 0; i < arraylength; i += 4) {
            this.texture_data[0][i + 3] = 255; // fill in with non-transparent black
            this.texture_data[1][i + 3] = 255;
        }

        this.gl.activeTexture(this.gl.TEXTURE1);
        this.texture = this.gl.createTexture();
        assert(this.texture, "Failed to create render texture!");
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);

        {
            this.com_gl.activeTexture(this.com_gl.TEXTURE1);
            this.com_texture = this.com_gl.createTexture();
            assert(this.com_texture, "Failed to create compute texture!");
            this.com_gl.bindTexture(this.com_gl.TEXTURE_2D, this.com_texture);

            this.com_gl.activeTexture(this.com_gl.TEXTURE2);
            this.com_texture_1 = this.com_gl.createTexture();
            assert(this.com_texture_1, "Failed to create compute texture1!");
            this.com_gl.bindTexture(this.com_gl.TEXTURE_2D, this.com_texture_1);
        }

        function setTextureParams(gl) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        }
        setTextureParams(this.gl);

        {
            this.com_gl.activeTexture(this.com_gl.TEXTURE1);
            setTextureParams(this.com_gl);
            this.com_gl.activeTexture(this.com_gl.TEXTURE2);
            setTextureParams(this.com_gl);
        }
        this.com_gl.activeTexture(this.com_gl.TEXTURE1);

        // TODO create consts for glsl variable names
        // TODO change texture id
        this.renderVars["u_texture"] = this.gl.getUniformLocation(this.shaderProgram, "u_texture");
        this.gl.uniform1i(this.renderVars["u_texture"], 1 /* texture id */);
        this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, this.texture_data_component_length);


        this.computeVars["u_texture"] = this.com_gl.getUniformLocation(
            this.computeProgram, "u_texture");
        this.com_gl.uniform1i(this.computeVars["u_texture"], 1 /* texture id */);
        this.com_gl.pixelStorei(this.com_gl.UNPACK_ALIGNMENT, this.texture_data_component_length);

        this.updateTexture();
    }

    updateTexture() {
        this.gl.texImage2D(
            this.gl.TEXTURE_2D,
            0, //LEVEL
            this.gl.RGBA, //internalFormat,
            128, // WIDTH
            128, // HEIGHT
            0, //border
            this.gl.RGBA, //srcFormat
            this.gl.UNSIGNED_BYTE, //srcType
            this.texture_data[this.active_tex]);

        // Set the input to the compute program to be the input to the render
        // program.
        this.com_gl.texImage2D(
            this.com_gl.TEXTURE_2D,
            0, //LEVEL
            this.com_gl.RGBA, //internalFormat,
            128, // WIDTH
            128, // HEIGHT
            0, //border
            this.com_gl.RGBA, //srcFormat
            this.com_gl.UNSIGNED_BYTE, //srcType
            this.texture_data[this.active_tex]);
    }

    setPixel(x, y, value) {
        const idx = this.texture_data_component_length * (y * this.texture_data_width + x);

        this.texture_data[this.active_tex][idx + R] = value[R];
        this.texture_data[this.active_tex][idx + G] = value[G];
        this.texture_data[this.active_tex][idx + B] = value[B];
        this.texture_data[this.active_tex][idx + A] = value[A];
    }

    getPixel(x, y) {
        const idx = this.texture_data_component_length * (y * this.texture_data_width + x);
        return [
            this.texture_data[this.active_tex][idx + R],
            this.texture_data[this.active_tex][idx + G],
            this.texture_data[this.active_tex][idx + B],
            this.texture_data[this.active_tex][idx + A]];
    }
}
