
let mainCanvas;
let grid = [];
let neighbourPositions = [];
let rows = 70;
let cols = rows;

let sandHeightMax = 1;
let sandHeightDefault = 0.5;
let slopeStabilityThreshold = 0.25;
let slopeDeteriorationRate = 0.05;

let colorRakeActive;
let colorRakeIdle;
let erasePct = 0;

let handleLengthMax = 150;
let handleLengthMin = 100;
let handleLength = 125;
let handlePos; // where the handle touches the ground and intersects the perpendicular rake
let handlePosPrev;
let handleDir;

let rakeWidth = 200;
let rakePointCount = 6;
let rakeDir;

function setup() {
    let size = min(windowWidth, windowHeight);
    mainCanvas = createCanvas(size, size);
    initGrid();
    neighbourPositions.push(createVector(0,-1));
    neighbourPositions.push(createVector(0,+1));
    neighbourPositions.push(createVector(+1,0));
    neighbourPositions.push(createVector(-1,0));
    handlePos = createVector();
    handlePosPrev = createVector();
    rakeDir = createVector();
    colorRakeActive = color(255, 0, 0);
    colorRakeIdle = color(150, 0, 0);
}

function updateSidebar() {
    slopeStabilityThreshold = sliderFloat("slider_slopeStabilityThreshold");
    slopeDeteriorationRate = sliderFloat("slider_slopeDeteriorationRate");
    let intendedDetail = sliderInt("slider_detail");
    if(intendedDetail !== rows){
        rows = intendedDetail;
        cols = rows;
        initGrid();
    }
    rakeWidth = sliderInt("slider_rakeWidth");
    rakePointCount = sliderInt("slider_rakePoints");
}

function sliderFloat(sliderName){
    return parseFloat(document.getElementById(sliderName).value)  / 1000.
}

function sliderInt(sliderName){
    return parseFloat(document.getElementById(sliderName).value)
}

function draw() {
    background(0);
    updateSidebar();
    if(mouseIsPressed){
        rakePressSand();
    }

    moveHandleAndRake();
    updateGrid();
    drawGrid();
    drawHandleAndRake();
}

function initGrid(){
    for(let i = 0; i < cols * rows; i++){
        grid.push({
            sandHeight : sandHeightDefault,
            pressed : false,
            ignored : false
        });
    }
}

function updateGrid(){
    for(let yi = 1; yi < rows - 1; yi++){
        for(let xi = 1; xi < cols - 1; xi++){
            updateCell(xi,yi);
        }
    }
    resetGridInteraction();
}

function resetGridInteraction(){
    for(let i = 0; i < cols * rows; i++){
        grid[i].ignored = false;
        grid[i].pressed = false;
        grid[i].sandHeight = constrain(grid[i].sandHeight, 0, sandHeightMax);
    }
}

function constrain(val, minVal, maxVal){
    return max(minVal, min(maxVal, val));
}

function updateCell(x, y){
    let cell = getCell(x,y);
    if(cell == null || cell.ignored){
        return;
    }
    if(cell.pressed){
        displace(x, y, cell); // sand is displaced to neighbour cells when clicked by the user
    }
    erodeSlopes(x, y, cell); // sand flows down when a slope is steep
}

function displace(x, y, cell){
    let cellsToDisplaceInto = [];
    // displacement of pressed sand into neighbour cells
    for(let i = 0; i < neighbourPositions.length; i++){
        let neighbourPos = neighbourPositions[i];
        let neighbour = getCell(floor(x + neighbourPos.x), floor(y + neighbourPos.y));
        if(neighbour == null || neighbour.pressed || neighbour.ignored){
            continue;
        }
        cellsToDisplaceInto.push(neighbour);
    }
    if(cellsToDisplaceInto.length > 0){
        let amountToDisplace = constrain(cell.sandHeight, 0, sandHeightMax);
        //evenly distribute sand into available neighbours
        let amountToDisplacePerNeighbour = amountToDisplace / cellsToDisplaceInto.length;
        cell.sandHeight -= amountToDisplace;

        for(let i = 0; i < cellsToDisplaceInto.length; i++){
            let neighbour = cellsToDisplaceInto[i];
            neighbour.sandHeight += amountToDisplacePerNeighbour;
        }
    }
}

