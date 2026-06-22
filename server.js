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
const ADMIN_PASSWORD = "graph"; 

let players = []; 
let totalConnections = 0; 

function generateMap() {
    const obstacles = [];
    // 1600x900 map constraints
    for(let i = 0; i < 12; i++) {
        obstacles.push({
            x: Math.random() * 1400 + 100, 
            y: Math.random() * 700 + 100, 
            r: Math.random() * 60 + 40
        });
    }

    players.forEach((p, index) => {
        p.hp = 100;
        let validSpawn = false;
        let attempts = 0;
        
        // Find a spawn point that is not in a tree AND not near another player
        while (!validSpawn && attempts < 100) {
            p.x = Math.random() * 1500 + 50;
            p.y = Math.random() * 800 + 50;
            
            let inTree = obstacles.some(o => Math.hypot(p.x - o.x, p.y - o.y) < o.r + 15);
            
            // Check distance against all players already processed in this loop
            let tooClose = players.slice(0, index).some(other => Math.hypot(p.x - other.x, p.y - other.y) < 400);

            validSpawn = !inTree && !tooClose;
            attempts++;
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

    socket.on('adminKick', (data) => {
        if (data.password === ADMIN_PASSWORD) {
            console.log(`Admin kicked player: ${data.targetId}`);
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
