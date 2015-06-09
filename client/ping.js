// Stuff

var WIDTH = 1024;
var BOARD_WIDTH_PIXELS = (5 / 9) * WIDTH;
var HEIGHT = BOARD_WIDTH_PIXELS + 10;

var BG_COLOR = 0x111111;
var COLOR_WHITE = 0xFF0000;
var COLOR_WHITE_BLOCK = 0x800000;
var COLOR_BLACK = 0x0000FF;
var COLOR_BLACK_BLOCK = 0x000080;
var COLOR_BOTH = 0x800080;
var COLOR_CANDIDATE = 0x333333;

var PLAYER_NAME_WHITE = 'white';
var PLAYER_NAME_BLACK = 'black';

var renderer = PIXI.autoDetectRenderer(WIDTH, HEIGHT);

var stage = new PIXI.Stage(BG_COLOR);

// add the renderer view element to the DOM
document.body.appendChild(renderer.view);

function openWebSocket(wsUri, game) {
    if ("WebSocket" in window) {
        // Chrome, IE10
        webSocket = new WebSocket(wsUri);
        webSocket.game = game;
    } else if ("MozWebSocket" in window) {
        // Firefox 7-10 (currently vendor prefixed)
        webSocket = new MozWebSocket(wsUri);
        websocket.game = game;
    } else {
        throw "neither WebSocket nor MozWebSocket available";
    }
    
    webSocket.onopen = function(e) {
        this.game.join();
    };

    webSocket.onclose = function(e) {
       console.log(e.reason);
    };

    webSocket.onerror = function(e) {
        console.log("onerror called");
    };

    webSocket.onmessage = function(e) {
        var data = JSON.parse(e.data);
        switch (data.type) {
        case "joined":
            this.game.headerText.setText("Waiting...");
            this.game.board = new Board(data.board_width, data.moves_per_turn);
            //this.game.shapes = new ShapeUI(data.shapes);
            break;
        case "start":
        case "update":
            if (data.your_color !== undefined) {
                this.game.headerText.setText(" You:");
                this.game.headerText.x -= this.game.board.GRID_WIDTH;
                this.game.player = data.your_color;
                if (this.game.player === "white") {
                    this.game.color = COLOR_WHITE;
                    this.game.opponent_color = COLOR_BLACK;
                } else {
                    this.game.color = COLOR_BLACK;
                    this.game.opponent_color = COLOR_WHITE;
                }
            }
            this.game.started = true;
            this.game.turn = data.turn;
            this.game.movesRemaining = data.moves_remaining;
            this.game.update(data.board);
            break;
        case "end":
            this.game.gameOver = true;
            stage.removeChild(this.game.turnText);
            this.game.turnText = null;
            stage.removeChild(this.game.moveText);
            this.game.moveText = null;
            if (data.result === "win") {
                this.game.headerText.setText("You Win!\n(" + data.reason + ")");
            } else {
                this.game.headerText.setText("You Lose!\n(" + data.reason + ")");
            }
            this.game.headerText.x += this.game.board.GRID_WIDTH;
            break;
        default:
            console.log("Unknown Data:" + e.data);
            return;
        }
        
        this.game.draw();
    };

    return webSocket;
};

/*function ShapeUI(origin, shapes) {
    this.origin = origin;
    this.shapes = shapes;
    this.BORDER_WIDTH = 15;

    if (shapes.length == 0) {
        return;
    }

    var minX = maxX = shapes[0][0][0];
    var minY = maxY = shapes[0][0][1];
    for (var i = 0; i < this.shapes.length; i++) {
        var shape = shapes[i];
        for (var j = 0; j < shape.length; j++) {
            var x = shape[j][0];
            var y = shape[j][1];

            if (x < minX) {
                minX = x;
            } else if (x > maxX) {
                maxX = x;
            }

            if (y < minY) {
                minY = y;
            } else if (y > maxY) {
                maxY = y;
            }
        }
    }

    for (var i = 0; i < this.shapes.length; i++) {
        var shape = shapes[i];
        for (var j = 0; j < shape.length; j++) {
            var x = shape[j][0];
            var y = shape[j][1];

            if (x < minX) {
                minX = x;
            } else if (x > maxX) {
                maxX = x;
            }

            if (y < minY) {
                minY = y;
            } else if (y > maxY) {
                maxY = y;
            }
        }
    }
};

ShapeUI.prototype.draw = function(origin) {
};
*/

