// Adam Meiner
const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static("public"));

const GAME_PASSWORD = "secret123";

let gameState = {
    board: Array(9).fill(""),
    currentPlayer: "X",
    winner: null
};

let players = {
    X: null,
    O: null
};

function broadcastState() {
    const payload = JSON.stringify({ type: "state", gameState });
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    });
}

function checkWinner(board) {
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];
    for (const [a, b, c] of lines) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }
    return null;
}

wss.on("connection", ws => {
    ws.playerName = "";
    ws.role = "spectator";
    ws.authenticated = false;

    ws.send(JSON.stringify({ type: "state", gameState }));

    ws.on("message", message => {
        const data = JSON.parse(message);

        if (data.type === "login") {
            if (data.password !== GAME_PASSWORD) {
                ws.send(JSON.stringify({ type: "error", message: "Invalid password" }));
                return;
            }

            ws.playerName = data.name;
            ws.authenticated = true;

            if (!players.X) {
                players.X = ws;
                ws.role = "X";
            } else if (!players.O) {
                players.O = ws;
                ws.role = "O";
            } else {
                ws.role = "spectator";
            }

            ws.send(JSON.stringify({ type: "role", role: ws.role, name: ws.playerName }));
            broadcastState();
            return;
        }

        if (!ws.authenticated) {
            return;
        }

        if (data.type === "place") {
            const index = data.index;

            if (ws.role !== "X" && ws.role !== "O") {
                return;
            }
            if (ws.role !== gameState.currentPlayer) {
                return;
            }
            if (gameState.winner) {
                return;
            }
            if (gameState.board[index] !== "") {
                return;
            }

            gameState.board[index] = gameState.currentPlayer;
            const winner = checkWinner(gameState.board);
            if (winner) {
                gameState.winner = winner;
            } else {
                gameState.currentPlayer = gameState.currentPlayer === "X" ? "O" : "X";
            }
            broadcastState();
        }

        if (data.type === "reset") {
            gameState = {
                board: Array(9).fill(""),
                currentPlayer: "X",
                winner: null
            };
            broadcastState();
        }
    });

    ws.on("close", () => {
        if (players.X === ws) {
            players.X = null;
        }
        if (players.O === ws) {
            players.O = null;
        }
    });
});

// Updated for Render & local compatibility
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});