const boardElement = document.getElementById('chess-board');
const turnIndicator = document.getElementById('turn-indicator');
const turnText = turnIndicator.querySelector('.turn-text');
const gameStatus = document.getElementById('game-status');
const resetBtn = document.getElementById('reset-btn');
const difficultySelect = document.getElementById('difficulty-select');
const capturedHuman = document.getElementById('captured-human');
const capturedAi = document.getElementById('captured-ai');
const playerCards = document.querySelectorAll('.player-card');

let game = new Chess();
let selectedSquare = null;
let lastMove = null;
let playerOneIsWhite = true;
let stockfish = null;
let isAiThinking = false;

// Initialize Stockfish
function initStockfish() {
    // Use a Blob URL with importScripts to bypass SecurityError when running from file:// origin
    const blob = new Blob([
        `importScripts('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js');`
    ], { type: 'application/javascript' });
    const blobURL = URL.createObjectURL(blob);
    stockfish = new Worker(blobURL);
    
    stockfish.onmessage = function(event) {
        const line = event.data;
        if (line.startsWith('bestmove')) {
            const moveStr = line.split(' ')[1];
            if (moveStr && moveStr !== '(none)') {
                makeAiMove(moveStr);
            }
        }
    };
    
    stockfish.postMessage('uci');
    stockfish.postMessage('isready');
    setDifficulty();
}

function setDifficulty() {
    if (!stockfish) return;
    const skill = difficultySelect.value;
    stockfish.postMessage(`setoption name Skill Level value ${skill}`);
}

difficultySelect.addEventListener('change', () => {
    setDifficulty();
});

function askAiForMove() {
    if (game.game_over() || isAiThinking) return;
    
    isAiThinking = true;
    updateStatusWithThinking();
    
    // Send current position to Stockfish
    stockfish.postMessage('position fen ' + game.fen());
    // Find best move - vary depth based on difficulty
    let depth = 13;
    const skill = parseInt(difficultySelect.value);
    if (skill <= 5) depth = 5;
    else if (skill <= 10) depth = 10;
    else if (skill <= 18) depth = 14;
    else depth = 18;

    stockfish.postMessage(`go depth ${depth}`);
}

function makeAiMove(moveStr) {
    const from = moveStr.substring(0, 2);
    const to = moveStr.substring(2, 4);
    const promotion = moveStr.length > 4 ? moveStr.substring(4, 5) : 'q';
    
    const move = game.move({
        from: from,
        to: to,
        promotion: promotion
    });

    if (move) {
        lastMove = { from: move.from, to: move.to };
        isAiThinking = false;
        renderBoard();
        updateUI();
        checkGameEnd();
        updateCapturedPieces();
    }
}

function updateCapturedPieces() {
    capturedHuman.innerHTML = '';
    capturedAi.innerHTML = '';

    const history = game.history({ verbose: true });
    const pieceOrder = { 'p': 0, 'n': 1, 'b': 2, 'r': 3, 'q': 4 };

    const humanCaptures = [];
    const aiCaptures = [];

    history.forEach(move => {
        if (move.captured) {
            const capturedPieceColor = move.color === 'w' ? 'b' : 'w';
            const pieceKey = capturedPieceColor + move.captured.toUpperCase();
            
            const isHumanMove = (move.color === 'w' && playerOneIsWhite) || (move.color === 'b' && !playerOneIsWhite);
            if (isHumanMove) {
                humanCaptures.push({ key: pieceKey, type: move.captured });
            } else {
                aiCaptures.push({ key: pieceKey, type: move.captured });
            }
        }
    });

    // Sort pieces by value
    [humanCaptures, aiCaptures].forEach(list => {
        list.sort((a, b) => pieceOrder[a.type] - pieceOrder[b.type]);
    });

    humanCaptures.forEach(piece => {
        const div = document.createElement('div');
        div.classList.add('captured-piece');
        div.innerHTML = PIECES_SVG[piece.key];
        capturedHuman.appendChild(div);
    });

    aiCaptures.forEach(piece => {
        const div = document.createElement('div');
        div.classList.add('captured-piece');
        div.innerHTML = PIECES_SVG[piece.key];
        capturedAi.appendChild(div);
    });
}

function updateStatusWithThinking() {
    gameStatus.innerHTML = '<span class="thinking-dots">AI is thinking<span>.</span><span>.</span><span>.</span></span>';
}

function initGame() {
    game = new Chess();
    selectedSquare = null;
    lastMove = null;
    isAiThinking = false;
    playerOneIsWhite = Math.random() < 0.5;
    
    if (!stockfish) {
        initStockfish();
    }
    
    renderBoard();
    updateUI();
    updatePlayerInfo();
    updateCapturedPieces();
    
    const whitePlayerName = playerOneIsWhite ? 'You' : 'AI';
    gameStatus.innerText = `Game Started! ${whitePlayerName} is White.`;

    // If AI is white, trigger its first move
    if (!playerOneIsWhite) {
        setTimeout(askAiForMove, 500);
    }
}

function updatePlayerInfo() {
    const p1Card = playerCards[0];
    const p2Card = playerCards[1];
    const p1Sub = p1Card.querySelector('.player-sub');
    const p2Sub = p2Card.querySelector('.player-sub');
    const p1Avatar = p1Card.querySelector('.avatar');
    const p2Avatar = p2Card.querySelector('.avatar');

    if (playerOneIsWhite) {
        p1Sub.innerText = "White Pieces";
        p1Avatar.innerText = "W";
        p1Card.querySelector('.player-name').innerText = "You";
        p2Sub.innerText = "Black Pieces";
        p2Avatar.innerText = "B";
        p2Card.querySelector('.player-name').innerText = "Stockfish AI";
        p1Card.classList.add('white-player');
        p1Card.classList.remove('black-player');
        p2Card.classList.add('black-player');
        p2Card.classList.remove('white-player');
    } else {
        p1Sub.innerText = "Black Pieces";
        p1Avatar.innerText = "B";
        p1Card.querySelector('.player-name').innerText = "You";
        p2Sub.innerText = "White Pieces";
        p2Avatar.innerText = "W";
        p2Card.querySelector('.player-name').innerText = "Stockfish AI";
        p1Card.classList.add('black-player');
        p1Card.classList.remove('white-player');
        p2Card.classList.add('white-player');
        p2Card.classList.remove('black-player');
    }
}