function Game(name) {
    // Key codes
    this.KEY_LEFT = 37;
    this.KEY_UP = 38;
    this.KEY_RIGHT= 39;
    this.KEY_DOWN = 40;
    this.KEY_SPACEBAR = 32;
    this.pressed = {};

    // game state
    this.name = name;
    this.board = null;
    this.shapes = null;
    this.player = null;
    this.color = null;
    this.opponent_color = null;
    this.player_pos = null;
    this.turn = null;
    this.turn_number = 0;
    this.movesRemaining = 0;
    this.started = false;
    this.gameOver = false;

    // websocket stuff
    var hostname = window.location.hostname;
    var port = "9001";
    var wsUri = "ws://" + hostname + ":" + port + "/";
    this.ws = openWebSocket(wsUri, this);
    this.ws.binaryType = "arraybuffer";

    // graphics stuff
    this.graphics = new PIXI.Graphics();
    this.turnText = null;
    this.moveText = null;
    this.headerText = new PIXI.Text("Joining...", {font:"bold 30px Courier New", stroke:"#00CC00", fill:"#00CC00", align: "center"});
    this.headerText.position.x = BOARD_WIDTH_PIXELS + (WIDTH - BOARD_WIDTH_PIXELS) / 2;
    this.headerText.position.y = 30;
    this.headerText.anchor.x = 0.5;

    // All tiles that get drawn in board squares
    this.tiles = [];

    stage.addChild(this.graphics);
    stage.addChild(this.headerText);
};

Game.prototype.onKeyDown = function(e) {
    if (this.pressed[e.keyCode] ||
        !this.started ||
        this.turn != this.player) {
        return;
    }

    var dir = null;
    switch (e.keyCode) {
    case this.KEY_UP:
        dir = "N";
        break;
    case this.KEY_DOWN:
        dir = "S";
        break;
    case this.KEY_LEFT:
        dir = "W";
        break;
    case this.KEY_RIGHT:
        dir = "E";
        break;
    case this.KEY_SPACEBAR:
        this.ping();
        break;
    }

    if (dir !== null) {
        if (e.shiftKey) {
            this.shoot(dir);
        } else {
            this.move(dir);
        }
    }
}

Game.prototype.onKeyUp = function(e) {
    this.pressed[e.keyCode] = false;
}

Game.prototype.join = function() {
    var str = JSON.stringify({
        "type": "join",
        "name": this.name
    });
    this.ws.send(str);
};

Game.prototype.move = function(dir) {
    var str = JSON.stringify({
        "type": "move",
        "direction": dir
    });
    this.ws.send(str);
};

Game.prototype.shoot = function(dir) {
    var str = JSON.stringify({
        "type": "shoot",
        "direction": dir
    });
    this.ws.send(str);
};

Game.prototype.ping = function(dir) {
    var str = JSON.stringify({
        "type": "ping"
    });
    this.ws.send(str);
};

Game.prototype.addMoveCandidates = function(loc) {
    var dirs = [[1, 0, 'E'], [0, 1, 'S'], [-1, 0, 'W'], [0, -1, 'N']];

    for (var i = 0; i < dirs.length; i++) {
        var dir = dirs[i][2];
        var testLoc = new PIXI.Point(loc.x + dirs[i][0], loc.y + dirs[i][1]);

        if (this.board.isValid(testLoc)) {
            var testLocValue = this.board.getPos(testLoc);
            if (testLocValue === Board.TILE_CLEAR) {
                this.board.setPos(this, testLoc, Board.TILE_MOVE_CANDIDATE, 0.5, dir);
            }
        }
    }
};

Game.prototype.update = function(boardSpec) {
    this.board.clearBoard();

    var positions = new Object();
    positions[PLAYER_NAME_WHITE] = new PIXI.Point(boardSpec.white_player[0], boardSpec.white_player[1]);
    positions[PLAYER_NAME_BLACK] = new PIXI.Point(boardSpec.black_player[0], boardSpec.black_player[1]);

    if (positions[PLAYER_NAME_WHITE].x === positions[PLAYER_NAME_BLACK].x &&
        positions[PLAYER_NAME_WHITE].y === positions[PLAYER_NAME_BLACK].y) {
        this.board.setPos(this, positions[PLAYER_NAME_WHITE], Board.TILE_PLAYER_BOTH);
    } else {
        this.board.setPos(this, positions[PLAYER_NAME_WHITE], Board.TILE_PLAYER_WHITE);
        this.board.setPos(this, positions[PLAYER_NAME_BLACK], Board.TILE_PLAYER_BLACK);
    }

    if (this.player === this.turn) {
        this.addMoveCandidates(positions[this.player]);
    }
}

