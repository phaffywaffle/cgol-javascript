// Something I didn't realize and that took forever to debug is that now that HTML inputs are working,
// their default values have to match the default values here, otherwise you can have some strange side effects

// Don't touch---------------------------------
var canvas = document.getElementById('canvas');
context = canvas.getContext('2d');
var uses_controls = true;
var width;
var height;
var ratio;
var cell_width;
var cell_height;
// Inconsistant. Oops
var updateTask;
var repeatTask;

// Touch---------------------------------------
var cols = 600;
var rows = 600;

// E.g. Inverse framerate
var timeout = 1;

// To guarantee cells are perfect squares.
// Uses the cols variable only
var make_square = true;

// Render the grid
var draw_grid = false;

// Set to false to reset the game periodically
var one_game_only = true;

// The rate at which the game will reset in seconds
// Game lags like crazy whenever it's reset
// Recommend no less than 45 seconds
var game_interval = 5 * 60;

// For console messages
// Tested with Firefox on Windows 10 @ 100ms delay
// With <100 rows & columns latency everything >Level 3 will probably run below 20 fps
// With >200 rows & columns, everything >Level 3 will probably crash your browser tab
// Level 1:	Global Debug Logging		(Delays startup only)
// Level 2:	Inital live cell state logging	(Delays startup only)
// Level 3:	All initial cell states 	(Terrible startup lag)
// Level 4:	Per-frame alive cell states	(Apocalyptic lag)
// Level 5: 	Per-frame cell states 		(Hope you like 1 fps)
// Level 7:	All messages 			(Will probably crash your browser console)
var debug = true;
var debug_level = 1;

// Colors
var dead_color = "black";
var alive_color = "white";
var grid_color = "red"

if(uses_controls) { setHTMLDefaultControls(); }



// Functions --------------------------------------

// To resize dimensions properly if the window changes
function resize()
{
	width = window.innerWidth;
	height = window.innerHeight;
	ratio = width / height;
	canvas.width = width;
	context.canvas.width = width;
	if(make_square)
	{ // This guarantees squareness at the cost of a perfect canvas size
//		rows = cols;
		cell_width = width / cols;
		cell_height = cell_width;		
		canvas.height = width / ratio;
		context.canvas.height = width / ratio;
	} 
	else
	{ // This guarantees a perfect canvas size at the cost of squareness
		cell_width = width / cols;
		cell_height = height / rows;	
		canvas.height = height;
		context.canvas.height = height;
	}
}
resize();
window.onresize = function(event) {
	resize();
};

if(debug)
{
	console.log("width: " + width);
	console.log("height: " + height);
	console.log("cols: " + cols);
	console.log("rows: " + rows);
	console.log("cell_width: " + cell_width);
	console.log("cell_height: " + cell_height);
	console.log("dead_color: " + dead_color);
	console.log("alive_color: " + alive_color);
	console.log("grid_color: " + grid_color);
}

// Not in use, but still damn cool
function gcd(a, b)
{
	if(a == 0 || b == 0) return(a + b);
	return(gcd(b, a % b));
}

// Cell Functions ---------------------------------

function Cell(x, y, alive, will_die)
{
	this.x = x;
	this.y = y;
	this.alive = alive;
	this.will_die = will_die;
	this.live_neighbors = 0;
	// Take this out to optimize ?
	this.print = function() { console.log("Cell, x: " + this.x + ", y: " + this.y + ", alive: " + this.alive + ", live neighbors: " + this.live_neighbors + ", will_die: " + this.will_die); }
}

function initCells()
{
	var tempcells = [];
	tempcells.length = rows * cols;
	for(var y = 0; y < rows; y++) { for(var x = 0; x < cols; x++) {
		tempcells[y * cols + x] = new Cell(x, y, false, true);
	} }
	return(tempcells);
}

function initSeeds(seeds)
{
	var tempcells = initCells();
	if(seeds.length > 0) { for(var i = 0; i < seeds.length; i++) { tempcells[seeds[i][1].y * cols + seeds[i][0].x].alive = true; } }
	else { for(var i = 0; i < tempcells.length; i++) { tempcells[i].alive = Math.random() >= 0.5; } }
	if(debug && debug_level > 1) { for(var i = 0; i < tempcells.length; i++) { if(debug_level >= 3){ tempcells[i].print(); }else if(tempcells[i].alive) { tempcells[i].print(); } } }
	return(tempcells);
}

