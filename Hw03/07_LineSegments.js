/*-------------------------------------------------------------------------
07_LineSegments.js

left mouse button을 click하면 선분을 그리기 시작하고, 
button up을 하지 않은 상태로 마우스를 움직이면 임시 선분을 그리고, 
button up을 하면 최종 선분을 저장하고 임시 선분을 삭제함.

임시 선분의 color는 회색이고, 최종 선분의 color는 빨간색임.

이 과정을 반복하여 여러 개의 선분 (line segment)을 그릴 수 있음. 
---------------------------------------------------------------------------*/
import { resizeAspectRatio, setupText, updateText, Axes } from '../util/util.js';
import { Shader, readShaderFile } from '../util/shader.js';

// Global variables
const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl2');
let isInitialized = false;  // main이 실행되는 순간 true로 change
let shader;
let vao;
let positionBuffer; // 2D position을 위한 VBO (Vertex Buffer Object)
let isDrawing = false; // mouse button을 누르고 있는 동안 true로 change
let startPoint = null;  // mouse button을 누른 위치
let tempEndPoint = null; // mouse를 움직이는 동안의 위치
let lines = []; // 그려진 선분들을 저장하는 array
let textOverlay; // 1st line segment 정보 표시
let textOverlay2; // 2nd line segment 정보 표시
let axes = new Axes(gl, 0.85); // x, y axes 그려주는 object (see util.js)

let x_radius;
let y_radius;
let radius;
let x_center;
let y_center;

let line_a;   // y = ax + b
let line_b;
let x_intersection_1;
let y_intersection_1;
let x_intersection_2;
let y_intersection_2;

// 판별식 
let D_a;
let D_b;
let D_c;
let D;

let temp_lines = [];
let center_g = [];
let radius_g = [];

let min_x;
let max_x;
let num_intersection;
let intersection_g = [];

// DOMContentLoaded event
// 1) 모든 HTML 문서가 완전히 load되고 parsing된 후 발생
// 2) 모든 resource (images, css, js 등) 가 완전히 load된 후 발생
// 3) 모든 DOM 요소가 생성된 후 발생
// DOM: Document Object Model로 HTML의 tree 구조로 표현되는 object model 
// 모든 code를 이 listener 안에 넣는 것은 mouse click event를 원활하게 처리하기 위해서임
// mouse input을 사용할 때 이와 같이 main을 call 한다. 

document.addEventListener('DOMContentLoaded', () => {
    if (isInitialized) { // true인 경우는 main이 이미 실행되었다는 뜻이므로 다시 실행하지 않음
        console.log("Already initialized");
        return;
    }

    main().then(success => { // call main function
        if (!success) {
            console.log('프로그램을 종료합니다.');
            return;
        }
        isInitialized = true;
    }).catch(error => {
        console.error('프로그램 실행 중 오류 발생:', error);
    });
});

function initWebGL() {
    if (!gl) {
        console.error('WebGL 2 is not supported by your browser.');
        return false;
    }

    canvas.width = 700;
    canvas.height = 700;

    resizeAspectRatio(gl, canvas);

    window.addEventListener('resize', () => {
        resizeAspectRatio(gl, canvas);
        render();
    });

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.1, 0.2, 0.3, 1.0);

    //추가
    // gl.enable(gl.PROGRAM_POINT_SIZE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    return true;
}

function setupBuffers() {
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    shader.setAttribPointer('a_position', 2, gl.FLOAT, false, 0, 0); // x, y 2D 좌표

    gl.bindVertexArray(null);
}

// 좌표 변환 함수: 캔버스 좌표를 WebGL 좌표로 변환
// 캔버스 좌표: 캔버스 좌측 상단이 (0, 0), 우측 하단이 (canvas.width, canvas.height)
// WebGL 좌표 (NDC): 캔버스 좌측 하단이 (-1, -1), 우측 상단이 (1, 1)
function convertToWebGLCoordinates(x, y) {
    return [
        (x / canvas.width) * 2 - 1,  // x/canvas.width 는 0 ~ 1 사이의 값, 이것을 * 2 - 1 하면 -1 ~ 1 사이의 값
        -((y / canvas.height) * 2 - 1) // y canvas 좌표는 상하를 뒤집어 주어야 하므로 -1을 곱함
    ];
}

