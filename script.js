function panic(msg) {
    alert(msg);
    throw new Error(msg);
}

function assert(cond, msg) {
    if (!cond)
        panic(msg);
}

const R = 0, G = 1, B = 2, A = 3;

class Game {
    constructor(canvas, vertShaderUrl, fragShaderUrl) {
        console.log("Creating game object...");
        this.tile_width = 32;
        this.tile_height = 32;

        this.canvas = canvas;
        this.canvas.width = 640;
        this.canvas.height = 480;

        this.gl = this.canvas.getContext("webgl");
        assert(this.gl, "No webgl context found!");

        const buffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
        this.gl.bufferData(
            this.gl.ARRAY_BUFFER,
            new Float32Array([
                -1.0, -1.0,
                 1.0, -1.0,
                -1.0,  1.0,
                -1.0,  1.0,
                 1.0, -1.0,
                 1.0,  1.0]),
            this.gl.STATIC_DRAW);

        this.vertShaderUrl = vertShaderUrl;
        this.fragShaderUrl = fragShaderUrl;
        console.log("Game object created");
    }

    async main() {
        await this.initShaders();
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

    async _getShader(url) {
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
            shader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
        } else {
            shader = this.gl.createShader(this.gl.VERTEX_SHADER);
        }

        this.gl.shaderSource(shader, shaderSource);
        this.gl.compileShader(shader);

        assert(
            this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS), "An error occurred compiling the shaders" + this.gl.getShaderInfoLog(shader));
        return shader;
    }

    async initShaders() {
        const fragmentShader = await this._getShader(this.fragShaderUrl);
        console.log("Got fragment shader");
        const vertexShader = await this._getShader(this.vertShaderUrl);
        console.log("Got vertex shader");

        this.shaderProgram = this.gl.createProgram();
        this.gl.attachShader(this.shaderProgram, vertexShader);
        this.gl.attachShader(this.shaderProgram, fragmentShader);
        this.gl.linkProgram(this.shaderProgram);

        assert(
            this.gl.getProgramParameter(this.shaderProgram, this.gl.LINK_STATUS),
            "Unable to initialize the shader program");

        this.gl.useProgram(this.shaderProgram);

        this.positionLocation = this.gl.getAttribLocation(this.shaderProgram, "a_position");
        console.log("Initialized GL program!");
    }

    render() {
        console.log("rendering...");
        this.gl.clearColor(0.0, 0.0, 0.5, 1.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);


        //Directly before call to gl.drawArrays:
        this.gl.enableVertexAttribArray(this.positionLocation);
        this.gl.vertexAttribPointer(this.positionLocation, 2, this.gl.FLOAT, false, 0, 0);
        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);

        requestAnimationFrame(this.render.bind(this));
    }

    setupTexture() {
        this.texture_data_width = 128;
        this.texture_data_height = 128;
        this.texture_data_component_length = 4;// RGBA
        // 1-d representation of a grid of rgba values
        var arraylength =
            this.texture_data_width * this.texture_data_height * this.texture_data_component_length;
        this.texture_data = new Uint8Array(arraylength);
        // TODO allow setting alive and dead color
        for (let i = 0; i < arraylength; i += 4)
            this.texture_data[i + 3] = 255; // fill in with non-transparent black

        // TODO flip-flop the active texture on every render
        this.gl.activeTexture(this.gl.TEXTURE1);
        this.texture = this.gl.createTexture();
        assert(this.texture, "Failed to create texture!");

        // TODO create consts for glsl variable names
        // TODO change texture id
        this.gl.uniform1i(this.gl.getUniformLocation(this.shaderProgram, "u_texture"), 1 /* texture id */);
        this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, this.texture_data_component_length);
        this.updateTexture();
    }

    updateTexture() {
        this.gl.activeTexture(this.gl.TEXTURE1);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);

        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texImage2D(
            this.gl.TEXTURE_2D,
            0, //LEVEL
            this.gl.RGBA, //internalFormat,
            128, // WIDTH
            128, // HEIGHT
            0, //border
            this.gl.RGBA, //srcFormat
            this.gl.UNSIGNED_BYTE, //srcType
            this.texture_data);
    }

    setPixel(x, y, value) {
        const idx = this.texture_data_component_length * (y * this.texture_data_width + x);

        this.texture_data[idx + R] = value[R];
        this.texture_data[idx + G] = value[G];
        this.texture_data[idx + B] = value[B];
        this.texture_data[idx + A] = value[A];
    }

    getPixel(x, y) {
        const idx = this.texture_data_component_length * (y * this.texture_data_width + x);
        return [
            this.texture_data[idx + R],
            this.texture_data[idx + G],
            this.texture_data[idx + B],
            this.texture_data[idx + A]];
    }
}