function boardToIndices(square) {
    const col = square.charCodeAt(0) - 'a'.charCodeAt(0);
    const row = 8 - parseInt(square[1]);
    return { r: row, c: col };
}

function indicesToSquare(r, c) {
    return String.fromCharCode('a'.charCodeAt(0) + c) + (8 - r);
}

function renderBoard() {
    boardElement.innerHTML = '';
    const boardState = game.board();
    const legalMoves = selectedSquare ? game.moves({ square: selectedSquare, verbose: true }) : [];
    const inCheck = game.in_check();
    let kingSquare = null;

    if (inCheck) {
        // Find current player's king
        const turn = game.turn();
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = boardState[r][c];
                if (p && p.type === 'k' && p.color === turn) {
                    kingSquare = indicesToSquare(r, c);
                    break;
                }
            }
            if (kingSquare) break;
        }
    }

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            // If playerOneIsWhite is false, flip the board vertically and horizontally
            const boardR = playerOneIsWhite ? r : 7 - r;
            const boardC = playerOneIsWhite ? c : 7 - c;
            
            const squareName = indicesToSquare(boardR, boardC);
            const square = document.createElement('div');
            square.classList.add('square');
            square.classList.add((r + c) % 2 === 0 ? 'light' : 'dark');
            square.dataset.square = squareName;

            const pieceData = boardState[boardR][boardC];
            if (pieceData) {
                const pieceType = pieceData.color + pieceData.type.toUpperCase();
                const pieceDiv = document.createElement('div');
                pieceDiv.classList.add('piece');
                pieceDiv.innerHTML = PIECES_SVG[pieceType];
                square.appendChild(pieceDiv);
            }

            // Highlighting
            if (selectedSquare === squareName) {
                square.classList.add('selected');
            }

            if (lastMove && (lastMove.from === squareName || lastMove.to === squareName)) {
                square.classList.add('last-move');
            }

            if (inCheck && squareName === kingSquare) {
                square.classList.add('in-check');
                square.style.backgroundColor = 'rgba(239, 68, 68, 0.4)'; // Explicit fallback
            }

            // Show legal move dots
            const isLegalTarget = legalMoves.some(m => m.to === squareName);
            if (isLegalTarget) {
                const dot = document.createElement('div');
                dot.classList.add('legal-dot');
                square.appendChild(dot);
            }

            square.addEventListener('click', () => handleSquareClick(squareName));
            boardElement.appendChild(square);
        }
    }
}

function handleSquareClick(squareName) {
    if (isAiThinking || game.game_over()) return;

    const turn = game.turn();
    const isPlayerTurn = (turn === 'w' && playerOneIsWhite) || (turn === 'b' && !playerOneIsWhite);
    
    if (!isPlayerTurn) return;

    const piece = game.get(squareName);

    if (selectedSquare) {
        // Attempt to move
        const move = game.move({
            from: selectedSquare,
            to: squareName,
            promotion: 'q' // Default to queen for simplicity
        });

        if (move) {
            lastMove = { from: move.from, to: move.to };
            selectedSquare = null;
            renderBoard();
            updateUI();
            
            if (!checkGameEnd()) {
                // If game didn't end, it's AI's turn
                updateCapturedPieces();
                setTimeout(askAiForMove, 500);
            }
            return;
        } else {
            // If clicked another of my own pieces, select that instead
            if (piece && piece.color === game.turn()) {
                selectedSquare = squareName;
            } else {
                selectedSquare = null;
            }
        }
    } else {
        // Selecting a piece
        if (piece && piece.color === game.turn()) {
            selectedSquare = squareName;
        }
    }

    renderBoard();
    updateUI();
}

function checkGameEnd() {
    if (game.in_checkmate()) {
        const winner = game.turn() === 'b' ? "White" : "Black";
        const winnerName = (game.turn() === 'b' && playerOneIsWhite) || (game.turn() === 'w' && !playerOneIsWhite) ? "You win!" : "AI wins!";
        gameStatus.innerText = `Checkmate! ${winner} wins. ${winnerName}`;
        return true;
    } else if (game.in_draw()) {
        gameStatus.innerText = "Draw!";
        return true;
    } else if (game.in_check()) {
        gameStatus.innerText = "Check!";
    } else if (!isAiThinking) {
        gameStatus.innerText = "Your move.";
    }
    return false;
}

function updateUI() {
    const turn = game.turn();
    const isPlayerOneTurn = (turn === 'w' && playerOneIsWhite) || (turn === 'b' && !playerOneIsWhite);

    if (turn === 'w') {
        turnIndicator.classList.remove('black-turn');
        turnIndicator.classList.add('white-turn');
        turnText.innerText = "White's Turn";
    } else {
        turnIndicator.classList.remove('white-turn');
        turnIndicator.classList.add('black-turn');
        turnText.innerText = "Black's Turn";
    }

    if (isPlayerOneTurn) {
        playerCards[0].classList.add('active');
        playerCards[1].classList.remove('active');
    } else {
        playerCards[0].classList.remove('active');
        playerCards[1].classList.add('active');
    }
}

resetBtn.addEventListener('click', () => {
    initGame();
});

// Initialize on load
initGame();
