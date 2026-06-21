// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

let players = {};
let currentPlayer = 1;

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Assign roles based on who is in the room
    const playerCount = Object.keys(players).length;
    if (playerCount === 0) {
        players[socket.id] = 1;
        socket.emit('roleAssign', 1);
    } else if (playerCount === 1) {
        players[socket.id] = 2;
        socket.emit('roleAssign', 2);
        io.emit('gameReady', { message: "Both players connected. P1 start!" });
    } else {
        socket.emit('roleAssign', 0); // Spectator
    }

    // Synchronise game state when a player fires
    socket.on('fireProjectile', (data) => {
        // Broadcast the mathematical function to everyone
        io.emit('incomingShot', {
            player: players[socket.id],
            funcStr: data.funcStr
        });
        // Swap turn
        currentPlayer = currentPlayer === 1 ? 2 : 1;
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        delete players[socket.id];
        io.emit('playerDisconnected');
        // Reset lobby if someone leaves
        players = {};
        currentPlayer = 1;
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});