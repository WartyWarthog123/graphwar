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

const COLORS = ['#a6e3a1', '#f38ba8', '#89b4fa', '#f9e2af', '#cba6f7', '#94e2d5'];
let players = []; 

function generateMap() {
    const obstacles = [];
    // Generate 25 random circular islands
    for(let i = 0; i < 25; i++) {
        obstacles.push({
            x: Math.random() * 1100 + 50,
            y: Math.random() * 500 + 150, 
            r: Math.random() * 60 + 30
        });
    }

    // Assign random spawn points to all connected players
    players.forEach(p => {
        p.hp = 100;
        const obs = obstacles[Math.floor(Math.random() * obstacles.length)];
        p.x = obs.x + (Math.random() * 40 - 20); // Randomly offset slightly from centre
        p.y = obs.y - obs.r - 15; // Place on top of the circle
    });

    return obstacles;
}

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Add new player to the lobby
    const newPlayer = {
        id: socket.id,
        hp: 100,
        color: COLORS[players.length % COLORS.length],
        name: `Player ${players.length + 1}`
    };
    players.push(newPlayer);
    
    // Sync the lobby list
    io.emit('lobbyUpdate', players);

    socket.on('startGame', () => {
        const obstacles = generateMap();
        io.emit('gameStarted', { players: players, obstacles: obstacles });
    });

    socket.on('fireProjectile', (data) => {
        // Relay the math function and firing direction to all clients
        io.emit('incomingShot', data);
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        players = players.filter(p => p.id !== socket.id);
        io.emit('lobbyUpdate', players);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Multiplayer engine online on port ${PORT}`);
});