function printCells(tempcells) { for(var i = 0; i < tempcells.length; i++) { tempcells[i].print(); } }

// Returns the number AND changes cell state
function findNeighbors(cell)
{
	var x = cell.x;
	var y = cell.y;
	cell.live_neighbors = 0;
	// North Neighbor
	if(y > 0) { if(cells[(y - 1) * cols + x].alive) { cell.live_neighbors++; } }
	// North-East Neighbor
	if(y > 0 && x < (cols - 1)) { if(cells[(y - 1) * cols + (x + 1)].alive) { cell.live_neighbors++; } }
	// East Neighbor
	if(x < (cols - 1)) { if(cells[y * cols + (x + 1)].alive) { cell.live_neighbors++; } }
	// South-East Neighbor
	if(y < (rows - 1) && x < (cols - 1)) { if(cells[(y + 1) * cols + (x + 1)].alive) { cell.live_neighbors++; } }
	// South Neighbor
	if(y < (rows - 1)) { if(cells[(y + 1) * cols + x].alive) { cell.live_neighbors++; } }
	// South-West Neighbor
	if(y < (rows - 1) && x > 0) {if(cells[(y + 1) * cols + (x - 1)].alive) { cell.live_neighbors++; } }
	// West Neighbor
	if(x > 0) { if(cells[y * cols + (x - 1)].alive) { cell.live_neighbors++; } }
	// North-West Neighbor
	if(x > 0 && y > 0) { if(cells[(y - 1) * cols + (x - 1)].alive) { cell.live_neighbors++; } }	
	
	return(cell.live_neighbors);
}

// Window Functions -------------------------------

function clear() { context.fillStyle = dead_color; context.fillRect(0, 0, width, height); }

function draw(cells)
{
	context.fillStyle = alive_color;
	for(var y = 0; y < rows; y++) { for(var x = 0; x < cols; x++) {
		if(cells[y * cols + x].alive)
		{ 
			// fillRect does NOT take two coordinates; it takes one coordinate and the length to draw on each axis. How annoying.
			context.fillRect(x * cell_width, y * cell_height, cell_width, cell_height);
			if(debug && debug_level >= 4) { if(debug_level < 5) { if(cells[y * cols + x].alive) { cells[y * cols + x].print(); } } else { cells[y * cols + x].print(); } } 
		}
	} }
}

function drawGrid()
{
	context.fillStyle = grid_color;
	if(make_square) { for(var i = 0; i <= cols; i++)
	{
		context.fillRect(cell_width * i,0,1,height);
		context.fillRect(0,cell_height * i,width, 1);
	} }
	else
	{
		for(var i = 0; i <= rows; i++) { context.fillRect(0,cell_height * i,width, 1); }
		for(var i = 0; i <= cols; i++) { context.fillRect(cell_width * i,0,1,height); }
	}
}


function update()
{
	clear();
	draw(cells);
	if(draw_grid) { drawGrid(); }
	var to_die
	for(var i = 0; i < cells.length; i++)
	{	
		var neighbors = findNeighbors(cells[i]);	
		// Rule 4
		if(!cells[i].alive && neighbors == 3) { cells[i].will_die = false;}
		// To save time going through switches
		else if(cells[i].alive)
		{	  
			if(neighbors < 2) { cells[i].will_die = true; } // Rule 1
			else if(neighbors < 4) { cells[i].will_die = false; continue; } // Rule 2
			else if (neighbors < 9) { cells[i].will_die = true; } // Rule 3
			// Default case should NEVER happen
			else { console.log("ERROR: Impossible for cell to have more than 8 neighbors. Cell[" +  cells[i].x + "," +cells[i].y + "] reports " + neighbors + " neighbors"); break; }
		}
		else { cells[i].will_die = true; }
	}
	for(var i = 0; i < cells.length; i++)
	{
		if(cells[i].will_die) { cells[i].alive = false; }
		else { cells[i].alive = true; }
	}
}