/* 
    browser window
    +----------------------------------------+
    | toolbar, address bar, etc.             |
    +----------------------------------------+
    | browser viewport (컨텐츠 표시 영역)       | 
    | +------------------------------------+ |
    | |                                    | |
    | |    canvas                          | |
    | |    +----------------+              | |
    | |    |                |              | |
    | |    |      *         |              | |
    | |    |                |              | |
    | |    +----------------+              | |
    | |                                    | |
    | +------------------------------------+ |
    +----------------------------------------+

    *: mouse click position

    event.clientX = browser viewport 왼쪽 경계에서 마우스 클릭 위치까지의 거리
    event.clientY = browser viewport 상단 경계에서 마우스 클릭 위치까지의 거리
    rect.left = browser viewport 왼쪽 경계에서 canvas 왼쪽 경계까지의 거리
    rect.top = browser viewport 상단 경계에서 canvas 상단 경계까지의 거리

    x = event.clientX - rect.left  // canvas 내에서의 클릭 x 좌표
    y = event.clientY - rect.top   // canvas 내에서의 클릭 y 좌표
*/

function setupMouseEvents() {
    function handleMouseDown(event) {
        event.preventDefault(); // 이미 존재할 수 있는 기본 동작을 방지
        event.stopPropagation(); // event가 상위 요소 (div, body, html 등)으로 전파되지 않도록 방지

        const rect = canvas.getBoundingClientRect(); // canvas를 나타내는 rect 객체를 반환
        const x = event.clientX - rect.left;  // canvas 내 x 좌표
        const y = event.clientY - rect.top;   // canvas 내 y 좌표
        
        if (!isDrawing && lines.length < 101) { 
            // 1번 또는 2번 선분을 그리고 있는 도중이 아닌 경우 (즉, mouse down 상태가 아닌 경우)
            // 캔버스 좌표를 WebGL 좌표로 변환하여 선분의 시작점을 설정
            let [glX, glY] = convertToWebGLCoordinates(x, y);
            startPoint = [glX, glY];
            isDrawing = true; // 이제 mouse button을 놓을 때까지 계속 true로 둠. 즉, mouse down 상태가 됨
        }
    }

    function handleMouseMove(event) {
        if (isDrawing) { // 1번 또는 2번 선분을 그리고 있는 도중인 경우
            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            
            let [glX, glY] = convertToWebGLCoordinates(x, y);
            tempEndPoint = [glX, glY]; // 임시 선분의 끝 point

            x_center = startPoint[0];
            y_center = startPoint[1];
            x_radius = tempEndPoint[0] - startPoint[0];
            y_radius = tempEndPoint[1] - startPoint[1];
            radius = Math.pow(Math.pow(x_radius, 2) + Math.pow(y_radius, 2), 0.5);

            temp_lines = [];

            for(var i = 0; i < 100; i++)
            {
                let theta;
                theta = (2 * Math.PI) / 100;
                temp_lines.push([x_center + (radius * Math.cos(theta * i)), y_center + (radius * Math.sin(theta * i)),
                    x_center + (radius * Math.cos(theta * (i + 1))), y_center + (radius * Math.sin(theta * (i + 1)))])
            }

            render();
        }
    }

    function handleMouseUp() {
        if (isDrawing && tempEndPoint) {
 
            // lines.push([...startPoint, ...tempEndPoint])
            //   : startPoint와 tempEndPoint를 펼쳐서 하나의 array로 합친 후 lines에 추가
            // ex) lines = [] 이고 startPoint = [1, 2], tempEndPoint = [3, 4] 이면,
            //     lines = [[1, 2, 3, 4]] 이 됨
            // ex) lines = [[1, 2, 3, 4]] 이고 startPoint = [5, 6], tempEndPoint = [7, 8] 이면,
            //     lines = [[1, 2, 3, 4], [5, 6, 7, 8]] 이 됨
            
            // 추가
            if(lines.length == 0)
            {
                x_center = startPoint[0];
                center_g.push(x_center);
                y_center = startPoint[1];
                center_g.push(y_center);
                x_radius = tempEndPoint[0] - startPoint[0];
                y_radius = tempEndPoint[1] - startPoint[1];
                radius = Math.pow(Math.pow(x_radius, 2) + Math.pow(y_radius, 2), 0.5);
                radius_g.push(radius);

                for(var i = 0; i < 100; i++)
                {
                    let theta;
                    theta = (2 * Math.PI) / 100;
                    lines.push([x_center + (radius * Math.cos(theta * i)), y_center + (radius * Math.sin(theta * i)),
                        x_center + (radius * Math.cos(theta * (i + 1))), y_center + (radius * Math.sin(theta * (i + 1)))])
                }
            }
            else
            {
                lines.push([...startPoint, ...tempEndPoint]);
                line_a = (tempEndPoint[1] - startPoint[1]) / (tempEndPoint[0] - startPoint[0]);
                line_b = startPoint[1] - (line_a * startPoint[0]);

                D_a = Math.pow(line_a, 2) + 1;
                D_b = (2 * line_a * (line_b - center_g[1])) - (2 * center_g[0]);
                D_c = Math.pow(center_g[0], 2) + Math.pow((center_g[1] - line_b), 2) - Math.pow(radius_g[0], 2);

                D = Math.pow(D_b, 2) - (4 * D_a * D_c);
            } 

            if (lines.length == 100) {
                updateText(textOverlay, "Circle: center (" + x_center.toFixed(2) + ", " + y_center.toFixed(2) + 
                    ") radius = " + radius.toFixed(2));
                updateText(textOverlay2, "Click and drag to draw the line segment");
            }
            else { // lines.length == 101
                updateText(textOverlay2, "Line segment: (" + lines[100][0].toFixed(2) + ", " + lines[100][1].toFixed(2) + 
                    ") ~ (" + lines[100][2].toFixed(2) + ", " + lines[100][3].toFixed(2) + ")");
                
                if(lines[100][0] < lines[100][2])
                {
                    min_x = lines[100][0];
                    max_x = lines[100][2];
                }
                else
                {
                    min_x = lines[100][2];
                    max_x = lines[100][0];
                }
                if(D < 0)
                {
                    setupText(canvas, "No intersection", 3);

                    num_intersection = 0;
                }
                else if(D == 0)
                {
                    x_intersection_1 = -(D_b / (2 * D_a));
                    y_intersection_1 = line_a * x_intersection_1 + line_b;

                    if(min_x <= x_intersection_1 && x_intersection_1 <= max_x)
                    {
                        setupText(canvas, "Intersection Points: 1 Point 1: (" + x_intersection_1.toFixed(2) + ", " + 
                        y_intersection_1.toFixed(2) + ")", 3);

                        intersection_g.push([x_intersection_1, y_intersection_1]);

                        num_intersection = 1;

                    }
                    else
                    {
                        setupText(canvas, "No intersection", 3);

                        num_intersection = 0;
                    }

                    render()
                }
                else
                {
                    x_intersection_1 = (0 - Math.pow(D, 0.5) - D_b) / (2 * D_a);
                    x_intersection_2 = (Math.pow(D, 0.5) - D_b) / (2 * D_a);
                    y_intersection_1 = line_a * x_intersection_1 + line_b;
                    y_intersection_2 = line_a * x_intersection_2 + line_b;

                    if(min_x <= x_intersection_1 && x_intersection_2 <= max_x)
                    {
                        setupText(canvas, "Intersection Points: 2 Point 1: (" + x_intersection_1.toFixed(2) + ", " +
                        y_intersection_1.toFixed(2) + ") Point 2: (" + x_intersection_2.toFixed(2) + ", " +
                        y_intersection_2.toFixed(2) + ")", 3);
                        
                        intersection_g.push([x_intersection_1, y_intersection_1], [x_intersection_2, y_intersection_2]);

                        num_intersection = 2;
                    }
                    else if(max_x < x_intersection_1 || x_intersection_2 < min_x || (x_intersection_1 < min_x &&
                        max_x < x_intersection_2))
                    {
                        setupText(canvas, "No intersection", 3);

                        num_intersection = 0;
                    }
                    else if(min_x <= x_intersection_1 && x_intersection_1 <= max_x)
                    {
                        setupText(canvas, "Intersection Points: 1 Point 1: (" + x_intersection_1.toFixed(2) + ", " + 
                        y_intersection_1.toFixed(2) + ")", 3);

                        intersection_g.push([x_intersection_1, y_intersection_1]);

                        num_intersection = 1;
                    }
                    else if(min_x <= x_intersection_2 && x_intersection_2 <= max_x)
                    {
                        setupText(canvas, "Intersection Points: 1 Point 1: (" + x_intersection_2.toFixed(2) + ", " + 
                        y_intersection_2.toFixed(2) + ")", 3);

                        intersection_g.push([x_intersection_2, y_intersection_2]);

                        num_intersection = 1;
                    }
                    render();
                }
            }

            isDrawing = false;
            startPoint = null;
            tempEndPoint = null;
            render();
        }
    }

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
}

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    shader.use();
    
    // 저장된 선들 그리기
    let num = 0;
    for (let line of lines) {
        if (num <= 99) { // 첫 번째 선분인 경우, yellow
            shader.setVec4("u_color", [1.0, 0.0, 1.0, 1.0]);
        }
        else { // num == 1 (2번째 선분인 경우), red
            shader.setVec4("u_color", [0.0, 0.0, 1.0, 0.4]);
        }
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(line), gl.STATIC_DRAW);
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.LINES, 0, 2);
        num++;
    }

    // 임시 선 그리기
    if (isDrawing && startPoint && tempEndPoint) {
        if(lines.length == 0)
        {
            for(let line of temp_lines)
            {
                shader.setVec4("u_color", [0.5, 0.5, 0.5, 1.0]); // 임시 선분의 color는 회색
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(line), gl.STATIC_DRAW);
                gl.bindVertexArray(vao);
                gl.drawArrays(gl.LINES, 0, 2);
            }
        }
        else
        {
            shader.setVec4("u_color", [0.5, 0.5, 0.5, 1.0]); // 임시 선분의 color는 회색
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([...startPoint, ...tempEndPoint]), 
                          gl.STATIC_DRAW);
            gl.bindVertexArray(vao);
            gl.drawArrays(gl.LINES, 0, 2);
        }
    }

    if(num_intersection == 1 || num_intersection == 2)
    {
        for(let point of intersection_g)
        {
            shader.setVec4("u_color", [1.0, 1.0, 0.0, 1.0]); // 교차점의 color는 노랑색
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(point), 
                            gl.STATIC_DRAW);
            gl.bindVertexArray(vao);
            gl.drawArrays(gl.POINTS, 0, 1);
        }
    }

    // axes 그리기
    axes.draw(mat4.create(), mat4.create()); // 두 개의 identity matrix를 parameter로 전달
}

async function initShader() {
    const vertexShaderSource = await readShaderFile('shVert.glsl');
    const fragmentShaderSource = await readShaderFile('shFrag.glsl');
    shader = new Shader(gl, vertexShaderSource, fragmentShaderSource);
}

async function main() {
    try {
        if (!initWebGL()) {
            throw new Error('WebGL 초기화 실패');
            return false; 
        }

        // 셰이더 초기화
        await initShader();
        
        // 나머지 초기화
        setupBuffers();
        shader.use();

        // 텍스트 초기화
        textOverlay = setupText(canvas, "No circle and line segment", 1);
        textOverlay2 = setupText(canvas, "Click mouse button and drag to draw circle and line segment", 2);
        
        // 마우스 이벤트 설정
        setupMouseEvents();
        
        // 초기 렌더링
        render();

        return true;
        
    } catch (error) {
        console.error('Failed to initialize program:', error);
        alert('프로그램 초기화에 실패했습니다.');
        return false;
    }
}
