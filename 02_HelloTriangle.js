// Get the canvas and WebGL 2 context
const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl2');

const canvas2 = document.getElementById('2Dtext');  // 추가
const gl2 = canvas2.getContext('2d');   // 추가

if (!gl) {
    console.error('WebGL 2 is not supported by your browser.');
}

if (!gl2) {
    console.error('WebGL 2 is not supported by your browser.');
}  // 추가

// Set canvas size (using current browser's size)
//canvas.width = window.innerWidth;
//canvas.height = window.innerHeight;
canvas.width = canvas2.width = 600;
canvas.height = canvas2.height = 600;

// Resize viewport while keeping the aspect ratio
import { resizeAspectRatio } = require('./utility.js');
window.addEventListener('resize', () => {
    resizeAspectRatio(canvas, gl);
    render();
});

// Initialize WebGL settings
gl.viewport(0, 0, canvas.width, canvas.height);
gl.clearColor(0.0, 0.0, 0.0, 1.0);

//shader 소스 불러오기
async function loadShaderSource(url) {
    const response = await fetch(url);
    return await response.text();
}

// Function to compile shader
function compileShader(gl, source, type) {

    // Create shader object
    const shader = gl.createShader(type);

    // Set shader source code
    gl.shaderSource(shader, source);

    // Compile shader
    gl.compileShader(shader);

    // Check if the shader compiled successfully
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Error compiling shader:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

// Function to create shader program
function createProgram(gl, vertexShaderSource, fragmentShaderSource) {

    // Compile vertex and fragment shaders
    const vertexShader = compileShader(gl, vertexShaderSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER);

    // Create shader program (template)
    const shaderProgram = gl.createProgram();

    // Attach shaders to the program
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);

    // Link the shaders and program to complete the shader program
    gl.linkProgram(shaderProgram);

    // Check if the program linked successfully
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        console.error('Error linking program:', gl.getProgramInfoLog(shaderProgram));
        gl.deleteProgram(shaderProgram);
        return null;
    }
    return shaderProgram;
}

//추가
async function initShaderProgram(gl) {
    const vertexSrc = await loadShaderSource("VertexShader.glsl");
    const fragmentSrc = await loadShaderSource("FragmentShader.glsl");

    return createProgram(gl, vertexSrc, fragmentSrc);
}

// 추가
(async function main(){
    const shaderProgram = await initShaderProgram(gl);
    gl.useProgram(shaderProgram);
    render();
})();

// Triangle vertex coordinates 
const vertices = new Float32Array([
    -0.1, -0.1, 0.0,  // Bottom left
     0.1, -0.1, 0.0,  // Bottom right
     0.1,  0.1, 0.0,  // Top center 
    -0.1,  0.1, 0.0
]);

// Create Vertex Array Object (VAO)
const vao = gl.createVertexArray();
gl.bindVertexArray(vao);

// Create Vertex Buffer and bind data
const vertexBuffer = gl.createBuffer();

// Designate the target vertex buffer (to bind)
gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);

// Feed the vertex coordinates to the vertex buffer
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

// Link vertex data to shader program variables
gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(0);

// Use shader program 
gl.useProgram(shaderProgram);

// 추가
const uni_trans = gl.getUniformLocation(shaderProgram, "uni_trans")

// Render loop
function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);
    const position = new Float32Array([xpos, ypos]);

    //추가
    gl.uniform2fv(uni_trans, position);

    // Bind VAO and draw
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

    //추가
    gl2.clearRect(0, 0, gl2.canvas.width, gl2.canvas.height);
    gl2.fillStyle = 'white';
    gl2.font = '20px Arial';
    gl2.fillText('Use arrow keys to move the rectangle', 20, 40);

    // Request next frame
    requestAnimationFrame(render);
}

let xpos = 0.0, ypos = 0.0;   // 초기 좌표 설정정
const move = 0.01;     // 움직이는 좌표 크기
const endpos = 0.91;   // 양수 바운더리
const endneg = -0.91;  // 음수 바운더리

// movement
window.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowUp')
    {
        if(ypos + move <= endpos)
        {
            ypos += move;
        }
    }    
    else if (event.key === 'ArrowDown')
    {
        if(ypos - move >= endneg)
        {
            ypos -= move;
        }
    }  
    else if (event.key === 'ArrowRight') 
    {
        if(xpos + move <= endpos)
        {
            xpos += move;
        }
    }
    else if (event.key === 'ArrowLeft') 
    {
        if(xpos - move >= endneg)
        {
            xpos -= move;
        }
    }
    render();  // 새롭게 랜더
});

// Start rendering
render();

