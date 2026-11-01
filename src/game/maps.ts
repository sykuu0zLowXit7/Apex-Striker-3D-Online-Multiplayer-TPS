import * as THREE from 'three';
import { MapType } from '../types/game';

export interface BoundingBox2D {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
}

export interface MapEnvironment {
  group: THREE.Group;
  colliders: BoundingBox2D[];
  animatedElements: Array<{ object: THREE.Object3D; baseRotationZ: number; speed: number; phase: number }>;
  skyColor: number;
  fogColor: number;
  fogNear: number;
  fogFar: number;
  keyLightColor: number;
  keyLightIntensity: number;
  fillLightColor: number;
  fillLightIntensity: number;
  spawnPoints: Array<{ x: number; y: number; z: number }>;
  name: string;
}

// Procedural Cobblestone & Sandstone Canvas Texture
function createCobblestoneTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Sandstone/mortar base
  ctx.fillStyle = '#bfa58a';
  ctx.fillRect(0, 0, 512, 512);

  // Cobblestone bricks
  const rows = 16;
  const cols = 12;
  const rh = 512 / rows;
  const cw = 512 / cols;

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (cw / 2);
    for (let c = -1; c < cols + 1; c++) {
      const x = c * cw + offset + (Math.random() - 0.5) * 3;
      const y = r * rh + (Math.random() - 0.5) * 3;
      const w = cw - 5;
      const h = rh - 4;

      // Realistic stone tone variance
      const shade = 145 + Math.floor(Math.random() * 45);
      ctx.fillStyle = `rgb(${shade + 15}, ${shade + 5}, ${shade - 10})`;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 4);
      ctx.fill();

      // Stone highlight & shadow
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  // Scattered sand dust specks
  for (let i = 0; i < 400; i++) {
    const px = Math.random() * 512;
    const py = Math.random() * 512;
    ctx.fillStyle = 'rgba(217, 185, 145, 0.4)';
    ctx.fillRect(px, py, 2 + Math.random() * 4, 2 + Math.random() * 4);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(12, 12);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Procedural Stucco Wall Texture with Iconic CS:GO Red "← B" Graffiti
function createWallWithBGraffitiTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Weathered cream plaster wall
  ctx.fillStyle = '#eae2cf';
  ctx.fillRect(0, 0, 512, 512);

  // Peeling plaster & dirt patches
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.fillStyle = 'rgba(168, 142, 110, 0.25)';
    ctx.beginPath();
    ctx.ellipse(x, y, 20 + Math.random() * 60, 10 + Math.random() * 30, Math.random(), 0, Math.PI * 2);
    ctx.fill();
  }

  // The iconic CS:GO Red Arrow pointing left
  ctx.strokeStyle = '#b91c1c';
  ctx.fillStyle = '#b91c1c';
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Arrow shaft: (340, 120) to (200, 150)
  ctx.beginPath();
  ctx.moveTo(340, 120);
  ctx.lineTo(200, 145);
  ctx.stroke();

  // Arrow head
  ctx.beginPath();
  ctx.moveTo(230, 115);
  ctx.lineTo(190, 145);
  ctx.lineTo(235, 175);
  ctx.stroke();

  // The iconic massive CS:GO "B" stencil spray
  ctx.font = 'bold 150px Arial, Impact, sans-serif';
  ctx.fillStyle = '#991b1b';
  ctx.fillText('B', 220, 310);

  // Spray paint drip marks
  for (let d = 0; d < 4; d++) {
    const dx = 240 + d * 30;
    ctx.beginPath();
    ctx.moveTo(dx, 310);
    ctx.lineTo(dx + (Math.random() - 0.5) * 5, 340 + Math.random() * 25);
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Procedural Dark Wooden Double Door Texture
function createWoodenDoorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Deep aged wood
  ctx.fillStyle = '#3f2512';
  ctx.fillRect(0, 0, 256, 512);

  // Door frame border
  ctx.strokeStyle = '#221307';
  ctx.lineWidth = 12;
  ctx.strokeRect(6, 6, 244, 500);

  // Panels
  ctx.fillStyle = '#543219';
  ctx.lineWidth = 6;
  const panels = [
    { y: 30, h: 100 },
    { y: 150, h: 180 },
    { y: 350, h: 130 }
  ];

  panels.forEach(p => {
    // Left side panel
    ctx.fillRect(25, p.y, 95, p.h);
    ctx.strokeRect(25, p.y, 95, p.h);
    // Right side panel
    ctx.fillRect(135, p.y, 95, p.h);
    ctx.strokeRect(135, p.y, 95, p.h);
  });

  // Black iron knocker
  ctx.fillStyle = '#18181b';
  ctx.beginPath();
  ctx.arc(128, 220, 14, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function buildMap(mapType: MapType): MapEnvironment {
  const group = new THREE.Group();
  const colliders: BoundingBox2D[] = [];
  const animatedElements: Array<{ object: THREE.Object3D; baseRotationZ: number; speed: number; phase: number }> = [];
  const spawnPoints: Array<{ x: number; y: number; z: number }> = [];

  // Helper to add colliders
  function addCollider(minX: number, maxX: number, minZ: number, maxZ: number, height: number = 6) {
    colliders.push({ minX, maxX, minZ, maxZ, height });
  }

  // Common Tactical Materials
  const cobbleTexture = createCobblestoneTexture();
  const cobbleMat = new THREE.MeshStandardMaterial({
    map: cobbleTexture,
    roughness: 0.88,
    metalness: 0.05
  });

  const stuccoMat = new THREE.MeshStandardMaterial({
    color: 0xeadbc8, // Warm beige Mediterranean sandstone
    roughness: 0.92,
    metalness: 0.02
  });

  // Mediterranean Blue corner building stucco (matching the screenshot)
  const blueStuccoMat = new THREE.MeshStandardMaterial({
    color: 0x5b8db8, // Weathered Aegean blue
    roughness: 0.85,
    metalness: 0.05
  });

  const woodDoorMat = new THREE.MeshStandardMaterial({
    map: createWoodenDoorTexture(),
    roughness: 0.7,
    metalness: 0.1
  });

  const bGraffitiMat = new THREE.MeshStandardMaterial({
    map: createWallWithBGraffitiTexture(),
    roughness: 0.9,
    metalness: 0.02
  });

  const ironMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.4,
    metalness: 0.8
  });

  const crateWoodMat = new THREE.MeshStandardMaterial({
    color: 0x854d0e,
    roughness: 0.75,
    metalness: 0.05
  });

  const darkWireMat = new THREE.MeshBasicMaterial({
    color: 0x0f172a
  });

  // 1. FLOOR / COBBLESTONE GROUND
  const floorGeo = new THREE.PlaneGeometry(160, 160);
  const floor = new THREE.Mesh(floorGeo, cobbleMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  // Outer Map Perimeter Boundaries
  addCollider(-40, 40, -42, -39);
  addCollider(-40, 40, 39, 42);
  addCollider(-42, -39, -40, 40);
  addCollider(39, 42, -40, 40);

  // BUILD MAP 1: DE_MIRAGE / DUST II (Matches screenshot 1:1)
  if (mapType === 'de_dust2' || mapType === 'de_mirage' || mapType === 'cyber_city') {
    // --- RIGHT SIDE: Main wall with Red "← B" Graffiti and Wooden Double Door ---
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(2, 8, 28), stuccoMat);
    rightWall.position.set(7, 4, 0);
    rightWall.castShadow = true;
    rightWall.receiveShadow = true;
    group.add(rightWall);
    addCollider(6, 8, -14, 14);

    // Wall decal panel with Red B Graffiti
    const graffitiDecal = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), bGraffitiMat);
    graffitiDecal.position.set(5.98, 3.5, 3.5);
    graffitiDecal.rotation.y = -Math.PI / 2;
    group.add(graffitiDecal);

    // Dark Wooden Double Door mounted on right wall
    const door = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 4.2), woodDoorMat);
    door.position.set(5.98, 2.1, 8.5);
    door.rotation.y = -Math.PI / 2;
    group.add(door);

    // Ornate black iron wall lantern beside door
    const lanternArm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.6), ironMat);
    lanternArm.position.set(5.8, 4.6, 5.5);
    group.add(lanternArm);

    const lanternCage = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.12, 0.45, 6), ironMat);
    lanternCage.position.set(5.7, 4.3, 5.5);
    group.add(lanternCage);

    // --- CENTER CORNER: Mediterranean Blue 2-Story Building ---
    const blueHouse = new THREE.Mesh(new THREE.BoxGeometry(10, 11, 14), blueStuccoMat);
    blueHouse.position.set(-1, 5.5, -16);
    blueHouse.castShadow = true;
    blueHouse.receiveShadow = true;
    group.add(blueHouse);
    addCollider(-6, 4, -23, -9);

    // Blue House wooden window trim & shutters
    const windowShutters = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.8, 1.6), crateWoodMat);
    windowShutters.position.set(4.05, 6.8, -14);
    group.add(windowShutters);

    // Street plaque (green Arabic / street sign on blue corner house)
    const streetSignMat = new THREE.MeshStandardMaterial({ color: 0x15803d });
    const streetSign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.55), streetSignMat);
    streetSign.position.set(4.05, 4.2, -18);
    streetSign.rotation.y = Math.PI / 2;
    group.add(streetSign);

    // --- LEFT SIDE: Sandstone Alley Wall & CT Corridor ---
    const leftAlleyWall = new THREE.Mesh(new THREE.BoxGeometry(2, 5.5, 36), stuccoMat);
    leftAlleyWall.position.set(-7, 2.75, 2);
    leftAlleyWall.castShadow = true;
    leftAlleyWall.receiveShadow = true;
    group.add(leftAlleyWall);
    addCollider(-8, -6, -16, 20);

    // Sandstone stone ledge on left wall
    const wallCap = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.35, 36), stuccoMat);
    wallCap.position.set(-7, 5.6, 2);
    group.add(wallCap);

    // Distant archway leading to Bombsite B
    const archTop = new THREE.Mesh(new THREE.BoxGeometry(14, 3, 2), stuccoMat);
    archTop.position.set(0, 7.5, -24);
    group.add(archTop);

    // --- OVERHEAD POWER CABLES (Iconic CS:GO sky detail) ---
    const cable1 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 14, 6), darkWireMat);
    cable1.position.set(0, 7.8, -8);
    cable1.rotation.z = Math.PI / 2 - 0.2;
    group.add(cable1);

    const cable2 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 16, 6), darkWireMat);
    cable2.position.set(-1, 8.2, 2);
    cable2.rotation.z = Math.PI / 2 + 0.15;
    group.add(cable2);

    // --- TACTICAL COVER: Wooden Crates & Stone Blocks ---
    // Stacked crates at site entrance
    const crate1 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6), crateWoodMat);
    crate1.position.set(3.5, 0.8, -4);
    crate1.castShadow = true;
    crate1.receiveShadow = true;
    group.add(crate1);
    addCollider(2.7, 4.3, -4.8, -3.2, 1.6);

    const crate2 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6), crateWoodMat);
    crate2.position.set(3.5, 2.4, -4);
    crate2.castShadow = true;
    group.add(crate2);

    const crate3 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6), crateWoodMat);
    crate3.position.set(2.0, 0.8, -4);
    crate3.castShadow = true;
    group.add(crate3);
    addCollider(1.2, 2.8, -4.8, -3.2, 1.6);

    // Stone rubble along left wall
    for (let r = 0; r < 5; r++) {
      const stone = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 0.5), stuccoMat);
      stone.position.set(-5.5 + (Math.random() - 0.5) * 0.4, 0.18, -2 + r * 1.5);
      stone.rotation.y = Math.random() * Math.PI;
      group.add(stone);
    }

    // Spawns (CT Alley & T Spawn)
    spawnPoints.push(
      { x: 0, y: 0.5, z: 14 },
      { x: -2, y: 0.5, z: 12 },
      { x: 2, y: 0.5, z: 12 },
      { x: 0, y: 0.5, z: -20 },
      { x: -3, y: 0.5, z: -22 },
      { x: 3, y: 0.5, z: -22 }
    );

    return {
      group,
      colliders,
      animatedElements,
      skyColor: 0x7eb4e6, // Bright sunny Mediterranean sky
      fogColor: 0x93c5fd,
      fogNear: 45,
      fogFar: 180,
      keyLightColor: 0xfffaed, // Radiant primary sunlight
      keyLightIntensity: 2.8,
      fillLightColor: 0x93c5fd, // Ambient blue sky bounce
      fillLightIntensity: 1.2,
      spawnPoints,
      name: 'de_mirage (B-Site Alley)'
    };
  }

  // BUILD MAP 2: DE_INFERNO
  if (mapType === 'de_inferno' || mapType === 'jungle_outpost') {
    const yellowWallMat = new THREE.MeshStandardMaterial({ color: 0xdfa052, roughness: 0.85 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.7 });

    // Italian villa building
    const villa = new THREE.Mesh(new THREE.BoxGeometry(16, 9, 14), yellowWallMat);
    villa.position.set(-10, 4.5, 0);
    villa.castShadow = true;
    villa.receiveShadow = true;
    group.add(villa);
    addCollider(-18, -2, -7, 7);

    // Terracotta roof
    const roof = new THREE.Mesh(new THREE.ConeGeometry(12, 4, 4), roofMat);
    roof.position.set(-10, 11, 0);
    roof.rotation.y = Math.PI / 4;
    group.add(roof);

    // Fountain plaza in center
    const fountainBase = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.8, 0.9, 12), stuccoMat);
    fountainBase.position.set(8, 0.45, 0);
    fountainBase.castShadow = true;
    group.add(fountainBase);
    addCollider(5, 11, -3, 3, 1);

    spawnPoints.push(
      { x: 0, y: 0.5, z: 16 },
      { x: 8, y: 0.5, z: 16 },
      { x: 0, y: 0.5, z: -16 },
      { x: 8, y: 0.5, z: -16 }
    );

    return {
      group,
      colliders,
      animatedElements,
      skyColor: 0x60a5fa,
      fogColor: 0x93c5fd,
      fogNear: 40,
      fogFar: 160,
      keyLightColor: 0xfff7ed,
      keyLightIntensity: 2.6,
      fillLightColor: 0xbfdbfe,
      fillLightIntensity: 1.1,
      spawnPoints,
      name: 'de_inferno'
    };
  }

  // BUILD MAP 3: DE_CACHE / INDUSTRIAL
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9 });
  const containerMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.5, metalness: 0.6 });

  // Warehouse Hangar
  const warehouse = new THREE.Mesh(new THREE.BoxGeometry(22, 10, 18), concreteMat);
  warehouse.position.set(0, 5, -12);
  warehouse.castShadow = true;
  group.add(warehouse);
  addCollider(-11, 11, -21, -3);

  // Shipping container cover
  const container = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 7), containerMat);
  container.position.set(8, 1.5, 6);
  container.castShadow = true;
  group.add(container);
  addCollider(6.5, 9.5, 2.5, 9.5, 3);

  spawnPoints.push(
    { x: -6, y: 0.5, z: 14 },
    { x: 6, y: 0.5, z: 14 },
    { x: -6, y: 0.5, z: -8 },
    { x: 6, y: 0.5, z: -8 }
  );

  return {
    group,
    colliders,
    animatedElements,
    skyColor: 0x94a3b8,
    fogColor: 0xcbd5e1,
    fogNear: 35,
    fogFar: 140,
    keyLightColor: 0xffedd5,
    keyLightIntensity: 2.4,
    fillLightColor: 0xe2e8f0,
    fillLightIntensity: 1.0,
    spawnPoints,
    name: 'de_cache'
  };
}