function erodeSlopes(x, y, cell){
    for(let i = 0; i < neighbourPositions.length; i++){
        let neighbourPos = neighbourPositions[i];
        let neighbour = getCell(floor(x + neighbourPos.x), floor(y + neighbourPos.y));
        if(neighbour == null || neighbour.pressed || neighbour.ignored){
            continue;
        }
        let slope = cell.sandHeight - neighbour.sandHeight;
        if(slope > slopeStabilityThreshold){
            cell.sandHeight -= slopeDeteriorationRate;
            neighbour.sandHeight += slopeDeteriorationRate;
            neighbour.ignored = true;
        }
    }
}

function drawGrid(){
    rectMode(CENTER);
    noStroke();
    let w = width / cols;
    let h = height / rows;
    for(let xi = 0; xi < cols; xi++){
        for(let yi = 0; yi < rows; yi++){
            let x = map(xi, 0, cols-1, 0, width);
            let y = map(yi, 0, rows-1, 0, height);
            let cell = getCell(xi, yi);
            fill(map(cell.sandHeight, 0, sandHeightMax, 0, 255));
            rect(x,y,w+2,h+2);
        }
    }
}

function drawSandLine(x0, y0, x1, y1, weight, fn){
    let speed = max(1, dist(x0, y0, x1, y1));
    for(let i = 0; i < speed; i++){
        let lerpAmount = map(i, 0, speed, 0, 1);
        let x = lerp(x0, x1, lerpAmount);
        let y = lerp(y0, y1, lerpAmount);
        let xi = floor(map(x, 0, width, 0, cols));
        let yi = floor(map(y, 0, height, 0, rows));
        for(let xn = xi - weight; xn <= xi + weight; xn++){
            for(let yn = yi - weight; yn <= yi + weight; yn++){
                let cell = getCell(xn, yn);
                if(cell != null){
                    fn(cell);
                }
            }
        }
    }
}

function getCell(x, y){
    return grid[x + y * cols];
}

function setCell(x, y ,val){
    grid[x + y * cols] = val;
}

// HANDLE AND RAKE CODE

function moveHandleAndRake() {
    // TODO try to keep the less moving rake edge constant as you rotate around it rather than rotating the whole thing
    let mouse = createVector(mouseX, mouseY);
    handleDir = p5.Vector.sub(handlePos, mouse);
    handleDir = constrainVectorMag(handleDir, handleLengthMin, handleLengthMax);
    handleLength = handleDir.mag();
    handlePosPrev = handlePos.copy();
    handlePos = mouse.copy().add(handleDir);
    rakeDir = handleDir.copy().rotate(HALF_PI).setMag(rakeWidth / 2);
}

function constrainVectorMag(vec, low, high) {
    let mag = vec.mag();
    if (mag < low) {
        vec.setMag(low);
    }
    if (mag > high) {
        vec.setMag(high);
    }
    return vec;
}

function drawHandleAndRake() {
    if (mouseIsPressed) {
        stroke(colorRakeActive);
    } else {
        stroke(colorRakeIdle);
    }
    strokeWeight(5);
    line(mouseX, mouseY, handlePos.x, handlePos.y);
    line(
        handlePos.x + rakeDir.x, handlePos.y + rakeDir.y,
        handlePos.x - rakeDir.x, handlePos.y - rakeDir.y
    );
}

function rakePressSand(){
    if (mouseIsPressed) {
        erasePct = 1 - map(handleLength, handleLengthMin, handleLengthMax, 0, 1);
        for (let rakePointIndex = 0; rakePointIndex < rakePointCount; rakePointIndex++) {
            let rakeOffsetMult = map(rakePointIndex, 0, rakePointCount - 1, -1, 1);
            let rakePointPos = p5.Vector.mult(rakeDir, rakeOffsetMult).add(handlePos);
            let rakePointPosPrev = p5.Vector.mult(rakeDir, rakeOffsetMult).add(handlePosPrev);
            if (erasePct < 0.5) {
                drawSandLine(rakePointPos.x, rakePointPos.y, rakePointPosPrev.x, rakePointPosPrev.y, 0,function (cell) {
                    cell.pressed = true;
                });
            }else{
                drawSandLine(rakePointPos.x, rakePointPos.y, rakePointPosPrev.x, rakePointPosPrev.y, 1, function (cell) {
                    cell.sandHeight = sandHeightDefault;
                });
            }
        }
    }
}