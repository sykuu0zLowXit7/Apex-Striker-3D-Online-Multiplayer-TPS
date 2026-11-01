import * as THREE from 'three';

export interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  size: number;
  initialSize: number;
  life: number;
  maxLife: number;
  active: boolean;
}

export class ParticleSystem {
  private maxParticles = 600;
  private particles: Particle[] = [];
  private geometry: THREE.BufferGeometry;
  private material: THREE.PointsMaterial;
  private points: THREE.Points;
  private positions: Float32Array;
  private colors: Float32Array;
  private sizes: Float32Array;

  // Bullet tracer lines pool
  private tracersGroup: THREE.Group;
  private tracers: Array<{ line: THREE.Line; life: number; maxLife: number; active: boolean }> = [];

  constructor(scene: THREE.Scene) {
    this.positions = new Float32Array(this.maxParticles * 3);
    this.colors = new Float32Array(this.maxParticles * 3);
    this.sizes = new Float32Array(this.maxParticles);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    // Procedural circle particle texture
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.7)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);

    const texture = new THREE.CanvasTexture(canvas);

    this.material = new THREE.PointsMaterial({
      size: 0.4,
      map: texture,
      transparent: true,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.points = new THREE.Points(this.geometry, this.material);
    scene.add(this.points);

    // Initialize particle pool
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push({
        position: new THREE.Vector3(0, -999, 0),
        velocity: new THREE.Vector3(),
        color: new THREE.Color(),
        size: 0.4,
        initialSize: 0.4,
        life: 0,
        maxLife: 1,
        active: false
      });
    }

    // Bullet tracer pool
    this.tracersGroup = new THREE.Group();
    scene.add(this.tracersGroup);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });

    for (let i = 0; i < 40; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const line = new THREE.Line(geo, lineMat);
      line.visible = false;
      this.tracersGroup.add(line);
      this.tracers.push({ line, life: 0, maxLife: 0.08, active: false });
    }
  }

  // Spawn generic particle
  private emit(
    x: number, y: number, z: number,
    vx: number, vy: number, vz: number,
    colorHex: number,
    size: number,
    maxLife: number
  ) {
    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        p.position.set(x, y, z);
        p.velocity.set(vx, vy, vz);
        p.color.setHex(colorHex);
        p.size = size;
        p.initialSize = size;
        p.life = 0;
        p.maxLife = maxLife;
        return;
      }
    }
  }

  // 1. Muzzle Flash burst
  public spawnMuzzleFlash(pos: THREE.Vector3, dir: THREE.Vector3, colorHex: number = 0x38bdf8) {
    for (let i = 0; i < 10; i++) {
      const spread = 0.25;
      const vx = dir.x * 4 + (Math.random() - 0.5) * spread * 4;
      const vy = dir.y * 4 + (Math.random() - 0.5) * spread * 4;
      const vz = dir.z * 4 + (Math.random() - 0.5) * spread * 4;
      this.emit(pos.x, pos.y, pos.z, vx, vy, vz, colorHex, 0.45, 0.08 + Math.random() * 0.06);
    }
  }

  // 2. Wall impact sparks & smoke puff
  public spawnWallImpact(pos: THREE.Vector3, normal: THREE.Vector3 = new THREE.Vector3(0, 1, 0)) {
    // Sparks
    for (let i = 0; i < 16; i++) {
      const vx = normal.x * 3 + (Math.random() - 0.5) * 5;
      const vy = normal.y * 3 + (Math.random() - 0.5) * 5;
      const vz = normal.z * 3 + (Math.random() - 0.5) * 5;
      this.emit(pos.x, pos.y, pos.z, vx, vy, vz, 0xfbbf24, 0.25, 0.2 + Math.random() * 0.25);
    }
    // Smoke
    for (let i = 0; i < 6; i++) {
      const vx = (Math.random() - 0.5) * 1.5;
      const vy = 0.8 + Math.random() * 1.5;
      const vz = (Math.random() - 0.5) * 1.5;
      this.emit(pos.x, pos.y, pos.z, vx, vy, vz, 0x64748b, 0.6, 0.4 + Math.random() * 0.3);
    }
  }

  // 3. Player damage blood / shield sparks
  public spawnHitSparks(pos: THREE.Vector3, isShield: boolean) {
    const colorHex = isShield ? 0x38bdf8 : 0xef4444;
    for (let i = 0; i < 14; i++) {
      const vx = (Math.random() - 0.5) * 5;
      const vy = 1.0 + Math.random() * 4;
      const vz = (Math.random() - 0.5) * 5;
      this.emit(pos.x, pos.y, pos.z, vx, vy, vz, colorHex, 0.3, 0.25 + Math.random() * 0.25);
    }
  }

  // 4. Jetpack thruster smoke & fire particles
  public spawnJetpackParticles(pos: THREE.Vector3) {
    for (let i = 0; i < 4; i++) {
      const vx = (Math.random() - 0.5) * 0.8;
      const vy = -3.5 - Math.random() * 2.0;
      const vz = (Math.random() - 0.5) * 0.8;
      const color = Math.random() > 0.4 ? 0x38bdf8 : 0x0284c7;
      this.emit(pos.x, pos.y, pos.z, vx, vy, vz, color, 0.35, 0.18 + Math.random() * 0.12);
    }
  }

  // 5. Footstep sprint dust puff
  public spawnDustPuff(pos: THREE.Vector3) {
    for (let i = 0; i < 3; i++) {
      const vx = (Math.random() - 0.5) * 0.9;
      const vy = 0.2 + Math.random() * 0.5;
      const vz = (Math.random() - 0.5) * 0.9;
      this.emit(pos.x, pos.y + 0.1, pos.z, vx, vy, vz, 0x94a3b8, 0.25, 0.3);
    }
  }

  // 6. Bullet tracer beam
  public spawnTracer(start: THREE.Vector3, end: THREE.Vector3, weaponType: string = 'ar') {
    for (let i = 0; i < this.tracers.length; i++) {
      const t = this.tracers[i];
      if (!t.active) {
        t.active = true;
        t.life = 0;
        t.maxLife = weaponType === 'sniper' ? 0.18 : 0.08;
        const posAttr = t.line.geometry.getAttribute('position') as THREE.BufferAttribute;
        posAttr.setXYZ(0, start.x, start.y, start.z);
        posAttr.setXYZ(1, end.x, end.y, end.z);
        posAttr.needsUpdate = true;
        t.line.visible = true;
        return;
      }
    }
  }

  // Frame update
  public update(dt: number) {
    let pIdx = 0;
    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (p.active) {
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.active = false;
          p.position.set(0, -999, 0);
        } else {
          // Physics
          p.position.x += p.velocity.x * dt;
          p.position.y += p.velocity.y * dt;
          p.position.z += p.velocity.z * dt;

          // Gravity
          p.velocity.y -= 7.0 * dt;

          // Fade out size
          const progress = p.life / p.maxLife;
          p.size = p.initialSize * (1 - progress);
        }
      }

      this.positions[pIdx * 3] = p.position.x;
      this.positions[pIdx * 3 + 1] = p.position.y;
      this.positions[pIdx * 3 + 2] = p.position.z;

      this.colors[pIdx * 3] = p.color.r;
      this.colors[pIdx * 3 + 1] = p.color.g;
      this.colors[pIdx * 3 + 2] = p.color.b;

      pIdx++;
    }

    (this.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;

    // Update bullet tracers
    for (let i = 0; i < this.tracers.length; i++) {
      const t = this.tracers[i];
      if (t.active) {
        t.life += dt;
        if (t.life >= t.maxLife) {
          t.active = false;
          t.line.visible = false;
        }
      }
    }
  }

  public dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
