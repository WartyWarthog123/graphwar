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

// Use a Map or structured object to track active socket roles cleanly
let players = {}; 

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Figure out which roles are currently vacant
    const activeRoles = Object.values(players);
    
    if (!activeRoles.includes(1)) {
        players[socket.id] = 1;
        socket.emit('roleAssign', 1);
        console.log(`Assigned ${socket.id} to Player 1`);
    } else if (!activeRoles.includes(2)) {
        players[socket.id] = 2;
        socket.emit('roleAssign', 2);
        console.log(`Assigned ${socket.id} to Player 2`);
        
        // Only trigger the game start when both distinct roles are filled
        io.emit('gameReady', { message: "Both players connected. Player 1, take aim!" });
    } else {
        socket.emit('roleAssign', 0); // Spectator
    }

    socket.on('fireProjectile', (data) => {
        // Protect turn integrity by ensuring the sender matches the current role assignment
        io.emit('incomingShot', {
            player: players[socket.id],
            funcStr: data.funcStr
        });
    });

    socket.on('disconnect', () => {
        const leavingRole = players[socket.id];
        console.log(`User disconnected: ${socket.id} (Player ${leavingRole || 'Spectator'})`);
        
        // Remove the connection mapping
        delete players[socket.id];

        // Safely alert the remaining player if it was an active competitor who dropped out
        if (leavingRole === 1 || leavingRole === 2) {
            io.emit('playerDisconnected');
            // Safely clear out the lobby data for a fresh matchmaking pool
            players = {};
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Multiplayer engine online on port ${PORT}`);
});