Game.prototype.draw = function() {
    this.board.draw(this.graphics);

    for (var i = 0; i < this.tiles.length; i++) {
        this.tiles[i].draw(this.graphics);
    }

    textX = BOARD_WIDTH_PIXELS + (WIDTH - BOARD_WIDTH_PIXELS) / 2;
    if (this.started && !this.gameOver) {
        // Draw the player's color for the 'You:' text box
        var pos = 
            new PIXI.Point(this.headerText.position.x + this.headerText.width/2 + 10,
                           this.headerText.position.y - this.headerText.height/4);
        this.board.drawSquare(pos, this.color, this.graphics);

        var yDelta = 75;
        var info = "Turn:";
        if (this.turnText === null) {
            this.turnText = new PIXI.Text(info, {font:"bold 30px Courier New", stroke:"#00CC00", fill:"#00CC00", align: "center"});
            this.turnText.position.x = this.headerText.position.x;
            this.turnText.position.y = this.headerText.y + yDelta;
            this.turnText.anchor.x = 0.5;
            stage.addChild(this.turnText);
        } else {
            this.turnText.setText(info);
        }

        if (this.player === this.turn) {
            var color = this.color;            
            var curMove = "Moves: " + this.movesRemaining;
        } else {
            var color = this.opponent_color;
            var curMove = "Opponent Moves: " + this.movesRemaining;
        }

        pos.y += yDelta;
        this.board.drawSquare(pos, color, this.graphics);

        if (this.moveText === null) {
            this.moveText = new PIXI.Text(curMove, {font:"bold 30px Courier New", stroke:"#00CC00", fill:"#00CC00", align: "center"});
            this.moveText.position.x = textX;
            this.moveText.position.y = this.turnText.y + yDelta;
            this.moveText.anchor.x = 0.5;
            stage.addChild(this.moveText);
        } else {
            this.moveText.setText(curMove);
        }
    }
};

function Tile(game, x, y, color, width, alpha, dir) {
    PIXI.DisplayObjectContainer.call(this);

    // This appears to be required for PIXI?
    this.children = [];

    if (alpha === undefined) {
        alpha = 1;
    }

    if (dir === undefined) {
        this.dir = null;
    } else {
        this.dir = dir;
    }

    this.x = x;
    this.y = y;
    this.tile_width = width;
    this.color = color;
    this.alpha = alpha;
    this.game = game;

    // Inherited from DisplayObject
    this.hitArea = new PIXI.Rectangle(0, 0, this.tile_width, this.tile_width);

    if (dir !== null) {
        this.mousedown = function(interactionData) {
            if (this.dir !== null) {
                this.game.move(this.dir);    
            }
        };
    }
};

Tile.prototype = Object.create(PIXI.DisplayObjectContainer.prototype);
Tile.prototype.constructor = Tile;

Tile.prototype.draw = function(graphics) {
    graphics.lineStyle(1, this.color, this.alpha);

    graphics.beginFill(this.color, this.alpha);
    graphics.moveTo(this.x, this.y);
    graphics.lineTo(this.x + this.tile_width, this.y);
    graphics.lineTo(this.x + this.tile_width, this.y + this.tile_width);
    graphics.lineTo(this.x, this.y + this.tile_width);
    graphics.lineTo(this.x, this.y);
    graphics.endFill();
}

function Board(boardWidth, movesPerTurn) {
    Board.TILE_CLEAR = 0;
    Board.TILE_BLOCK_BLACK = 1;
    Board.TILE_BLOCK_WHITE = 2;
    Board.TILE_PLAYER_BLACK = 3;
    Board.TILE_PLAYER_WHITE = 4;
    Board.TILE_PLAYER_BOTH = 5;
    Board.TILE_MOVE_CANDIDATE = 6;

    this.BOARD_WIDTH = boardWidth;
    this.MOVES_PER_TURN = movesPerTurn;
    this.LINE_THICKNESS = 4;
    this.GRID_WIDTH = BOARD_WIDTH_PIXELS / this.BOARD_WIDTH;
    this.ORIGIN = new PIXI.Point(5, 5);
    this.TILE_WIDTH = this.GRID_WIDTH - this.LINE_THICKNESS - this.LINE_THICKNESS / 4;

    this.colors = new Object();
    this.colors[Board.TILE_CLEAR] = 0x000000;
    this.colors[Board.TILE_BLOCK_BLACK] = COLOR_BLACK_BLOCK;
    this.colors[Board.TILE_BLOCK_WHITE] = COLOR_WHITE_BLOCK;
    this.colors[Board.TILE_PLAYER_BLACK] = COLOR_BLACK;
    this.colors[Board.TILE_PLAYER_WHITE] = COLOR_WHITE;
    this.colors[Board.TILE_PLAYER_BOTH] = COLOR_BOTH;
    this.colors[Board.TILE_MOVE_CANDIDATE] = COLOR_CANDIDATE;

    this.tiles = [];
    this.board = [];
    for (var i = 0; i < this.BOARD_WIDTH; i++) {
        this.board[i] = [];
        for (var j = 0; j < this.BOARD_WIDTH; j++) {
            this.board[i][j] = Board.TILE_CLEAR;
        }
    }
};

