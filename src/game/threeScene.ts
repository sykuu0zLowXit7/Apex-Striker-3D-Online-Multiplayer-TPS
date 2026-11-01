import * as THREE from 'three';
import { MapType, PlayerNetState, WeaponDef } from '../types/game';
import { buildMap, MapEnvironment } from './maps';
import { createCharacter, createViewmodelRig, CharacterRig, ViewmodelRig } from './character';
import { ParticleSystem } from './particles';
import { soundEngine } from './audio';
import { WEAPONS } from './weapons';

const _vec3 = new THREE.Vector3();
const _shootDir = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();

export interface GameSceneCallbacks {
  onHealthChanged: (health: number, shield: number) => void;
  onAmmoChanged: (current: number, reserve: number) => void;
  onFuelChanged: (fuel: number) => void;
  onHitConfirmed: (isHeadshot: boolean) => void;
  onPlayerShoot: (origin: THREE.Vector3, direction: THREE.Vector3, weaponId: string, hitPlayerId?: string, damage?: number, isHeadshot?: boolean) => void;
  onPlayerMove: (state: Partial<PlayerNetState>) => void;
  onMinimapUpdate: (localPos: { x: number; z: number; headingX: number; headingZ: number }, enemies: Array<{ id: string; x: number; z: number; isBot?: boolean }>) => void;
}

export class GameSceneController {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private isDestroyed: boolean = false;
  private animFrameId: number = 0;

  // Environment
  private currentMapType: MapType = 'de_mirage';
  private currentMap: MapEnvironment | null = null;
  private keyLight: THREE.DirectionalLight;
  private fillLight: THREE.HemisphereLight;
  private particles: ParticleSystem;

  // Local Player state
  public localPlayerState: PlayerNetState;
  private viewmodel: ViewmodelRig;
  private currentWeaponDef: WeaponDef = WEAPONS.deagle;
  private currentAmmo: number = 7;
  private reserveAmmo: number = 35;
  private isReloading: boolean = false;
  private reloadTimer: number = 0;
  private lastFireTime: number = 0;
  private isCrouching: boolean = false;

  // Remote Players
  private remoteRigs: Map<string, CharacterRig> = new Map();
  private remoteTargetStates: Map<string, PlayerNetState> = new Map();

  // Controls & Camera (Standard FPS Euler Angles)
  private keysHeld: Record<string, boolean> = {};
  private pitchAngle: number = 0;
  private yawAngle: number = 0;
  private mouseDeltaX: number = 0;
  private mouseDeltaY: number = 0;
  private isAiming: boolean = false;
  private isFiringHeld: boolean = false;
  private screenShake: number = 0;
  private cameraRecoil: number = 0;
  private viewmodelRecoil: number = 0;
  public invertY: boolean = false;

  // Callbacks
  private callbacks: GameSceneCallbacks;

  constructor(container: HTMLElement, mapType: MapType, callbacks: GameSceneCallbacks) {
    this.container = container;
    this.currentMapType = mapType;
    this.callbacks = callbacks;

    // 1. Detect software WebGL
    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 2. Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    // 3. Scene & Camera (First-Person Perspective with YXZ Euler Order)
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, container.clientWidth / container.clientHeight, 0.05, 300);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(0, 0, 0);
    this.scene.add(this.camera);

    // 4. Lighting Rig (Bright Sunny Outdoor Radiance)
    this.keyLight = new THREE.DirectionalLight(0xfffaed, 2.8);
    this.keyLight.position.set(35, 60, 25);
    this.keyLight.castShadow = !this.isSoftwareGl;
    if (this.keyLight.castShadow) {
      this.keyLight.shadow.mapSize.width = 2048;
      this.keyLight.shadow.mapSize.height = 2048;
      this.keyLight.shadow.camera.near = 10;
      this.keyLight.shadow.camera.far = 180;
      const d = 45;
      this.keyLight.shadow.camera.left = -d;
      this.keyLight.shadow.camera.right = d;
      this.keyLight.shadow.camera.top = d;
      this.keyLight.shadow.camera.bottom = -d;
      this.keyLight.shadow.bias = -0.0004;
    }
    this.scene.add(this.keyLight);

