import express from 'express';
import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import path from 'path';

interface PlayerState {
  id: string;
  name: string;
  room: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rotationY: number;
  pitch: number;
  health: number;
  shield: number;
  weapon: string;
  isFiring: boolean;
  isSprinting: boolean;
  isJetpacking: boolean;
  isAiming: boolean;
  kills: number;
  deaths: number;
  score: number;
  skin: string;
  color: string;
  ping: number;
  isBot?: boolean;
}

interface Room {
  id: string;
  name: string;
  map: 'de_mirage' | 'de_dust2' | 'de_inferno' | 'de_cache' | 'cyber_city' | 'jungle_outpost' | 'desert_canyon';
  maxPlayers: number;
  isPrivate: boolean;
  password?: string;
  createdAt: number;
  players: Record<string, PlayerState>;
  enableBots: boolean;
  botCount: number;
  scoreLimit: number;
}

const app = express();
const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingInterval: 5000,
  pingTimeout: 10000
});

app.use(express.json());

const rooms: Record<string, Room> = {};

// Default initial rooms
function createInitialRooms() {
  const defaultRooms: Partial<Room>[] = [
    {
      id: 'dust2_competitive_01',
      name: 'de_mirage B-Alley [128 Tick]',
      map: 'de_mirage',
      maxPlayers: 10,
      isPrivate: false,
      enableBots: true,
      botCount: 3,
      scoreLimit: 16
    },
    {
      id: 'inferno_competitive_02',
      name: 'de_inferno [128 Tick]',
      map: 'de_inferno',
      maxPlayers: 10,
      isPrivate: false,
      enableBots: true,
      botCount: 2,
      scoreLimit: 16
    },
    {
      id: 'cache_competitive_03',
      name: 'de_cache [128 Tick]',
      map: 'de_cache',
      maxPlayers: 10,
      isPrivate: false,
      enableBots: true,
      botCount: 3,
      scoreLimit: 16
    }
  ];

  for (const r of defaultRooms) {
    rooms[r.id!] = {
      id: r.id!,
      name: r.name!,
      map: r.map!,
      maxPlayers: r.maxPlayers!,
      isPrivate: r.isPrivate || false,
      createdAt: Date.now(),
      players: {},
      enableBots: r.enableBots || false,
      botCount: r.botCount || 0,
      scoreLimit: r.scoreLimit || 16
    };
    initializeBotsForRoom(rooms[r.id!]);
  }
}

// Bot management
const BOT_NAMES = ['Phoenix', 'Leet', 'Balkan', 'Arctic', 'Guerrilla', 'Separatist', 'Anarchist'];
const BOT_COLORS = ['#38bdf8', '#f43f5e', '#a855f7', '#eab308', '#22c55e', '#ec4899'];

function initializeBotsForRoom(room: Room) {
  if (!room.enableBots) return;
  for (let i = 0; i < room.botCount; i++) {
    const botId = `bot_${room.id}_${i}`;
    const spawn = getSpawnPoint(room.map, i);
    room.players[botId] = {
      id: botId,
      name: `[BOT] ${BOT_NAMES[i % BOT_NAMES.length]}`,
      room: room.id,
      x: spawn.x,
      y: spawn.y,
      z: spawn.z,
      vx: 0,
      vy: 0,
      vz: 0,
      rotationY: Math.random() * Math.PI * 2,
      pitch: 0,
      health: 100,
      shield: 100,
      weapon: i % 2 === 0 ? 'ak47' : 'deagle',
      isFiring: false,
      isSprinting: false,
      isJetpacking: false,
      isAiming: false,
      kills: 0,
      deaths: 0,
      score: 0,
      skin: 'standard',
      color: BOT_COLORS[i % BOT_COLORS.length],
      ping: 5,
      isBot: true
    };
  }
}

