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

const rooms = {}; 
const socketMap = {}; 

function sanitiseText(str, maxLength = 20) {
    if (typeof str !== 'string') return 'Unknown';
    return str.replace(/[&<>"']/g, '').substring(0, maxLength).trim() || 'Player';
}

function generateMap(roomName) {
    const obstacles = [];
    let attempts = 0;
    
    // Generate up to 12 obstacles, but force them to spread out
    while (obstacles.length < 12 && attempts < 500) {
        let newObs = {
            x: Math.random() * 1400 + 100, 
            y: Math.random() * 700 + 100, 
            r: Math.random() * 60 + 40
        };
        
        // Ensure at least a 30-pixel gap between the edges of every obstacle
        let tooClose = obstacles.some(o => Math.hypot(newObs.x - o.x, newObs.y - o.y) < (newObs.r + o.r + 30));
        
        if (!tooClose) {
            obstacles.push(newObs);
        }
        attempts++;
    }

    rooms[roomName].players.forEach((p, index) => {
        if (rooms[roomName].inProgress && p.hp <= 0) return;

        p.hp = 100;
        let validSpawn = false;
        let pAttempts = 0;
        
        while (!validSpawn && pAttempts < 100) {
            p.x = Math.random() * 1500 + 50;
            p.y = Math.random() * 800 + 50;
            
            let inTree = obstacles.some(o => Math.hypot(p.x - o.x, p.y - o.y) < o.r + 15);
            let tooClose = rooms[roomName].players.slice(0, index).some(other => Math.hypot(p.x - other.x, p.y - other.y) < 400 && other.hp > 0);

            validSpawn = !inTree && !tooClose;
            pAttempts++;
        }
    });

    return obstacles;
}

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('joinLobby', (data) => {
        const rawRoom = data.roomName || 'Public';
        const roomName = sanitiseText(rawRoom, 20).toUpperCase();
        const playerName = sanitiseText(data.playerName, 15);

        socket.join(roomName);
        socketMap[socket.id] = roomName;

        if (!rooms[roomName]) {
            rooms[roomName] = { players: [], obstacles: [], inProgress: false, connectionCount: 0 };
        }

        rooms[roomName].connectionCount++;
        
        const newPlayer = {
            id: socket.id,
            hp: rooms[roomName].inProgress ? 0 : 100, 
            color: COLORS[rooms[roomName].connectionCount % COLORS.length],
            name: playerName
        };
        
        rooms[roomName].players.push(newPlayer);
        io.to(roomName).emit('lobbyUpdate', rooms[roomName].players);
        
        if (rooms[roomName].inProgress) {
            socket.emit('gameStarted', { 
                players: rooms[roomName].players, 
                obstacles: rooms[roomName].obstacles 
            });
        }
    });

    socket.on('startGame', () => {
        const roomName = socketMap[socket.id];
        if (!roomName || !rooms[roomName]) return;

        rooms[roomName].inProgress = true;
        rooms[roomName].obstacles = generateMap(roomName);
        io.to(roomName).emit('gameStarted', { 
            players: rooms[roomName].players, 
            obstacles: rooms[roomName].obstacles 
        });
    });

    socket.on('fireProjectile', (data) => {
        const roomName = socketMap[socket.id];
        if (!roomName) return;

        let safeMath = '';
        if (typeof data.funcStr === 'string') safeMath = data.funcStr.substring(0, 250);

        const allowedDirs = ['1', '-1', 'up', 'down'];
        const safeDir = allowedDirs.includes(data.dir) ? data.dir : '1';

        io.to(roomName).emit('incomingShot', {
            playerId: socket.id,
            funcStr: safeMath,
            dir: safeDir
        });
    });

    socket.on('adminKick', (data) => {
        const roomName = socketMap[socket.id];
        if (roomName && data.password === ADMIN_PASSWORD) {
            const safeTarget = String(data.targetId);
            io.to(roomName).emit('playerKicked', safeTarget);
        }
    });

    socket.on('disconnect', () => {
        const roomName = socketMap[socket.id];
        if (roomName && rooms[roomName]) {
            console.log(`User left room [${roomName}]: ${socket.id}`);
            rooms[roomName].players = rooms[roomName].players.filter(p => p.id !== socket.id);
            
            if (rooms[roomName].players.length === 0) {
                delete rooms[roomName]; 
            } else {
                io.to(roomName).emit('lobbyUpdate', rooms[roomName].players);
            }
        }
        delete socketMap[socket.id];
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Multiplayer engine online on port ${PORT}`);
});
