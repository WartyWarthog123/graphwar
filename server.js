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
const ADMIN_PASSWORD = "graph"; // Change this to whatever password you want

let players = []; 
let totalConnections = 0; 

function generateMap() {
    const obstacles = [];
    // Spread obstacles out more and decrease the number (12 instead of 25)
    for(let i = 0; i < 12; i++) {
        obstacles.push({
            x: Math.random() * 1200 + 100, // Kept away from extreme edges
            y: Math.random() * 600 + 100, 
            r: Math.random() * 60 + 40
        });
    }

    players.forEach(p => {
        p.hp = 100;
        // Top-down random spawning: scatter players anywhere on the map
        let validSpawn = false;
        while (!validSpawn) {
            p.x = Math.random() * 1300 + 50;
            p.y = Math.random() * 700 + 50;
            
            // Ensure they don't spawn trapped completely inside a tree
            validSpawn = !obstacles.some(o => Math.hypot(p.x - o.x, p.y - o.y) < o.r - 10);
        }
    });

    return obstacles;
}

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
    totalConnections++;

    const newPlayer = {
        id: socket.id,
        hp: 100,
        color: COLORS[totalConnections % COLORS.length],
        name: `Player ${totalConnections}`
    };
    players.push(newPlayer);
    
    io.emit('lobbyUpdate', players);

    socket.on('startGame', () => {
        const obstacles = generateMap();
        io.emit('gameStarted', { players: players, obstacles: obstacles });
    });

    socket.on('fireProjectile', (data) => {
        data.playerId = socket.id;
        io.emit('incomingShot', data);
    });

    // Handle Admin Kicking
    socket.on('adminKick', (data) => {
        if (data.password === ADMIN_PASSWORD) {
            console.log(`Admin kicked player: ${data.targetId}`);
            // Force the target into spectator mode across all clients
            io.emit('playerKicked', data.targetId);
        }
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