Board.prototype.clearBoard = function() {
    for (var i = 0; i < this.tiles.length; i++) {
        stage.removeChild(this.tiles[i]);
    }
    this.tiles = [];
    for (var i = 0; i < this.BOARD_WIDTH; i++) {
        for (var j = 0; j < this.BOARD_WIDTH; j++) {
            this.board[i][j] = Board.TILE_CLEAR;
        }
    }
};

Board.prototype.addTile = function(game, boardPos, color, alpha, dir) {
    if (alpha === undefined) {
        alpha = 1;
    }
    worldPos = this.boardToWorld(boardPos);
    tile = new Tile(game, worldPos.x, worldPos.y, color, this.TILE_WIDTH, alpha, dir);
    tile.interactive = true;
    this.tiles.push(tile);
    stage.addChild(tile);
};

/*Board.prototype.clearPos = function(pos) {
    if (pos !== null) {
        this.board[pos.x][pos.y] = Board.TILE_CLEAR;
    }
};*/

Board.prototype.getPos = function(pos) {
    return this.board[pos.x][pos.y];
};

Board.prototype.setPos = function(game, pos, value, alpha, dir) {
    this.board[pos.x][pos.y] = value;
    this.addTile(game, pos, this.colors[value], alpha, dir);
};

Board.prototype.isValid = function(loc) {
    return (loc.x >= 0 && loc.y >= 0 && loc.x < this.BOARD_WIDTH && loc.y < this.BOARD_WIDTH);
};

// Gives the upper-left corner of a grid square
Board.prototype.boardToWorld = function(pos) {
    var offset = this.LINE_THICKNESS / 2;
    return new PIXI.Point(pos.x * this.GRID_WIDTH + this.ORIGIN.x + offset, pos.y * this.GRID_WIDTH + this.ORIGIN.y + offset); 
};

Board.prototype.drawSquare = function(worldPos, color, graphics) {

    var offset = this.LINE_THICKNESS / 2;
    var startX = worldPos.x + offset;
    var startY = worldPos.y + offset;
    var innerGridThickness = this.GRID_WIDTH - this.LINE_THICKNESS - this.LINE_THICKNESS / 4;
    graphics.lineStyle(1, color, 1);

    graphics.beginFill(color);
    graphics.moveTo(startX, startY);
    graphics.lineTo(startX + innerGridThickness, startY);
    graphics.lineTo(startX + innerGridThickness, startY + innerGridThickness);
    graphics.lineTo(startX, startY + innerGridThickness);
    graphics.lineTo(startX, startY);
    graphics.endFill();
};

Board.prototype.draw = function(graphics) {
    var xBorder = this.ORIGIN.x;
    var yBorder = this.ORIGIN.y;
    graphics.clear();

    graphics.lineStyle(this.LINE_THICKNESS, 0x888888, 1);

    // Draw border
    graphics.beginFill(BG_COLOR);
    graphics.drawRect(xBorder, yBorder, BOARD_WIDTH_PIXELS, BOARD_WIDTH_PIXELS);
    graphics.endFill();

    var curX = xBorder;
    var curY = yBorder;

    // Draw horizontal lines
    for (var i = 0; i < this.BOARD_WIDTH; i++) {
        graphics.beginFill();
        graphics.moveTo(xBorder, curY);
        graphics.lineTo(BOARD_WIDTH_PIXELS + xBorder, curY);
        curY += this.GRID_WIDTH;
        graphics.endFill();
    }

    // Draw vertical lines
    for (var i = 0; i < this.BOARD_WIDTH; i++) {
        graphics.beginFill();
        graphics.moveTo(curX, yBorder);
        graphics.lineTo(curX, BOARD_WIDTH_PIXELS + yBorder);
        curX += this.GRID_WIDTH;
        graphics.endFill();
    }

    for (var i = 0; i < this.tiles.length; i++) {
        this.tiles[i].draw(graphics);
    }

/*
    // Draw players
    if (this.white !== null) {
        this.drawSquare(this.boardToWorld(this.white), COLOR_WHITE, graphics);
    }
    if (this.black !== null) {
        this.drawSquare(this.boardToWorld(this.black), COLOR_BLACK, graphics);
    }
*/
};