    this.fillLight = new THREE.HemisphereLight(0x7eb4e6, 0xbfa58a, 1.2);
    this.scene.add(this.fillLight);

    // 5. Particles
    this.particles = new ParticleSystem(this.scene);

    // 6. Local Player State
    this.localPlayerState = {
      id: 'local_striker',
      name: 'Operador',
      room: 'global',
      x: 0,
      y: 0.5,
      z: 12,
      vx: 0,
      vy: 0,
      vz: 0,
      rotationY: 0,
      pitch: 0,
      health: 100,
      shield: 100,
      weapon: 'deagle',
      isFiring: false,
      isSprinting: false,
      isAiming: false,
      kills: 0,
      deaths: 0,
      score: 0,
      skin: 'standard',
      color: '#38bdf8',
      ping: 15,
      team: 'CT'
    };

    // 7. First-Person Viewmodel Rig (Gloved hands holding weapon CS:GO)
    this.viewmodel = createViewmodelRig(this.currentWeaponDef.id);
    this.camera.add(this.viewmodel.root);

    // 8. Load Initial Map
    this.loadMap(mapType);

    // 9. Attach Input Listeners
    this.attachEventListeners();

    // 10. Start Render Loop
    let lastTime = performance.now();
    const renderLoop = (time: number) => {
      if (this.isDestroyed) return;
      this.animFrameId = requestAnimationFrame(renderLoop);

      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      this.update(dt);
      this.renderer.render(this.scene, this.camera);
    };
    this.animFrameId = requestAnimationFrame(renderLoop);
  }

  public setInvertY(inverted: boolean) {
    this.invertY = inverted;
  }

  public loadMap(mapType: MapType) {
    this.currentMapType = mapType;
    if (this.currentMap) {
      this.scene.remove(this.currentMap.group);
      this.currentMap.group.traverse(obj => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      });
    }

    this.currentMap = buildMap(mapType);
    this.scene.add(this.currentMap.group);
    this.scene.background = new THREE.Color(this.currentMap.skyColor);
    this.scene.fog = new THREE.FogExp2(this.currentMap.fogColor, 0.008);

    if (this.currentMap.spawnPoints.length > 0) {
      const sp = this.currentMap.spawnPoints[0];
      this.localPlayerState.x = sp.x;
      this.localPlayerState.y = sp.y;
      this.localPlayerState.z = sp.z;
    }
  }

  public equipWeapon(weaponId: string) {
    const def = WEAPONS[weaponId] || WEAPONS.deagle;
    this.currentWeaponDef = def;
    this.currentAmmo = def.magSize;
    this.reserveAmmo = def.reserveMax || def.magSize * 4;
    this.localPlayerState.weapon = def.id;

    this.camera.remove(this.viewmodel.root);
    this.viewmodel.dispose();
    this.viewmodel = createViewmodelRig(def.id);
    this.camera.add(this.viewmodel.root);

    this.callbacks.onAmmoChanged(this.currentAmmo, this.reserveAmmo);
  }

  private attachEventListeners() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('contextmenu', this.onContextMenu);
  }

  private onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  private onKeyDown = (e: KeyboardEvent) => {
    this.keysHeld[e.code] = true;

    if (e.code === 'Digit1') {
      this.equipWeapon('ak47');
      soundEngine.playClick();
    } else if (e.code === 'Digit2') {
      this.equipWeapon('deagle');
      soundEngine.playClick();
    } else if (e.code === 'Digit3') {
      this.equipWeapon('awp');
      soundEngine.playClick();
    } else if (e.code === 'KeyR') {
      this.startReload();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keysHeld[e.code] = false;
  };

  private onMouseMove = (e: MouseEvent) => {
    if (document.pointerLockElement !== this.container && document.pointerLockElement !== this.renderer.domElement) {
      return;
    }
    const sens = this.isAiming ? 0.0012 : 0.0022;

    this.mouseDeltaX = e.movementX;
    this.mouseDeltaY = e.movementY;

    // Moving mouse to the right turns the camera to the RIGHT (in Three.js YXZ Euler, yaw decreases)
    this.yawAngle -= e.movementX * sens;

    // Moving mouse UP pitches the camera UP (browser e.movementY is negative when moving up, so subtracting increases pitch angle)
    const yMult = this.invertY ? -1 : 1;
    this.pitchAngle -= e.movementY * sens * yMult;
    // Clamp vertical look angle to avoid gimbal flip
    this.pitchAngle = Math.max(-1.45, Math.min(1.45, this.pitchAngle));
  };

  private onMouseDown = (e: MouseEvent) => {
    soundEngine.ensureContext();
    if (document.pointerLockElement !== this.container && document.pointerLockElement !== this.renderer.domElement) {
      this.requestPointerLock();
      return;
    }

    if (e.button === 0) {
      this.isFiringHeld = true;
      this.tryFireWeapon();
    } else if (e.button === 2) {
      this.isAiming = true;
    }
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) {
      this.isFiringHeld = false;
    } else if (e.button === 2) {
      this.isAiming = false;
    }
  };

  public requestPointerLock() {
    try {
      this.container.requestPointerLock();
    } catch {
      // ignore
    }
  }

  private onResize = () => {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private startReload() {
    if (this.isReloading || this.reserveAmmo <= 0 || this.currentAmmo >= this.currentWeaponDef.magSize) return;
    this.isReloading = true;
    this.reloadTimer = this.currentWeaponDef.reloadTimeMs / 1000;
    soundEngine.playReload();
  }

  private finishReload() {
    const needed = this.currentWeaponDef.magSize - this.currentAmmo;
    const toLoad = Math.min(needed, this.reserveAmmo);
    this.currentAmmo += toLoad;
    this.reserveAmmo -= toLoad;
    this.isReloading = false;
    this.callbacks.onAmmoChanged(this.currentAmmo, this.reserveAmmo);
  }

  private tryFireWeapon() {
    if (this.isReloading || this.localPlayerState.health <= 0) return;
    const now = performance.now();
    if (now - this.lastFireTime < this.currentWeaponDef.fireRateMs) return;

    if (this.currentAmmo <= 0) {
      this.startReload();
      return;
    }

    this.lastFireTime = now;
    this.currentAmmo -= 1;
    this.callbacks.onAmmoChanged(this.currentAmmo, this.reserveAmmo);

    // Audio & Recoil Kick
    soundEngine.playWeaponFire(this.currentWeaponDef.id);
    this.cameraRecoil += this.currentWeaponDef.recoil * (this.isAiming ? 0.4 : 1.0);
    this.viewmodelRecoil = 0.09;
    this.screenShake += 0.04;

    const muzzlePos = new THREE.Vector3();
    this.viewmodel.muzzleMarker.getWorldPosition(muzzlePos);

    let spread = this.currentWeaponDef.spread;
    if (this.isAiming) spread *= 0.4;
    if (this.isCrouching) spread *= 0.6;

    this.camera.getWorldDirection(_shootDir);

    const pellets = this.currentWeaponDef.pellets;
    for (let p = 0; p < pellets; p++) {
      const dirWithSpread = _shootDir.clone();
      dirWithSpread.x += (Math.random() - 0.5) * spread;
      dirWithSpread.y += (Math.random() - 0.5) * spread;
      dirWithSpread.z += (Math.random() - 0.5) * spread;
      dirWithSpread.normalize();

      // Muzzle Flash
      this.particles.spawnMuzzleFlash(muzzlePos, dirWithSpread, 0xfde047);

      // Raycast against remote players
      _raycaster.set(this.camera.position, dirWithSpread);
      _raycaster.far = this.currentWeaponDef.range;

      const remoteMeshes: THREE.Object3D[] = [];
      const meshToPlayerId = new Map<THREE.Object3D, { id: string; isHead: boolean }>();

      this.remoteRigs.forEach((rig, id) => {
        const target = this.remoteTargetStates.get(id);
        if (target && target.health > 0) {
          remoteMeshes.push(rig.torso, rig.head);
          meshToPlayerId.set(rig.torso, { id, isHead: false });
          meshToPlayerId.set(rig.head, { id, isHead: true });
        }
      });

      const hits = _raycaster.intersectObjects(remoteMeshes, false);
      let hitTargetId: string | undefined = undefined;
      let isHeadshot = false;
      const endPoint = muzzlePos.clone().add(dirWithSpread.clone().multiplyScalar(this.currentWeaponDef.range));

      if (hits.length > 0) {
        const firstHit = hits[0];
        endPoint.copy(firstHit.point);
        const hitInfo = meshToPlayerId.get(firstHit.object);
        if (hitInfo) {
          hitTargetId = hitInfo.id;
          isHeadshot = hitInfo.isHead;

          soundEngine.playHitMarker(isHeadshot);
          this.callbacks.onHitConfirmed(isHeadshot);
          this.particles.spawnHitSparks(firstHit.point, false);
        }
      } else {
        this.particles.spawnWallImpact(endPoint);
      }

      this.particles.spawnTracer(muzzlePos, endPoint, this.currentWeaponDef.type);

      this.callbacks.onPlayerShoot(
        muzzlePos,
        dirWithSpread,
        this.currentWeaponDef.id,
        hitTargetId,
        this.currentWeaponDef.damage,
        isHeadshot
      );
    }
  }

  private checkCollision(newX: number, newZ: number, radius: number = 0.5): boolean {
    if (!this.currentMap) return false;
    for (const c of this.currentMap.colliders) {
      if (
        newX + radius > c.minX &&
        newX - radius < c.maxX &&
        newZ + radius > c.minZ &&
        newZ - radius < c.maxZ
      ) {
        return true;
      }
    }
    return false;
  }

  public updateRemotePlayers(players: Record<string, PlayerNetState>, selfId: string) {
    for (const id in players) {
      if (id === selfId) {
        const s = players[id];
        if (s.health !== this.localPlayerState.health || s.shield !== this.localPlayerState.shield) {
          this.localPlayerState.health = s.health;
          this.localPlayerState.shield = s.shield;
          this.callbacks.onHealthChanged(s.health, s.shield);
        }
        this.localPlayerState.kills = s.kills;
        this.localPlayerState.deaths = s.deaths;
        this.localPlayerState.score = s.score;
        continue;
      }

      const pData = players[id];
      this.remoteTargetStates.set(id, pData);

      let rig = this.remoteRigs.get(id);
      if (!rig) {
        rig = createCharacter(pData, false);
        this.scene.add(rig.root);
        this.remoteRigs.set(id, rig);
      }
      rig.updateNameplate(pData.name, pData.health, pData.shield, pData.isBot);
      rig.root.visible = pData.health > 0;
    }

    this.remoteRigs.forEach((rig, id) => {
      if (!players[id]) {
        this.scene.remove(rig.root);
        rig.dispose();
        this.remoteRigs.delete(id);
        this.remoteTargetStates.delete(id);
      }
    });

    // Provide minimap data for radar in top-right
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const enemyList: Array<{ id: string; x: number; z: number; isBot?: boolean }> = [];
    this.remoteTargetStates.forEach(t => {
      if (t.health > 0) {
        enemyList.push({ id: t.id, x: t.x, z: t.z, isBot: t.isBot });
      }
    });
    this.callbacks.onMinimapUpdate(
      {
        x: this.localPlayerState.x,
        z: this.localPlayerState.z,
        headingX: forward.x,
        headingZ: forward.z
      },
      enemyList
    );
  }

  public handleRemoteShot(origin: { x: number; y: number; z: number }, dir: { x: number; y: number; z: number }, weapon: string) {
    const start = new THREE.Vector3(origin.x, origin.y, origin.z);
    const direction = new THREE.Vector3(dir.x, dir.y, dir.z).normalize();
    const end = start.clone().add(direction.multiplyScalar(80));

    soundEngine.playWeaponFire(weapon);
    this.particles.spawnMuzzleFlash(start, direction);
    this.particles.spawnTracer(start, end, weapon);
    this.particles.spawnWallImpact(end);
  }

  public handleDamage(victimId: string, attackerId: string, health: number, shield: number, isHeadshot?: boolean) {
    if (victimId === this.localPlayerState.id) {
      this.localPlayerState.health = health;
      this.localPlayerState.shield = shield;
      this.callbacks.onHealthChanged(health, shield);
      soundEngine.playDamageHurt(shield > 0);
      this.screenShake += 0.25;

      const pos = new THREE.Vector3(this.localPlayerState.x, this.localPlayerState.y + 1, this.localPlayerState.z);
      this.particles.spawnHitSparks(pos, shield > 0);
    } else {
      const rig = this.remoteRigs.get(victimId);
      if (rig) {
        const pos = rig.root.position.clone();
        pos.y += 1.0;
        this.particles.spawnHitSparks(pos, shield > 0);
      }
    }
  }

  public handleKill(killerId: string, victimId: string) {
    if (killerId === this.localPlayerState.id) {
      soundEngine.playKillChime();
    }
  }

  public handleRespawn(id: string, x: number, y: number, z: number, health: number, shield: number) {
    if (id === this.localPlayerState.id) {
      this.localPlayerState.x = x;
      this.localPlayerState.y = y;
      this.localPlayerState.z = z;
      this.localPlayerState.vx = 0;
      this.localPlayerState.vy = 0;
      this.localPlayerState.vz = 0;
      this.localPlayerState.health = health;
      this.localPlayerState.shield = shield;
      this.callbacks.onHealthChanged(health, shield);
    } else {
      const rig = this.remoteRigs.get(id);
      if (rig) {
        rig.root.position.set(x, y, z);
        rig.root.visible = true;
        rig.updateNameplate(this.remoteTargetStates.get(id)?.name || 'Operador', health, shield);
      }
    }
  }

  private update(dt: number) {
    // 1. Reload progress
    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.finishReload();
      }
    }

    // 2. Automatic firing if held
    if (this.isFiringHeld && !this.isReloading && this.currentWeaponDef.type === 'ar') {
      this.tryFireWeapon();
    }

    // 3. Local Player Movement & Physics
    if (this.localPlayerState.health > 0) {
      const isSprinting = !!(this.keysHeld['ShiftLeft'] || this.keysHeld['ShiftRight']);
      this.isCrouching = !!(this.keysHeld['ControlLeft'] || this.keysHeld['ControlRight'] || this.keysHeld['KeyC']);

      // Apply camera rotation directly (Euler YXZ: yaw horizontal, pitch vertical)
      this.cameraRecoil = THREE.MathUtils.damp(this.cameraRecoil, 0, 12, dt);
      this.camera.rotation.x = this.pitchAngle + this.cameraRecoil;
      this.camera.rotation.y = this.yawAngle;
      this.camera.rotation.z = 0;

      // Extract exact camera-relative Forward and Right vectors on XZ ground plane
      const forward = new THREE.Vector3();
      this.camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();

      // Right vector: cross product of forward with Up (0, 1, 0)
      const right = new THREE.Vector3();
      right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

      // WASD Input processing
      let moveForward = 0;
      let moveRight = 0;
      if (this.keysHeld['KeyW']) moveForward += 1;
      if (this.keysHeld['KeyS']) moveForward -= 1;
      if (this.keysHeld['KeyA']) moveRight -= 1; // A = Left
      if (this.keysHeld['KeyD']) moveRight += 1; // D = Right

      const isMoving = moveForward !== 0 || moveRight !== 0;
      let speed = 6.2;
      if (isSprinting && !this.isAiming && !this.isCrouching) speed = 8.8;
      if (this.isCrouching) speed = 3.2;
      if (this.isAiming) speed = 3.6;

      if (isMoving) {
        // True orthogonal projection onto camera direction:
        // W = +forward, S = -forward, D = +right, A = -right
        let dirX = forward.x * moveForward + right.x * moveRight;
        let dirZ = forward.z * moveForward + right.z * moveRight;
        const len = Math.hypot(dirX, dirZ);
        if (len > 0.001) {
          dirX = (dirX / len) * speed;
          dirZ = (dirZ / len) * speed;
        }

        this.localPlayerState.vx = THREE.MathUtils.damp(this.localPlayerState.vx, dirX, 14, dt);
        this.localPlayerState.vz = THREE.MathUtils.damp(this.localPlayerState.vz, dirZ, 14, dt);

        if (this.localPlayerState.y <= 0.55) {
          if (Math.random() < (isSprinting ? 0.12 : 0.065)) {
            soundEngine.playFootstep(isSprinting);
          }
        }
      } else {
        this.localPlayerState.vx = THREE.MathUtils.damp(this.localPlayerState.vx, 0, 18, dt);
        this.localPlayerState.vz = THREE.MathUtils.damp(this.localPlayerState.vz, 0, 18, dt);
      }

      // Jump impulse
      if (this.keysHeld['Space'] && this.localPlayerState.y <= 0.52 && !this.isCrouching) {
        this.localPlayerState.vy = 7.5;
        soundEngine.playJump();
      }

      // Standard gravity
      this.localPlayerState.vy -= 22 * dt;

      // Apply movement with collision detection
      const nextX = this.localPlayerState.x + this.localPlayerState.vx * dt;
      const nextZ = this.localPlayerState.z + this.localPlayerState.vz * dt;
      const nextY = Math.max(0.5, this.localPlayerState.y + this.localPlayerState.vy * dt);

      if (!this.checkCollision(nextX, this.localPlayerState.z)) {
        this.localPlayerState.x = nextX;
      } else {
        this.localPlayerState.vx = 0;
      }

      if (!this.checkCollision(this.localPlayerState.x, nextZ)) {
        this.localPlayerState.z = nextZ;
      } else {
        this.localPlayerState.vz = 0;
      }

      this.localPlayerState.y = nextY;
      if (this.localPlayerState.y <= 0.5) {
        this.localPlayerState.vy = 0;
      }

      // Camera position at eye level
      const eyeHeight = this.isCrouching ? 1.05 : 1.62;
      _vec3.set(this.localPlayerState.x, this.localPlayerState.y + eyeHeight, this.localPlayerState.z);

      if (this.screenShake > 0.005) {
        _vec3.x += (Math.random() - 0.5) * this.screenShake;
        _vec3.y += (Math.random() - 0.5) * this.screenShake;
        _vec3.z += (Math.random() - 0.5) * this.screenShake;
      }
      this.camera.position.copy(_vec3);

      this.screenShake = THREE.MathUtils.damp(this.screenShake, 0, 10, dt);

      // FOV (Aim zoom)
      let targetFov = 72;
      if (this.isAiming) targetFov = this.currentWeaponDef.adsFov;
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 14, dt);
      this.camera.updateProjectionMatrix();

      // Viewmodel update (hands & weapon attached to camera)
      this.viewmodelRecoil = THREE.MathUtils.damp(this.viewmodelRecoil, 0, 12, dt);
      this.viewmodel.update(
        dt,
        isMoving,
        isSprinting,
        this.isAiming,
        this.viewmodelRecoil,
        this.mouseDeltaX,
        this.mouseDeltaY
      );

      // Reset mouse deltas after consuming in frame
      this.mouseDeltaX = 0;
      this.mouseDeltaY = 0;

      // Transmit network state
      this.callbacks.onPlayerMove({
        x: this.localPlayerState.x,
        y: this.localPlayerState.y,
        z: this.localPlayerState.z,
        vx: this.localPlayerState.vx,
        vy: this.localPlayerState.vy,
        vz: this.localPlayerState.vz,
        rotationY: this.yawAngle,
        pitch: this.pitchAngle,
        isSprinting,
        isCrouching: this.isCrouching,
        isAiming: this.isAiming,
        isFiring: this.isFiringHeld
      });
    }

    // 4. Remote players interpolation
    this.remoteRigs.forEach((rig, id) => {
      const target = this.remoteTargetStates.get(id);
      if (!target) return;

      rig.root.position.x = THREE.MathUtils.damp(rig.root.position.x, target.x, 14, dt);
      rig.root.position.y = THREE.MathUtils.damp(rig.root.position.y, target.y, 14, dt);
      rig.root.position.z = THREE.MathUtils.damp(rig.root.position.z, target.z, 14, dt);
      rig.root.rotation.y = THREE.MathUtils.damp(rig.root.rotation.y, target.rotationY, 14, dt);

      rig.updateAnimation(dt, target, false);
    });

    // 5. Particles update
    this.particles.update(dt);
  }

  public destroy() {
    this.isDestroyed = true;
    cancelAnimationFrame(this.animFrameId);

    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('contextmenu', this.onContextMenu);

    this.particles.dispose();
    this.viewmodel.dispose();

    if (this.currentMap) {
      this.scene.remove(this.currentMap.group);
    }

    this.remoteRigs.forEach(rig => {
      this.scene.remove(rig.root);
      rig.dispose();
    });
    this.remoteRigs.clear();

    this.renderer.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