function getSpawnPoint(map: string, index: number = 0) {
  const spawns: Record<string, Array<{ x: number; y: number; z: number }>> = {
    de_mirage: [
      { x: 0, y: 0.5, z: 12 },
      { x: -3, y: 0.5, z: 14 },
      { x: 3, y: 0.5, z: 14 },
      { x: 0, y: 0.5, z: -18 },
      { x: -3, y: 0.5, z: -20 },
      { x: 3, y: 0.5, z: -20 }
    ],
    de_inferno: [
      { x: 0, y: 0.5, z: 15 },
      { x: 6, y: 0.5, z: 15 },
      { x: 0, y: 0.5, z: -15 },
      { x: 6, y: 0.5, z: -15 }
    ],
    de_cache: [
      { x: -5, y: 0.5, z: 12 },
      { x: 5, y: 0.5, z: 12 },
      { x: -5, y: 0.5, z: -10 },
      { x: 5, y: 0.5, z: -10 }
    ],
    cyber_city: [
      { x: 0, y: 0.5, z: 12 },
      { x: 3, y: 0.5, z: 12 }
    ]
  };

  const list = spawns[map] || spawns.de_mirage;
  const point = list[index % list.length];
  return {
    x: point.x + (Math.random() - 0.5) * 2,
    y: point.y,
    z: point.z + (Math.random() - 0.5) * 2
  };
}

createInitialRooms();

// API Endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), roomsCount: Object.keys(rooms).length });
});

app.get('/api/rooms', (req, res) => {
  const summary = Object.values(rooms).map(r => ({
    id: r.id,
    name: r.name,
    map: r.map,
    playerCount: Object.keys(r.players).length,
    humanCount: Object.values(r.players).filter(p => !p.isBot).length,
    maxPlayers: r.maxPlayers,
    isPrivate: r.isPrivate,
    scoreLimit: r.scoreLimit
  }));
  res.json(summary);
});

