/**
 * Apex Striker 3D - Standalone Multiplayer Server for Render.com
 * Deploy directly to Render as a Web Service:
 * Build Command: npm install
 * Start Command: node server.js
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Serve static frontend files
app.use(express.static(path.join(__dirname)));
app.use(express.json());

// In-memory room and player store
const rooms = {
  'dust2_competitive_01': {
    id: 'dust2_competitive_01',
    name: 'de_mirage B-Alley [128 Tick]',
    map: 'de_mirage',
    maxPlayers: 10,
    players: {},
    enableBots: true,
    botCount: 3
  },
  'inferno_competitive_02': {
    id: 'inferno_competitive_02',
    name: 'de_inferno [128 Tick]',
    map: 'de_inferno',
    maxPlayers: 10,
    players: {},
    enableBots: true,
    botCount: 2
  },
  'cache_competitive_03': {
    id: 'cache_competitive_03',
    name: 'de_cache [128 Tick]',
    map: 'de_cache',
    maxPlayers: 10,
    players: {},
    enableBots: true,
    botCount: 3
  }
};

// Initialize bots
const BOT_NAMES = ['Ghost-9', 'Viper-X', 'Apex-Bot', 'K-200', 'Striker-Z'];
for (const roomId in rooms) {
  const r = rooms[roomId];
  for (let i = 0; i < r.botCount; i++) {
    const bId = `bot_${r.id}_${i}`;
    r.players[bId] = {
      id: bId,
      name: `[BOT] ${BOT_NAMES[i % BOT_NAMES.length]}`,
      x: (Math.random() - 0.5) * 40,
      y: 0.5,
      z: (Math.random() - 0.5) * 40,
      rotationY: Math.random() * Math.PI * 2,
      pitch: 0,
      health: 100,
      shield: 50,
      weapon: 'ar',
      isBot: true
    };
  }
}

// Health check endpoint for Render
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

// Socket.io handlers
io.on('connection', (socket) => {
  let currentRoomId = null;

  socket.on('get:rooms', () => {
    const list = Object.values(rooms).map(r => ({
      id: r.id,
      name: r.name,
      map: r.map,
      playerCount: Object.keys(r.players).length,
      maxPlayers: r.maxPlayers
    }));
    socket.emit('rooms:list', list);
  });

  socket.on('room:create', (data) => {
    const id = `room_${Date.now()}`;
    rooms[id] = {
      id,
      name: data.name || 'Nueva Sala',
      map: data.map || 'cyber_city',
      maxPlayers: data.maxPlayers || 8,
      players: {},
      enableBots: data.enableBots ?? true,
      botCount: data.enableBots ? 2 : 0
    };
    socket.emit('room:created', { roomId: id });
  });

  socket.on('room:join', (data) => {
    const r = rooms[data.roomId];
    if (!r) return socket.emit('join:error', { message: 'Sala no encontrada' });

    currentRoomId = r.id;
    socket.join(r.id);

    r.players[socket.id] = {
      id: socket.id,
      name: data.playerName || 'Striker',
      x: (Math.random() - 0.5) * 30,
      y: 0.5,
      z: (Math.random() - 0.5) * 30,
      rotationY: 0,
      pitch: 0,
      health: 100,
      shield: 50,
      weapon: 'ar',
      isBot: false
    };

    socket.emit('game:init', {
      selfId: socket.id,
      room: { id: r.id, name: r.name, map: r.map },
      players: r.players
    });

    socket.to(r.id).emit('player:joined', r.players[socket.id]);
  });

  socket.on('player:sync', (data) => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const p = rooms[currentRoomId].players[socket.id];
    if (p) Object.assign(p, data);
  });

  socket.on('player:shoot', (data) => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const r = rooms[currentRoomId];
    socket.to(r.id).emit('bullet:tracer', {
      shooterId: socket.id,
      origin: data.origin,
      direction: data.direction,
      weapon: data.weapon
    });

    // Check hit against other players
    for (const otherId in r.players) {
      if (otherId === socket.id) continue;
      const victim = r.players[otherId];
      if (victim.health <= 0) continue;

      // Distance check from ray
      const dx = victim.x - data.origin.x;
      const dz = victim.z - data.origin.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 35) {
        // Approximate hit chance: casual bot difficulty (12% hit chance)
        if (Math.random() < 0.12) {
          const dmg = 8;
          victim.health = Math.max(0, victim.health - dmg);
          io.to(r.id).emit('player:damaged', {
            victimId: victim.id,
            attackerId: socket.id,
            health: victim.health,
            shield: victim.shield
          });

          if (victim.health <= 0) {
            io.to(r.id).emit('player:killed', {
              victimId: victim.id,
              victimName: victim.name,
              killerId: socket.id,
              killerName: r.players[socket.id]?.name || 'Striker',
              weapon: data.weapon
            });

            if (victim.isBot) {
              setTimeout(() => {
                victim.health = 100;
                victim.x = (Math.random() - 0.5) * 40;
                victim.z = (Math.random() - 0.5) * 40;
                io.to(r.id).emit('player:respawned', { id: victim.id, x: victim.x, y: 0.5, z: victim.z });
              }, 3000);
            }
          }
          break;
        }
      }
    }
  });

  socket.on('player:respawn_request', () => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const p = rooms[currentRoomId].players[socket.id];
    if (p) {
      p.health = 100;
      p.shield = 50;
      p.x = (Math.random() - 0.5) * 30;
      p.z = (Math.random() - 0.5) * 30;
      io.to(currentRoomId).emit('player:respawned', { id: p.id, x: p.x, y: 0.5, z: p.z });
    }
  });

  socket.on('disconnect', () => {
    if (currentRoomId && rooms[currentRoomId]) {
      delete rooms[currentRoomId].players[socket.id];
      io.to(currentRoomId).emit('player:left', { id: socket.id });
    }
  });
});

// Broadcast tick to rooms (20 times per second)
setInterval(() => {
  for (const rId in rooms) {
    const r = rooms[rId];
    // Simple bot wander
    for (const pId in r.players) {
      const p = r.players[pId];
      if (p.isBot && p.health > 0) {
        p.x += Math.sin(p.rotationY) * 0.12;
        p.z += Math.cos(p.rotationY) * 0.12;
        if (Math.random() < 0.05) p.rotationY += (Math.random() - 0.5) * 1.5;
        p.x = Math.max(-50, Math.min(50, p.x));
        p.z = Math.max(-50, Math.min(50, p.z));
      }
    }
    io.to(rId).emit('world:tick', { players: r.players });
  }
}, 50);

// Default route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Apex Striker Server running on port ${PORT}`);
});
