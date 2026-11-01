import React, { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { GameSceneController } from './game/threeScene';
import { soundEngine } from './game/audio';
import { WEAPONS, SKINS, loadEconomy, saveEconomy, PlayerEconomy } from './game/weapons';
import { MapType, RoomSummary, KillfeedEntry, PlayerNetState } from './types/game';
import {
  Shield, Volume2, VolumeX, Trophy,
  Users, RefreshCw, Plus, ArrowLeft, Download, Copy, Check,
  Play, Settings, ShoppingBag, Server, ShoppingCart, Crosshair as CrosshairIcon
} from 'lucide-react';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const sceneControllerRef = useRef<GameSceneController | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Game UI Flow State
  const [gameState, setGameState] = useState<'title' | 'menu' | 'playing' | 'paused' | 'death'>('title');
  const [menuTab, setMenuTab] = useState<'quickplay' | 'servers' | 'armory' | 'export' | 'settings'>('quickplay');

  // Player & Economy State
  const [playerName, setPlayerName] = useState<string>('Operador-1');
  const [selectedMap, setSelectedMap] = useState<MapType>('de_mirage');
  const [economy, setEconomy] = useState<PlayerEconomy>(loadEconomy);
  const [activeWeaponId, setActiveWeaponId] = useState<string>('deagle');
  const [selectedArmoryWeapon, setSelectedArmoryWeapon] = useState<string>('deagle');

  // Live CS:GO Tactical HUD State
  const [health, setHealth] = useState<number>(100);
  const [shield, setShield] = useState<number>(100);
  const [ammoCurrent, setAmmoCurrent] = useState<number>(7);
  const [ammoReserve, setAmmoReserve] = useState<number>(35);
  const [ping, setPing] = useState<number>(14);
  const [isHitConfirmed, setIsHitConfirmed] = useState<boolean>(false);
  const [hitIsHeadshot, setHitIsHeadshot] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [invertY, setInvertY] = useState<boolean>(false);

  // Matchmaking & Servers
  const [serverList, setServerList] = useState<RoomSummary[]>([]);
  const [currentRoomInfo, setCurrentRoomInfo] = useState<{ id: string; name: string; map: MapType } | null>(null);
  const [connectedPlayers, setConnectedPlayers] = useState<Record<string, PlayerNetState>>({});
  const [killfeed, setKillfeed] = useState<KillfeedEntry[]>([]);

  // Create Room Form
  const [newRoomName, setNewRoomName] = useState<string>('Servidor Competitivo');
  const [newRoomMap, setNewRoomMap] = useState<MapType>('de_mirage');
  const [newRoomMax, setNewRoomMax] = useState<number>(10);
  const [newRoomBots, setNewRoomBots] = useState<boolean>(true);

  // Death & Respawn
  const [respawnTime, setRespawnTime] = useState<number>(3);
  const [killerName, setKillerName] = useState<string>('Terrorista Rival');

  // Export Viewer
  const [exportTab, setExportTab] = useState<'index' | 'server'>('index');

  // Minimap canvas ref for Top-Right radar
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);

  // 1. Initialize Socket.IO connection
  useEffect(() => {
    const socket = io({
      reconnectionAttempts: 5,
      timeout: 4000
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('get:rooms');
    });

    const pingInterval = setInterval(() => {
      if (socket.connected) {
        const start = performance.now();
        socket.emit('ping:check', start);
      }
    }, 3500);

    socket.on('pong:reply', (clientTimestamp: number) => {
      const lat = Math.round(performance.now() - clientTimestamp);
      setPing(lat);
    });

    socket.on('rooms:list', (list: RoomSummary[]) => {
      setServerList(list);
    });

    socket.on('game:init', (data: { selfId: string; room: { id: string; name: string; map: MapType }; players: Record<string, PlayerNetState> }) => {
      setCurrentRoomInfo(data.room);
      setConnectedPlayers(data.players);
      if (sceneControllerRef.current) {
        sceneControllerRef.current.localPlayerState.id = data.selfId;
        sceneControllerRef.current.loadMap(data.room.map);
        sceneControllerRef.current.updateRemotePlayers(data.players, data.selfId);
      }
    });

    socket.on('world:tick', (data: { players: Record<string, PlayerNetState> }) => {
      setConnectedPlayers(data.players);
      if (sceneControllerRef.current) {
        sceneControllerRef.current.updateRemotePlayers(data.players, socket.id || '');
      }
    });

    socket.on('bullet:tracer', (data: { shooterId: string; origin: { x: number; y: number; z: number }; direction: { x: number; y: number; z: number }; weapon: string }) => {
      if (sceneControllerRef.current) {
        sceneControllerRef.current.handleRemoteShot(data.origin, data.direction, data.weapon);
      }
    });

    socket.on('player:damaged', (data: { victimId: string; attackerId: string; health: number; shield: number; isHeadshot?: boolean }) => {
      if (sceneControllerRef.current) {
        sceneControllerRef.current.handleDamage(data.victimId, data.attackerId, data.health, data.shield, data.isHeadshot);
      }
    });

    socket.on('player:killed', (data: { victimId: string; victimName: string; killerId: string; killerName: string; weapon: string; isHeadshot: boolean }) => {
      const newEntry: KillfeedEntry = {
        id: `${Date.now()}_${Math.random()}`,
        killerName: data.killerName,
        victimName: data.victimName,
        weapon: data.weapon,
        isHeadshot: data.isHeadshot,
        timestamp: Date.now()
      };
      setKillfeed(prev => [newEntry, ...prev.slice(0, 5)]);

      if (sceneControllerRef.current) {
        sceneControllerRef.current.handleKill(data.killerId, data.victimId);
      }

      if (data.victimId === socket.id) {
        setKillerName(data.killerName);
        setGameState('death');
        setRespawnTime(3);
      }

      if (data.killerId === socket.id) {
        const bonus = data.isHeadshot ? 600 : 300;
        setEconomy(prev => {
          const next = { ...prev, credits: prev.credits + bonus };
          saveEconomy(next);
          return next;
        });
      }
    });

    socket.on('player:respawn', (data: { id: string; x: number; y: number; z: number; health: number; shield: number }) => {
      if (sceneControllerRef.current) {
        sceneControllerRef.current.handleRespawn(data.id, data.x, data.y, data.z, data.health, data.shield);
      }
      if (data.id === socket.id) {
        setHealth(data.health);
        setShield(data.shield);
        setGameState('playing');
        setTimeout(() => {
          sceneControllerRef.current?.requestPointerLock();
        }, 100);
      }
    });

    return () => {
      clearInterval(pingInterval);
      socket.disconnect();
    };
  }, []);

  // 2. Initialize Three.js scene controller
  useEffect(() => {
    if (!canvasMountRef.current) return;

    const controller = new GameSceneController(
      canvasMountRef.current,
      selectedMap,
      {
        onHealthChanged: (h, s) => {
          setHealth(h);
          setShield(s);
          if (h <= 0 && gameState === 'playing') {
            setGameState('death');
            setRespawnTime(3);
          }
        },
        onAmmoChanged: (cur, res) => {
          setAmmoCurrent(cur);
          setAmmoReserve(res);
        },
        onFuelChanged: () => {},
        onHitConfirmed: (isHead) => {
          setIsHitConfirmed(true);
          setHitIsHeadshot(isHead);
          setTimeout(() => setIsHitConfirmed(false), 120);
        },
        onPlayerShoot: (origin, direction, weaponId, hitPlayerId, damage, isHeadshot) => {
          if (socketRef.current && socketRef.current.connected) {
            socketRef.current.emit('player:shoot', {
              origin: { x: origin.x, y: origin.y, z: origin.z },
              direction: { x: direction.x, y: direction.y, z: direction.z },
              weapon: weaponId,
              hitPlayerId,
              damage,
              isHeadshot
            });
          }
        },
        onPlayerMove: (state) => {
          if (socketRef.current && socketRef.current.connected) {
            socketRef.current.emit('player:move', state);
          }
        },
        onMinimapUpdate: (localPos, enemies) => {
          // Render TOP-RIGHT tactical circular radar
          const canvas = minimapCanvasRef.current;
          if (!canvas) return;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          const w = canvas.width;
          const h = canvas.height;
          const cx = w / 2;
          const cy = h / 2;
          const radius = (w / 2) - 6;
          const zoom = 1.8;

          ctx.clearRect(0, 0, w, h);

          // Radar circle background with dark glass overlay
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.clip();

          ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
          ctx.fillRect(0, 0, w, h);

          // Radar concentric range rings
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(cx, cy, radius * 0.45, 0, Math.PI * 2);
          ctx.arc(cx, cy, radius * 0.8, 0, Math.PI * 2);
          ctx.stroke();

          // Crosshairs
          ctx.beginPath();
          ctx.moveTo(cx, cy - radius);
          ctx.lineTo(cx, cy + radius);
          ctx.moveTo(cx - radius, cy);
          ctx.lineTo(cx + radius, cy);
          ctx.stroke();

          // Bombsite Markers (A & B)
          const siteAx = cx + (15 - localPos.x) * zoom;
          const siteAy = cy + (-10 - localPos.z) * zoom;
          ctx.fillStyle = '#f59e0b';
          ctx.font = 'bold 11px monospace';
          ctx.fillText('A', siteAx, siteAy);

          const siteBx = cx + (-12 - localPos.x) * zoom;
          const siteBy = cy + (12 - localPos.z) * zoom;
          ctx.fillStyle = '#ef4444';
          ctx.fillText('B', siteBx, siteBy);

          // Enemies / Teammates
          enemies.forEach(en => {
            const relX = cx + (en.x - localPos.x) * zoom;
            const relY = cy + (en.z - localPos.z) * zoom;

            ctx.fillStyle = en.isBot ? '#f97316' : '#ef4444';
            ctx.beginPath();
            ctx.arc(relX, relY, 4, 0, Math.PI * 2);
            ctx.fill();
          });

          // Local Player Dot and Heading Cone
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
          ctx.fill();

          // Heading line
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + localPos.headingX * 16, cy + localPos.headingZ * 16);
          ctx.stroke();

          ctx.restore();

          // Radar Outer Border Ring
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    );

    sceneControllerRef.current = controller;

    return () => {
      controller.destroy();
      sceneControllerRef.current = null;
    };
  }, []);

  // Update Invert Y
  useEffect(() => {
    sceneControllerRef.current?.setInvertY(invertY);
  }, [invertY]);

  // Respawn countdown timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (gameState === 'death' && respawnTime > 0) {
      timer = setTimeout(() => {
        setRespawnTime(prev => prev - 1);
      }, 1000);
    } else if (gameState === 'death' && respawnTime === 0) {
      if (socketRef.current?.connected) {
        socketRef.current.emit('player:request_respawn');
      } else {
        sceneControllerRef.current?.handleRespawn('local_striker', 0, 0.5, 14, 100, 100);
        setHealth(100);
        setShield(100);
        setGameState('playing');
        setTimeout(() => sceneControllerRef.current?.requestPointerLock(), 100);
      }
    }
    return () => clearTimeout(timer);
  }, [gameState, respawnTime]);

  const handleStartGame = useCallback((map: MapType) => {
    soundEngine.ensureContext();
    soundEngine.playClick();
    setSelectedMap(map);

    if (socketRef.current?.connected) {
      socketRef.current.emit('room:join', {
        roomId: 'dust2_competitive_01',
        playerName: playerName || 'Operador',
        map
      });
    }

    if (sceneControllerRef.current) {
      sceneControllerRef.current.loadMap(map);
      sceneControllerRef.current.equipWeapon(economy.selectedWeapon);
    }

    setGameState('playing');
    setTimeout(() => {
      sceneControllerRef.current?.requestPointerLock();
    }, 150);
  }, [playerName, economy.selectedWeapon]);

  const handleToggleMute = () => {
    const next = soundEngine.toggleMute();
    setIsMuted(next);
  };

  const handleBuyOrEquipWeapon = (weaponId: string) => {
    soundEngine.playClick();
    const weaponDef = WEAPONS[weaponId];
    if (!weaponDef) return;

    if (economy.unlockedWeapons.includes(weaponId)) {
      const next = { ...economy, selectedWeapon: weaponId };
      setEconomy(next);
      saveEconomy(next);
      setActiveWeaponId(weaponId);
      sceneControllerRef.current?.equipWeapon(weaponId);
    } else if (economy.credits >= weaponDef.cost) {
      const next = {
        ...economy,
        credits: economy.credits - weaponDef.cost,
        unlockedWeapons: [...economy.unlockedWeapons, weaponId],
        selectedWeapon: weaponId
      };
      setEconomy(next);
      saveEconomy(next);
      setActiveWeaponId(weaponId);
      sceneControllerRef.current?.equipWeapon(weaponId);
    }
  };

  const currentWeaponData = WEAPONS[sceneControllerRef.current?.localPlayerState.weapon || economy.selectedWeapon] || WEAPONS.deagle;
  const armoryWeaponData = WEAPONS[selectedArmoryWeapon] || WEAPONS.deagle;
  const isArmoryWeaponUnlocked = economy.unlockedWeapons.includes(selectedArmoryWeapon);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none">
      
      {/* 1. 3D WebGL Canvas Layer */}
      <div
        ref={canvasMountRef}
        onClick={() => {
          if (gameState === 'playing') {
            sceneControllerRef.current?.requestPointerLock();
          }
        }}
        className="absolute inset-0 z-0 cursor-crosshair"
      />

      {/* 2. Realistic CS:GO Screen Damage Vignette */}
      {health < 100 && gameState === 'playing' && (
        <div
          className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-300"
          style={{
            background: `radial-gradient(ellipse at center, transparent 40%, rgba(220, 38, 38, ${(1 - health / 100) * 0.7}) 100%)`
          }}
        />
      )}

      {/* 3. Crosshair & Hitmarker Layer */}
      {gameState === 'playing' && (
        <div className="pointer-events-none absolute inset-0 z-15 flex items-center justify-center">
          {/* Tactical Crosshair */}
          <div className="relative flex items-center justify-center">
            {/* Horizontal & Vertical Green Lines */}
            <div className="absolute w-[18px] h-[2px] bg-emerald-400 shadow-[0_0_2px_#000]" style={{ left: '-22px' }} />
            <div className="absolute w-[18px] h-[2px] bg-emerald-400 shadow-[0_0_2px_#000]" style={{ right: '-22px' }} />
            <div className="absolute h-[18px] w-[2px] bg-emerald-400 shadow-[0_0_2px_#000]" style={{ top: '-22px' }} />
            <div className="absolute h-[18px] w-[2px] bg-emerald-400 shadow-[0_0_2px_#000]" style={{ bottom: '-22px' }} />
            <div className="w-[3px] h-[3px] rounded-full bg-emerald-300" />

            {/* Hitmarker X Feedback */}
            {isHitConfirmed && (
              <div className="absolute animate-ping">
                <div className={`text-xl font-black ${hitIsHeadshot ? 'text-amber-400 drop-shadow-[0_0_8px_#f59e0b]' : 'text-rose-500'}`}>
                  ✕
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. TITLE SCREEN */}
      {gameState === 'title' && (
        <div className="absolute inset-0 z-30 flex flex-col justify-between p-8 bg-slate-950/75 backdrop-blur-sm">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded bg-emerald-600 flex items-center justify-center text-white font-black text-xl">
                CS
              </div>
              <div>
                <span className="text-xs uppercase tracking-[0.25em] text-emerald-400 font-mono">Counter-Strike Web Edition</span>
                <h1 className="text-3xl sm:text-4xl font-black tracking-wider text-white">
                  TACTICAL STRIKE FPS
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-700/80 rounded px-3 py-1.5 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>SERVIDORES ACTIVOS (128 TICK)</span>
              <button
                onClick={handleToggleMute}
                className="hover:text-emerald-400 transition-colors ml-2"
                title={isMuted ? 'Activar Sonido' : 'Silenciar'}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center text-center max-w-xl mx-auto my-auto">
            <div className="mb-4 inline-flex items-center gap-2 px-3 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs tracking-widest font-mono">
              ★ COMPETITIVO EN 1ª PERSONA // DE_MIRAGE B-SITE ALLEY
            </div>
            
            <h2 className="text-4xl sm:text-5xl font-black text-white tracking-wide uppercase mb-3">
              DESPLIEGUE TÁCTICO INMEDIATO
            </h2>
            <p className="text-slate-400 text-sm sm:text-base mb-8 max-w-md">
              Shooter puro en primera persona con Desert Eagle .50 AE, AK-47, AWP, spray red B graffiti en de_mirage y controles fluidos WASD.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
              <button
                onClick={() => handleStartGame(selectedMap)}
                className="px-8 py-3.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold tracking-wider text-lg shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all cursor-pointer"
              >
                DESPLEGAR AHORA (JUGAR)
              </button>
              <button
                onClick={() => {
                  soundEngine.ensureContext();
                  soundEngine.playClick();
                  setGameState('menu');
                  setMenuTab('armory');
                }}
                className="px-6 py-3.5 rounded bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <ShoppingBag className="w-4 h-4 text-amber-400" /> COMPRAR ARMAS (${economy.credits})
              </button>
            </div>
          </div>

          <div className="flex flex-wrap justify-between items-center text-xs text-slate-400 font-mono border-t border-slate-800 pt-4">
            <div>W/S: Caminar · A/D: Desplazarse · Ctrl: Agacharse · Shift: Caminar sigiloso · Espacio: Saltar · Click: Disparar · 1/2/3: Cambiar arma</div>
            <div className="text-emerald-400 font-bold">128 TICK // DE_MIRAGE</div>
          </div>
        </div>
      )}

      {/* 5. LOBBY & ARMORY MENU */}
      {gameState === 'menu' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-800 bg-slate-950">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { soundEngine.playClick(); setGameState('title'); }}
                  className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-xl font-bold text-white tracking-wider">TIENDA Y ARMERÍA CS:GO</h2>
                  <p className="text-xs text-slate-400">Selecciona armas, skins y despliegue táctico</p>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-1.5 rounded text-emerald-400 font-mono font-bold text-sm">
                <ShoppingCart className="w-4 h-4" />
                <span>${economy.credits}</span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-800 bg-slate-950/70 px-6 gap-2">
              {[
                { id: 'armory', label: 'Comprar Armas', icon: ShoppingBag },
                { id: 'quickplay', label: 'Mapas de Juego', icon: Play },
                { id: 'servers', label: 'Servidores', icon: Server },
                { id: 'settings', label: 'Configuración', icon: Settings },
                { id: 'export', label: 'Deploy Render', icon: Download },
              ].map(tab => {
                const Icon = tab.icon;
                const active = menuTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => { soundEngine.playClick(); setMenuTab(tab.id as typeof menuTab); }}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold tracking-wider border-b-2 transition-all cursor-pointer ${
                      active
                        ? 'border-emerald-400 text-emerald-400 bg-emerald-500/10'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab Contents */}
            <div className="p-6 overflow-y-auto flex-1">
              
              {/* TAB: ARMORY */}
              {menuTab === 'armory' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Armas Disponibles</h3>
                    <div className="space-y-2">
                      {Object.values(WEAPONS).map(w => {
                        const isUnlocked = economy.unlockedWeapons.includes(w.id);
                        const isEquipped = economy.selectedWeapon === w.id;
                        return (
                          <div
                            key={w.id}
                            onClick={() => { soundEngine.playClick(); setSelectedArmoryWeapon(w.id); }}
                            className={`p-3 rounded border flex items-center justify-between cursor-pointer transition-all ${
                              selectedArmoryWeapon === w.id
                                ? 'border-emerald-400 bg-emerald-500/10'
                                : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                            }`}
                          >
                            <div>
                              <div className="font-bold text-sm text-white flex items-center gap-2">
                                {w.name}
                                {isEquipped && <span className="text-[10px] bg-emerald-500 text-slate-950 px-1.5 py-0.2 rounded font-mono font-bold">EQUIPADA</span>}
                              </div>
                              <div className="text-xs text-slate-400 font-mono">
                                Daño: {w.damage} · Cargador: {w.magSize} rondas
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="font-mono text-sm font-bold text-amber-400">${w.cost}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-slate-950/60 p-5 rounded border border-slate-800 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-lg font-bold text-white">{armoryWeaponData.name}</h4>
                        <span className="font-mono font-bold text-amber-400 text-lg">${armoryWeaponData.cost}</span>
                      </div>
                      <p className="text-xs text-slate-400 mb-6">{armoryWeaponData.description}</p>

                      <div className="space-y-3 text-xs font-mono">
                        <div>
                          <div className="flex justify-between text-slate-400 mb-1">
                            <span>Daño por disparo</span>
                            <span className="text-white">{armoryWeaponData.damage} HP</span>
                          </div>
                          <div className="h-1.5 bg-slate-800 rounded">
                            <div className="h-full bg-emerald-400" style={{ width: `${(armoryWeaponData.damage / 120) * 100}%` }} />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-slate-400 mb-1">
                            <span>Capacidad del cargador</span>
                            <span className="text-white">{armoryWeaponData.magSize} balas</span>
                          </div>
                          <div className="h-1.5 bg-slate-800 rounded">
                            <div className="h-full bg-emerald-400" style={{ width: `${(armoryWeaponData.magSize / 40) * 100}%` }} />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-slate-400 mb-1">
                            <span>Alcance de precisión</span>
                            <span className="text-white">{armoryWeaponData.range} m</span>
                          </div>
                          <div className="h-1.5 bg-slate-800 rounded">
                            <div className="h-full bg-emerald-400" style={{ width: `${(armoryWeaponData.range / 280) * 100}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-6">
                      <button
                        onClick={() => handleBuyOrEquipWeapon(selectedArmoryWeapon)}
                        disabled={!isArmoryWeaponUnlocked && economy.credits < armoryWeaponData.cost}
                        className={`w-full py-3 rounded font-bold tracking-wider transition-all cursor-pointer ${
                          economy.selectedWeapon === selectedArmoryWeapon
                            ? 'bg-slate-800 text-slate-500 cursor-default'
                            : isArmoryWeaponUnlocked
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            : economy.credits >= armoryWeaponData.cost
                            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black'
                            : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                        }`}
                      >
                        {economy.selectedWeapon === selectedArmoryWeapon
                          ? 'ARMA YA EQUIPADA'
                          : isArmoryWeaponUnlocked
                          ? 'EQUIPAR ARMA'
                          : economy.credits >= armoryWeaponData.cost
                          ? `COMPRAR POR $${armoryWeaponData.cost}`
                          : `DINERO INSUFICIENTE ($${armoryWeaponData.cost})`}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: QUICKPLAY */}
              {menuTab === 'quickplay' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">Seleccionar Mapa</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { id: 'de_mirage', name: 'de_mirage (B Alley)', desc: 'Paredes de arenisca con grafiti rojo B y casa azul mediterránea' },
                      { id: 'de_inferno', name: 'de_inferno', desc: 'Calles empedradas italianas, fuentes y techos de tejas' },
                      { id: 'de_cache', name: 'de_cache', desc: 'Almacén industrial militar con contenedores y hormigón' }
                    ].map(m => (
                      <div
                        key={m.id}
                        onClick={() => { soundEngine.playClick(); setSelectedMap(m.id as MapType); }}
                        className={`p-4 rounded border cursor-pointer transition-all ${
                          selectedMap === m.id
                            ? 'border-emerald-400 bg-emerald-500/15 text-white'
                            : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <h4 className="font-bold text-white mb-1">{m.name}</h4>
                        <p className="text-xs text-slate-400">{m.desc}</p>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4">
                    <button
                      onClick={() => handleStartGame(selectedMap)}
                      className="w-full py-3.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold tracking-wider cursor-pointer"
                    >
                      UNIRSE AL MAPA SELECCIONADO
                    </button>
                  </div>
                </div>
              )}

              {/* TAB: SETTINGS */}
              {menuTab === 'settings' && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-950 rounded border border-slate-800 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-white text-sm">INVERTIR EJE VERTICAL (RATÓN)</div>
                      <div className="text-xs text-slate-400">
                        {invertY ? 'Mover ratón arriba apunta abajo' : 'Normal estándar (Mover arriba apunta arriba)'}
                      </div>
                    </div>
                    <button
                      onClick={() => { soundEngine.playClick(); setInvertY(!invertY); }}
                      className={`px-4 py-2 rounded text-xs font-bold cursor-pointer ${
                        invertY ? 'bg-amber-500 text-slate-950' : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {invertY ? 'INVERTIDO: SI' : 'NORMAL: NO'}
                    </button>
                  </div>

                  <div className="p-4 bg-slate-950 rounded border border-slate-800 space-y-2 text-xs">
                    <h4 className="font-bold text-emerald-400 text-sm">CONTROLES DE COMBATE</h4>
                    <div className="grid grid-cols-2 gap-2 text-slate-300">
                      <div><strong>W:</strong> Caminar hacia adelante</div>
                      <div><strong>S:</strong> Caminar hacia atrás</div>
                      <div><strong>A:</strong> Desplazarse a la izquierda</div>
                      <div><strong>D:</strong> Desplazarse a la derecha</div>
                      <div><strong>Control / C:</strong> Agacharse (Mayor precisión)</div>
                      <div><strong>Shift:</strong> Sprint táctico</div>
                      <div><strong>Espacio:</strong> Saltar</div>
                      <div><strong>1 / 2 / 3:</strong> Cambiar armas (AK, Deagle, AWP)</div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: EXPORT RENDER */}
              {menuTab === 'export' && (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded text-xs text-emerald-300">
                    <strong>Despliegue directo en Render.com:</strong> El servidor y cliente empaquetados se ubican en <code className="bg-slate-950 px-1 py-0.5 rounded text-emerald-400">/render-deploy/</code>.
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* 6. AUTHENTIC CS:GO HUD (EXACT COPY OF SCREENSHOT) */}
      {gameState === 'playing' && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-4 sm:p-6">
          
          {/* ========================================================= */}
          {/* TOP BAR: ROUND TIMER, SCORES & ALIVE ICONS (CS:GO STYLE) */}
          {/* ========================================================= */}
          <div className="flex justify-between items-start">
            
            {/* Top Left: Blank / Team Tag */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400 uppercase tracking-widest bg-slate-950/60 px-2 py-1 rounded">
                CT Start
              </span>
            </div>

            {/* Top Center: CS:GO Match Scoreboard Bar */}
            <div className="flex items-center shadow-lg">
              {/* CT Alive Shields (Left 5 Players) */}
              <div className="flex items-center gap-1 bg-sky-900/80 border-t border-b border-l border-sky-600/60 px-3 py-1.5">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="w-5 h-6 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-sky-300 drop-shadow-[0_0_3px_#38bdf8]" />
                  </div>
                ))}
              </div>

              {/* Center Match Time & Scores */}
              <div className="bg-slate-950 border border-slate-700 px-4 py-1 flex flex-col items-center min-w-[70px]">
                <span className="text-white font-mono font-bold text-xs tracking-wider">1:50</span>
                <div className="flex items-center gap-2 text-[11px] font-mono font-bold">
                  <span className="text-sky-400">0</span>
                  <span className="text-slate-500">:</span>
                  <span className="text-amber-400">0</span>
                </div>
              </div>

              {/* T Alive Knives/Swords (Right 5 Players) */}
              <div className="flex items-center gap-1 bg-amber-900/80 border-t border-b border-r border-amber-600/60 px-3 py-1.5">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="w-5 h-6 flex items-center justify-center">
                    <span className="text-amber-300 text-xs font-bold">⚔</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ========================================================= */}
            {/* TOP RIGHT: CIRCULAR RADAR (USER EXPLICIT REQUEST)        */}
            {/* ========================================================= */}
            <div className="flex flex-col items-end gap-2">
              {/* Tactical Radar Canvas */}
              <div className="relative">
                <canvas
                  ref={minimapCanvasRef}
                  width={150}
                  height={150}
                  className="rounded-full shadow-2xl drop-shadow-[0_0_10px_rgba(0,0,0,0.8)]"
                />
                {/* Radar label markers */}
                <div className="absolute top-1 left-3 text-[10px] font-mono font-black text-amber-400">B</div>
                <div className="absolute top-8 right-3 text-[10px] font-mono font-black text-emerald-400">A</div>
              </div>

              {/* CS:GO Money indicator (directly below top-right radar as in screenshot) */}
              <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-700/80 px-2.5 py-1 rounded text-white font-mono font-bold text-sm shadow">
                <span className="text-emerald-400">${economy.credits}</span>
                <ShoppingCart className="w-3.5 h-3.5 text-slate-400" />
              </div>
            </div>

          </div>

          {/* ========================================================= */}
          {/* BOTTOM BAR: HEALTH + ARMOR (LEFT) & AMMO / TALLIES (RIGHT)*/}
          {/* ========================================================= */}
          <div className="flex justify-between items-end">
            
            {/* Bottom Left: + 100 [Health] and 🛡️ 100 [Armor] */}
            <div className="flex items-center gap-6 pb-2">
              {/* Health: + 100 */}
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-white font-mono drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                  +
                </span>
                <div className="flex flex-col">
                  <span className="text-3xl font-black text-white font-mono tracking-tight leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                    {health}
                  </span>
                  <div className="w-16 h-1 bg-slate-700/80 rounded mt-1 overflow-hidden">
                    <div
                      className="h-full bg-white transition-all duration-200"
                      style={{ width: `${Math.max(0, health)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Armor: 🛡️ 100 */}
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-white fill-white/20 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
                <span className="text-2xl font-black text-white font-mono tracking-tight leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                  {shield}
                </span>
              </div>
            </div>

            {/* Bottom Right: Ammo 7 / 35 ///// (matching Desert Eagle screenshot) */}
            <div className="flex items-baseline gap-2 pb-2">
              <span className="text-4xl font-black text-white font-mono tracking-tight leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                {ammoCurrent}
              </span>
              <span className="text-xl font-bold text-slate-400 font-mono">
                / {ammoReserve}
              </span>
              {/* CS:GO Bullet tally slashes ///// */}
              <span className="text-sm font-black text-slate-400 font-mono tracking-tighter opacity-80">
                {'/////'}
              </span>
            </div>

          </div>

        </div>
      )}

      {/* 7. DEATH SCREEN */}
      {gameState === 'death' && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 bg-rose-950/80 backdrop-blur-md">
          <div className="text-center space-y-4 max-w-md">
            <div className="text-rose-500 font-black text-4xl uppercase tracking-wider font-mono">
              ELIMINADO EN COMBATE
            </div>
            <p className="text-slate-300 text-sm">
              Caíste ante <strong className="text-white font-bold">{killerName}</strong>.
            </p>
            <div className="text-xl font-mono text-emerald-400 font-bold">
              Reaparición en {respawnTime}s...
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