// Socket.io real-time gameplay handling
io.on('connection', (socket: Socket) => {
  let currentRoomId: string | null = null;
  let playerId: string = socket.id;

  // Send rooms list on demand
  socket.on('get:rooms', () => {
    const summary = Object.values(rooms).map(r => ({
      id: r.id,
      name: r.name,
      map: r.map,
      playerCount: Object.keys(r.players).length,
      humanCount: Object.values(r.players).filter(p => !p.isBot).length,
      maxPlayers: r.maxPlayers,
      isPrivate: r.isPrivate,
      scoreLimit: r.scoreLimit
    }));
    socket.emit('rooms:list', summary);
  });

  // Ping calculation
  socket.on('ping:check', (clientTimestamp: number) => {
    socket.emit('pong:reply', clientTimestamp);
  });

  // Create room
  socket.on('room:create', (data: { name: string; map: 'cyber_city' | 'jungle_outpost' | 'desert_canyon'; maxPlayers?: number; password?: string; enableBots?: boolean }) => {
    const id = `room_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newRoom: Room = {
      id,
      name: data.name || `Sala ${id.slice(-4)}`,
      map: data.map || 'cyber_city',
      maxPlayers: Math.min(Math.max(data.maxPlayers || 8, 2), 16),
      isPrivate: !!data.password,
      password: data.password || undefined,
      createdAt: Date.now(),
      players: {},
      enableBots: data.enableBots ?? true,
      botCount: data.enableBots ? 2 : 0,
      scoreLimit: 25
    };
    rooms[id] = newRoom;
    initializeBotsForRoom(newRoom);
    socket.emit('room:created', { roomId: id });
  });

  // Join room
  socket.on('room:join', (data: { roomId: string; playerName: string; skin?: string; color?: string; password?: string }) => {
    const room = rooms[data.roomId];
    if (!room) {
      return socket.emit('join:error', { message: 'La sala especificada no existe.' });
    }
    if (room.isPrivate && room.password && room.password !== data.password) {
      return socket.emit('join:error', { message: 'Contraseña de sala incorrecta.' });
    }
    const humanCount = Object.values(room.players).filter(p => !p.isBot).length;
    if (humanCount >= room.maxPlayers) {
      return socket.emit('join:error', { message: 'La sala está completa.' });
    }

    // Leave any existing room
    if (currentRoomId && rooms[currentRoomId]) {
      delete rooms[currentRoomId].players[playerId];
      socket.leave(currentRoomId);
      io.to(currentRoomId).emit('player:left', { id: playerId });
    }

    currentRoomId = room.id;
    socket.join(room.id);

    const spawn = getSpawnPoint(room.map, Object.keys(room.players).length);
    const newPlayer: PlayerState = {
      id: playerId,
      name: data.playerName ? data.playerName.slice(0, 16) : `Striker-${playerId.slice(0, 4)}`,
      room: room.id,
      x: spawn.x,
      y: spawn.y,
      z: spawn.z,
      vx: 0,
      vy: 0,
      vz: 0,
      rotationY: 0,
      pitch: 0,
      health: 100,
      shield: 50,
      weapon: 'ar',
      isFiring: false,
      isSprinting: false,
      isJetpacking: false,
      isAiming: false,
      kills: 0,
      deaths: 0,
      score: 0,
      skin: data.skin || 'standard',
      color: data.color || '#38bdf8',
      ping: 20,
      isBot: false
    };

    room.players[playerId] = newPlayer;

    // Send complete init state to joining player
    socket.emit('game:init', {
      selfId: playerId,
      room: {
        id: room.id,
        name: room.name,
        map: room.map,
        scoreLimit: room.scoreLimit
      },
      players: room.players
    });

    // Broadcast new player to all others in the room
    socket.to(room.id).emit('player:joined', newPlayer);

    // Broadcast killfeed entry for join
    io.to(room.id).emit('chat:system', {
      message: `${newPlayer.name} se unió a la batalla.`
    });
  });

  // Client updates position / inputs
  socket.on('player:sync', (data: Partial<PlayerState>) => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const player = rooms[currentRoomId].players[playerId];
    if (!player) return;

    if (data.x !== undefined) player.x = data.x;
    if (data.y !== undefined) player.y = data.y;
    if (data.z !== undefined) player.z = data.z;
    if (data.vx !== undefined) player.vx = data.vx;
    if (data.vy !== undefined) player.vy = data.vy;
    if (data.vz !== undefined) player.vz = data.vz;
    if (data.rotationY !== undefined) player.rotationY = data.rotationY;
    if (data.pitch !== undefined) player.pitch = data.pitch;
    if (data.weapon !== undefined) player.weapon = data.weapon;
    if (data.isFiring !== undefined) player.isFiring = data.isFiring;
    if (data.isSprinting !== undefined) player.isSprinting = data.isSprinting;
    if (data.isJetpacking !== undefined) player.isJetpacking = data.isJetpacking;
    if (data.isAiming !== undefined) player.isAiming = data.isAiming;
    if (data.ping !== undefined) player.ping = data.ping;
  });

  // Shoot raycast event
  socket.on('player:shoot', (data: {
    origin: { x: number; y: number; z: number };
    direction: { x: number; y: number; z: number };
    weapon: string;
    hitPlayerId?: string;
    damage?: number;
    isHeadshot?: boolean;
  }) => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    const shooter = room.players[playerId];
    if (!shooter || shooter.health <= 0) return;

    // Broadcast bullet visual to room
    socket.to(room.id).emit('bullet:tracer', {
      shooterId: playerId,
      origin: data.origin,
      direction: data.direction,
      weapon: data.weapon
    });

    // Check hit validation
    if (data.hitPlayerId && room.players[data.hitPlayerId]) {
      const victim = room.players[data.hitPlayerId];
      if (victim.health > 0) {
        let dmg = data.damage || 25;
        if (data.isHeadshot) dmg = Math.round(dmg * 1.5);

        // Deduct from shield first
        if (victim.shield > 0) {
          if (victim.shield >= dmg) {
            victim.shield -= dmg;
            dmg = 0;
          } else {
            dmg -= victim.shield;
            victim.shield = 0;
          }
        }
        victim.health = Math.max(0, victim.health - dmg);

        // Inform players about hit
        io.to(room.id).emit('player:damaged', {
          victimId: victim.id,
          attackerId: shooter.id,
          health: victim.health,
          shield: victim.shield,
          isHeadshot: data.isHeadshot
        });

        // Did victim die?
        if (victim.health <= 0) {
          shooter.kills += 1;
          shooter.score += data.isHeadshot ? 150 : 100;
          victim.deaths += 1;

          io.to(room.id).emit('player:killed', {
            victimId: victim.id,
            victimName: victim.name,
            killerId: shooter.id,
            killerName: shooter.name,
            weapon: data.weapon,
            isHeadshot: !!data.isHeadshot
          });

          // If victim is a bot, schedule respawn automatically
          if (victim.isBot) {
            setTimeout(() => {
              if (rooms[room.id] && rooms[room.id].players[victim.id]) {
                const s = getSpawnPoint(room.map, Math.floor(Math.random() * 10));
                victim.x = s.x;
                victim.y = s.y;
                victim.z = s.z;
                victim.health = 100;
                victim.shield = 50;
                io.to(room.id).emit('player:respawned', {
                  id: victim.id,
                  x: victim.x,
                  y: victim.y,
                  z: victim.z,
                  health: 100,
                  shield: 50
                });
              }
            }, 3000);
          }
        }
      }
    }
  });

  // Player manual respawn request (after death countdown)
  socket.on('player:respawn_request', () => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const room = rooms[currentRoomId];
    const player = room.players[playerId];
    if (!player) return;

    const s = getSpawnPoint(room.map, Math.floor(Math.random() * 10));
    player.x = s.x;
    player.y = s.y;
    player.z = s.z;
    player.vx = 0;
    player.vy = 0;
    player.vz = 0;
    player.health = 100;
    player.shield = 50;

    io.to(room.id).emit('player:respawned', {
      id: player.id,
      x: player.x,
      y: player.y,
      z: player.z,
      health: 100,
      shield: 50
    });
  });

  // Chat message
  socket.on('chat:send', (text: string) => {
    if (!currentRoomId || !rooms[currentRoomId]) return;
    const player = rooms[currentRoomId].players[playerId];
    if (!player || !text) return;

    io.to(currentRoomId).emit('chat:message', {
      senderId: player.id,
      senderName: player.name,
      color: player.color,
      text: text.slice(0, 100)
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    if (currentRoomId && rooms[currentRoomId]) {
      const room = rooms[currentRoomId];
      const player = room.players[playerId];
      const name = player?.name || 'Jugador';
      delete room.players[playerId];
      socket.leave(currentRoomId);

      io.to(currentRoomId).emit('player:left', { id: playerId });
      io.to(currentRoomId).emit('chat:system', {
        message: `${name} abandonó la partida.`
      });

      // Cleanup room if empty and not default
      const humanRemaining = Object.values(room.players).filter(p => !p.isBot).length;
      if (humanRemaining === 0 && !room.id.includes('arena') && !room.id.includes('outpost') && !room.id.includes('canyon')) {
        delete rooms[currentRoomId];
      }
    }
  });
});

// Periodic network tick for room state & bot AI (20 ticks per second)
const TICK_RATE = 20;
setInterval(() => {
  for (const roomId in rooms) {
    const room = rooms[roomId];
    const playersList = Object.values(room.players);
    if (playersList.length === 0) continue;

    // Update Bot AI
    for (const player of playersList) {
      if (player.isBot && player.health > 0) {
        updateBotAI(room, player);
      }
    }

    // Broadcast room world snapshot to all sockets in room
    io.to(roomId).emit('world:tick', {
      timestamp: Date.now(),
      players: room.players
    });
  }
}, 1000 / TICK_RATE);

// Simple tactical Bot AI
function updateBotAI(room: Room, bot: PlayerState) {
  // Find closest living enemy
  let closestTarget: PlayerState | null = null;
  let minDist = 70;

  for (const otherId in room.players) {
    if (otherId === bot.id) continue;
    const target = room.players[otherId];
    if (target.health <= 0) continue;

    const dx = target.x - bot.x;
    const dz = target.z - bot.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < minDist) {
      minDist = dist;
      closestTarget = target;
    }
  }

  if (closestTarget) {
    const dx = closestTarget.x - bot.x;
    const dz = closestTarget.z - bot.z;
    const angle = Math.atan2(dx, dz);
    bot.rotationY = angle;

    // Movement: gentle stroll and strafe (lower difficulty)
    const speed = 0.14;
    if (minDist > 14) {
      bot.x += Math.sin(angle) * speed;
      bot.z += Math.cos(angle) * speed;
      bot.isSprinting = false;
    } else if (minDist < 8) {
      // Back away slowly
      bot.x -= Math.sin(angle) * speed * 0.6;
      bot.z -= Math.cos(angle) * speed * 0.6;
    } else {
      // Gentle strafe sideways
      const strafeAngle = angle + Math.PI / 2;
      bot.x += Math.sin(strafeAngle) * (Math.sin(Date.now() * 0.002) * 0.1);
      bot.z += Math.cos(strafeAngle) * (Math.sin(Date.now() * 0.002) * 0.1);
    }

    // Occasional gentle jump
    if (Math.random() < 0.015 && bot.y <= 0.6) {
      bot.vy = 0.15;
      bot.y += 0.25;
    }

    // Shoot at target: casual fire rate and low damage
    if (minDist < 30 && Math.random() < 0.08) {
      bot.isFiring = true;
      // Low difficulty accuracy: 12% hit chance (they miss 88% of the time)
      const willHit = Math.random() < 0.12;
      const baseDmg = bot.weapon === 'ar' ? 8 : 6;

      // Broadcast bot shot
      io.to(room.id).emit('bullet:tracer', {
        shooterId: bot.id,
        origin: { x: bot.x, y: bot.y + 1.2, z: bot.z },
        direction: { x: Math.sin(angle), y: (closestTarget.y - bot.y) / minDist, z: Math.cos(angle) },
        weapon: bot.weapon
      });

      if (willHit) {
        let dmg = baseDmg;
        if (closestTarget.shield > 0) {
          if (closestTarget.shield >= dmg) {
            closestTarget.shield -= dmg;
            dmg = 0;
          } else {
            dmg -= closestTarget.shield;
            closestTarget.shield = 0;
          }
        }
        closestTarget.health = Math.max(0, closestTarget.health - dmg);

        io.to(room.id).emit('player:damaged', {
          victimId: closestTarget.id,
          attackerId: bot.id,
          health: closestTarget.health,
          shield: closestTarget.shield,
          isHeadshot: false
        });

        if (closestTarget.health <= 0) {
          bot.kills += 1;
          bot.score += 100;
          closestTarget.deaths += 1;

          io.to(room.id).emit('player:killed', {
            victimId: closestTarget.id,
            victimName: closestTarget.name,
            killerId: bot.id,
            killerName: bot.name,
            weapon: bot.weapon,
            isHeadshot: false
          });
        }
      }
    } else {
      bot.isFiring = false;
    }
  } else {
    // Idle patrol wander
    bot.x += Math.sin(bot.rotationY) * 0.08;
    bot.z += Math.cos(bot.rotationY) * 0.08;
    if (Math.random() < 0.02) {
      bot.rotationY += (Math.random() - 0.5) * 1.5;
    }
    bot.isFiring = false;
  }

  // Map boundaries clamping
  bot.x = Math.max(-55, Math.min(55, bot.x));
  bot.z = Math.max(-55, Math.min(55, bot.z));
}

// Start server
async function startServer() {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(port, '0.0.0.0', () => {
    console.log(`[Apex Striker Server] Running on http://0.0.0.0:${port}`);
  });
}

startServer();