//window.onload = function startGame() {
function startGame() {
    // game will attach itself to stage
    var game = new Game("bob");
    window.game = game

    window.addEventListener('keydown', function(e) { game.onKeyDown(e); }, false);
    window.addEventListener('keyup', function(e) { game.onKeyUp(e); }, false);

    requestAnimFrame(animate);
};

function animate() {
    requestAnimFrame(animate);
    renderer.render(stage);
};

startGame();

/*
// first tile picked up by the player
var firstTile=null;
// second tile picked up by the player
var secondTile=null;
// can the player pick up a tile?
var canPick=true;
// create an new instance of a pixi stage with a grey background
var stage = new PIXI.Stage(0x111111);
// create a renderer instance width=640 height=480
var renderer = PIXI.autoDetectRenderer(640,480);
// importing a texture atlas created with texturepacker
var tileAtlas = ["images.json"];
// create a new loader
var loader = new PIXI.AssetLoader(tileAtlas);
// create an empty container
var gameContainer = new PIXI.DisplayObjectContainer();
// add the container to the stage
stage.addChild(gameContainer);
// add the renderer view element to the DOM
document.body.appendChild(renderer.view);

// use callback
loader.onComplete = onTilesLoaded
//begin load
loader.load();	
function onTilesLoaded(){
    // choose 24 random tile images
    var chosenTiles=new Array();
    while(chosenTiles.length<48){
        var candidate=Math.floor(Math.random()*44);
        if(chosenTiles.indexOf(candidate)==-1){
            chosenTiles.push(candidate,candidate)
        }			
    }
    // shuffle the chosen tiles
    for(i=0;i<96;i++){
        var from = Math.floor(Math.random()*48);
        var to = Math.floor(Math.random()*48);
        var tmp = chosenTiles[from];
        chosenTiles[from]=chosenTiles[to];
        chosenTiles[to]=tmp;
    }
    // place down tiles
    for(i=0;i<8;i++){
        for(j=0;j<6;j++){
            // new sprite
            var tile = PIXI.Sprite.fromFrame(chosenTiles[i*6+j]);
            // buttonmode+interactive = acts like a button
            tile.buttonMode=true;
            tile.interactive = true;
            // is the tile selected?
            tile.isSelected=false;
            // set a tile value
            tile.theVal=chosenTiles[i*6+j]
            // place the tile
            tile.position.x = 7+i*80;
            tile.position.y = 7+  j*80;
            // paint tile black
            tile.tint = 0x000000;
            // set it a bit transparent (it will look grey)
            tile.alpha=0.5;
            // add the tile
            gameContainer.addChild(tile);
            // mouse-touch listener
            tile.mousedown = tile.touchstart = function(data){
                // can I pick a tile?
                if(canPick) {
                     // is the tile already selected?
                    if(!this.isSelected){
                        // set the tile to selected
                        this.isSelected = true;
                        // show the tile
                        this.tint = 0xffffff;
                        this.alpha = 1;
                        // is it the first tile we uncover?
                        if(firstTile==null){
                            firstTile=this
                        }
                        // this is the second tile
                        else{
                            secondTile=this
                            // can't pick anymore
                            canPick=false;
                            // did we pick the same tiles?
                            if(firstTile.theVal==secondTile.theVal){
                                // wait a second then remove the tiles and make the player able to pick again
                                setTimeout(function(){
                                    gameContainer.removeChild(firstTile);
                                    gameContainer.removeChild(secondTile);
                                    firstTile=null;
                                    secondTile=null;
                                    canPick=true;
                                },1000);
                            }
                            // we picked different tiles
                            else{
                                // wait a second then cover the tiles and make the player able to pick again
                                setTimeout(function(){
                                    firstTile.isSelected=false
                                    secondTile.isSelected=false
                                    firstTile.tint = 0x000000;
                                    secondTile.tint = 0x000000;
                                    firstTile.alpha=0.5;
                                    secondTile.alpha=0.5;
                                    firstTile=null;
                                    secondTile=null;
                                    canPick=true	
                                },1000);
                            }
                        }	
                    }
                }
            }
        }
    } 
    requestAnimFrame(animate);
}
*/