// Used to start and reset the game
function reset()
{	
	resize();
	cells = initSeeds([]);
	gameSpeed(timeout);
}

// Used to change the speed of the game
function gameSpeed(newSpeed)
{	
	timeout = newSpeed;
	if(updateTask) { clearInterval(updateTask); }
	updateTask = setInterval(update, timeout);
}

// Used to change whether the game will reset
// Not to be confused with reset() which resets the game immediately
function repeat(newGameInterval, newSpeed)
{
	// I hate this inconsistency
	game_interval = newGameInterval;

	if(newGameInterval == 0) { one_game_only = true; }
	else { one_game_only = false; }

	if(newSpeed > 0) { timeout = newSpeed; gameSpeed(timeout); }
	
	if(repeatTask) { clearInterval(repeatTask); }
	if(!one_game_only) { repeatTask = setInterval(reset, game_interval * 1000); }
}

// HTML CallBackFunctions --------------

function setHTMLDefaultControls()
{
	rows = document.getElementById("rowSlider").value;
	cols = document.getElementById("columnSlider").value;
	timeout = document.getElementById("delaySlider").value;
	var b_r = document.getElementById("bredSlider").value; var b_g = document.getElementById("bgreenSlider").value; var b_b = document.getElementById("bblueSlider").value; dead_color = "rgba(" + b_r + ", " + b_g + ", " + b_b + ", 1)";
	var c_r = document.getElementById("credSlider").value; var c_g = document.getElementById("cgreenSlider").value; var c_b = document.getElementById("cblueSlider").value; alive_color = "rgba(" + c_r + ", " + c_g + ", " + c_b + ", 1)";
	var g_r = document.getElementById("gredSlider").value; var g_g = document.getElementById("ggreenSlider").value; var g_b = document.getElementById("gblueSlider").value; grid_color = "rgba(" + g_r + ", " + g_g + ", " + g_b + ", 1)";
	make_square = document.getElementById("squareCheckbox").checked;
	draw_grid = document.getElementById("gridCheckbox").checked;
}

function r_input()
{
	if(make_square) { return; }
	rows = document.getElementById("rowSlider").value;
	reset();
}

function c_input() { cols = document.getElementById("columnSlider").value; reset(); }

function timeout_input() { timeout = document.getElementById("delaySlider").value; gameSpeed(timeout); }

function color_input()
{
	var b_r = document.getElementById("bredSlider").value; var b_g = document.getElementById("bgreenSlider").value; var b_b = document.getElementById("bblueSlider").value; dead_color = "rgba(" + b_r + ", " + b_g + ", " + b_b + ", 1)";
	var c_r = document.getElementById("credSlider").value; var c_g = document.getElementById("cgreenSlider").value; var c_b = document.getElementById("cblueSlider").value; alive_color = "rgba(" + c_r + ", " + c_g + ", " + c_b + ", 1)";
	var g_r = document.getElementById("gredSlider").value; var g_g = document.getElementById("ggreenSlider").value; var g_b = document.getElementById("gblueSlider").value; grid_color = "rgba(" + g_r + ", " + g_g + ", " + g_b + ", 1)";
}

function square_input() { make_square = document.getElementById("squareCheckbox").checked; resize(); }

function grid_input() { draw_grid = document.getElementById("gridCheckbox").checked; }

// Game -------------------------------------------

// To test the seeder:
// var test_seeds = [ /* Sugar glider */ [1,0],[2,1],[2,2],[1,2],[0,2], /* Top Border */ [4,0],[9,0],[14,0],[19,0],[24,0],[29,0],[34,0],[39,0],[44,0],[49,0],[54,0],[59,0],[64,0],[69,0], /* Left Border*/ [72,1],[72,5],[72,11],[72,15],[72,21],[72,25],[72,31],[72,35],[72,41], /* Random Junk */ [30,30],[31,30],[32,30],[32,31],[32,32],[33,33],[33,34],[32,34],];
// var cells = initSeeds(test_seeds);
// printCells(cells);

var cells;
reset();
if(!one_game_only) { repeat(game_interval, timeout); }