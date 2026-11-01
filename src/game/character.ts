import * as THREE from 'three';
import { PlayerNetState } from '../types/game';
import { WEAPONS, SKINS } from './weapons';

export interface ViewmodelRig {
  root: THREE.Group;
  weaponGroup: THREE.Group;
  muzzleMarker: THREE.Object3D;
  rightArm: THREE.Group;
  leftArm: THREE.Group;
  update: (dt: number, isMoving: boolean, isSprinting: boolean, isAiming: boolean, recoilAmount: number, mouseDeltaX: number, mouseDeltaY: number) => void;
  dispose: () => void;
}

export interface CharacterRig {
  root: THREE.Group;
  torso: THREE.Mesh;
  head: THREE.Mesh;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  weaponMesh: THREE.Group;
  nameplateSprite: THREE.Sprite;
  nameplateCanvas: HTMLCanvasElement;
  muzzleMarker: THREE.Object3D;
  updateAnimation: (dt: number, state: PlayerNetState, isLocal: boolean) => void;
  updateNameplate: (name: string, health: number, shield: number, isBot?: boolean) => void;
  dispose: () => void;
}

// -------------------------------------------------------------
// FIRST-PERSON VIEWMODEL RIG (Gloved hands holding weapon CS:GO)
// -------------------------------------------------------------
export function createViewmodelRig(weaponId: string = 'deagle'): ViewmodelRig {
  const root = new THREE.Group();
  // Standard CS:GO viewmodel default placement relative to camera
  root.position.set(0.18, -0.21, -0.38);

  const weaponGroup = new THREE.Group();
  root.add(weaponGroup);

  const muzzleMarker = new THREE.Object3D();
  muzzleMarker.position.set(0, 0.05, -0.42);
  weaponGroup.add(muzzleMarker);

  // Materials for hands & tactical gloves (matching the screenshot)
  const sleeveMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b, // Tactical dark slate / navy fabric
    roughness: 0.9,
    metalness: 0.05
  });

  const gloveMat = new THREE.MeshStandardMaterial({
    color: 0x18181b, // Carbon tactical glove
    roughness: 0.75,
    metalness: 0.2
  });

  const knuckleMat = new THREE.MeshStandardMaterial({
    color: 0x09090b, // Molded hard knuckle protection
    roughness: 0.35,
    metalness: 0.8
  });

  const palmMat = new THREE.MeshStandardMaterial({
    color: 0x334155, // Textured grey grip pad
    roughness: 0.85,
    metalness: 0.1
  });

  // Weapon materials
  const metalGunMat = new THREE.MeshStandardMaterial({
    color: 0x27272a, // Matte black / steel alloy
    roughness: 0.32,
    metalness: 0.88
  });

  const stainlessMat = new THREE.MeshStandardMaterial({
    color: 0xd4d4d8, // Brushed stainless steel slide
    roughness: 0.25,
    metalness: 0.92
  });

  const gripMat = new THREE.MeshStandardMaterial({
    color: 0x111827, // Textured black polymer
    roughness: 0.8,
    metalness: 0.1
  });

  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x78350f, // Reddish mahogany AK-47 furniture
    roughness: 0.55,
    metalness: 0.1
  });

  const greenMat = new THREE.MeshStandardMaterial({
    color: 0x14532d, // Olive drab AWP body
    roughness: 0.6,
    metalness: 0.3
  });

  const sightDotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  // 1. Right Arm & Hand Rig
  const rightArm = new THREE.Group();
  const rightForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.36, 10), sleeveMat);
  rightForearm.position.set(0.06, -0.15, 0.12);
  rightForearm.rotation.set(-0.6, 0.1, -0.4);
  rightArm.add(rightForearm);

  // Right Hand Glove
  const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.06, 0.1), gloveMat);
  rightHand.position.set(0.015, -0.04, 0.03);
  rightArm.add(rightHand);

  // Right Hand Knuckle Plate
  const rightKnuckles = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.02, 0.06), knuckleMat);
  rightKnuckles.position.set(0.015, -0.025, 0.03);
  rightArm.add(rightKnuckles);

  weaponGroup.add(rightArm);

  // 2. Left Arm & Hand Rig (Two-handed tactical grip wrapping under)
  const leftArm = new THREE.Group();
  const leftForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.38, 10), sleeveMat);
  leftForearm.position.set(-0.16, -0.16, 0.14);
  leftForearm.rotation.set(-0.55, -0.2, 0.45);
  leftArm.add(leftForearm);

  const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.06, 0.09), gloveMat);
  leftHand.position.set(-0.02, -0.05, 0.03);
  leftArm.add(leftHand);

  const leftKnuckles = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.02, 0.05), knuckleMat);
  leftKnuckles.position.set(-0.02, -0.035, 0.03);
  leftArm.add(leftKnuckles);

  weaponGroup.add(leftArm);

  // 3. Build Weapon 3D Geometry
  if (weaponId === 'ak47') {
    // AK-47 Model
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.45), metalGunMat);
    receiver.position.set(0, 0, -0.1);
    weaponGroup.add(receiver);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.45, 8), metalGunMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.5);
    weaponGroup.add(barrel);

    const woodHandguard = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.07, 0.22), woodMat);
    woodHandguard.position.set(0, 0.015, -0.35);
    weaponGroup.add(woodHandguard);

    const curvedMag = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.18, 0.1), metalGunMat);
    curvedMag.position.set(0, -0.12, -0.15);
    curvedMag.rotation.x = 0.35;
    weaponGroup.add(curvedMag);

    const woodGrip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.12, 0.06), woodMat);
    woodGrip.position.set(0, -0.08, 0.04);
    woodGrip.rotation.x = -0.3;
    weaponGroup.add(woodGrip);

    muzzleMarker.position.set(0, 0.02, -0.74);

  } else if (weaponId === 'm4a4') {
    // M4A4 Tactical Carbine
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.42), metalGunMat);
    receiver.position.set(0, 0, -0.1);
    weaponGroup.add(receiver);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.42, 8), metalGunMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.015, -0.48);
    weaponGroup.add(barrel);

    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.075, 0.25), gripMat);
    handguard.position.set(0, 0.015, -0.34);
    weaponGroup.add(handguard);

    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.16, 0.08), metalGunMat);
    mag.position.set(0, -0.11, -0.12);
    mag.rotation.x = 0.2;
    weaponGroup.add(mag);

    const carryHandle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.05, 0.18), metalGunMat);
    carryHandle.position.set(0, 0.065, -0.08);
    weaponGroup.add(carryHandle);

    muzzleMarker.position.set(0, 0.015, -0.7);

  } else if (weaponId === 'awp') {
    // AWP Magnum Sniper
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.65), greenMat);
    body.position.set(0, 0, -0.2);
    weaponGroup.add(body);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 8), metalGunMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.03, -0.78);
    weaponGroup.add(barrel);

    const muzzleBrake = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.12), metalGunMat);
    muzzleBrake.position.set(0, 0.03, -1.1);
    weaponGroup.add(muzzleBrake);

    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.32, 12), metalGunMat);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.09, -0.22);
    weaponGroup.add(scope);

    muzzleMarker.position.set(0, 0.03, -1.18);

  } else {
    // --- DESERT EAGLE .50 ACTION EXPRESS (Faithfully replicates screenshot) ---
    // 1. Lower Frame & Grip
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.13, 0.065), gripMat);
    grip.position.set(0, -0.065, 0.035);
    grip.rotation.x = -0.25; // Ergonomic backward tilt
    weaponGroup.add(grip);

    // Grip textured side panels
    const leftPanel = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.11, 0.05), palmMat);
    leftPanel.position.set(-0.026, -0.065, 0.035);
    leftPanel.rotation.x = -0.25;
    weaponGroup.add(leftPanel);

    const rightPanel = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.11, 0.05), palmMat);
    rightPanel.position.set(0.026, -0.065, 0.035);
    rightPanel.rotation.x = -0.25;
    weaponGroup.add(rightPanel);

    // Trigger guard
    const triggerGuard = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.045, 0.06), metalGunMat);
    triggerGuard.position.set(0, -0.03, -0.025);
    weaponGroup.add(triggerGuard);

    // Trigger
    const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.025, 0.015), stainlessMat);
    trigger.position.set(0, -0.025, -0.02);
    trigger.rotation.x = 0.2;
    weaponGroup.add(trigger);

    // 2. Heavy Polygonal Slide (Beveled Stainless Steel / Chrome as in CS:GO)
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.06, 0.26), stainlessMat);
    slide.position.set(0, 0.015, -0.08);
    weaponGroup.add(slide);

    // Top Barrel with Picatinny rib slots
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.055, 0.12), metalGunMat);
    barrel.position.set(0, 0.015, -0.24);
    weaponGroup.add(barrel);

    // Front bore muzzle
    const bore = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.04, 10), metalGunMat);
    bore.rotation.x = Math.PI / 2;
    bore.position.set(0, 0.015, -0.31);
    weaponGroup.add(bore);

    // Hammer (Cocked back in single action)
    const hammer = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.03, 0.025), stainlessMat);
    hammer.position.set(0, 0.02, 0.055);
    hammer.rotation.x = -0.45;
    weaponGroup.add(hammer);

    // Rear notch sight (with 2 white dots)
    const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.018, 0.02), metalGunMat);
    rearSight.position.set(0, 0.05, 0.04);
    weaponGroup.add(rearSight);

    const rearDotLeft = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.006, 0.002), sightDotMat);
    rearDotLeft.position.set(-0.014, 0.052, 0.051);
    weaponGroup.add(rearDotLeft);

    const rearDotRight = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.006, 0.002), sightDotMat);
    rearDotRight.position.set(0.014, 0.052, 0.051);
    weaponGroup.add(rearDotRight);

    // Front blade sight (with 1 white dot)
    const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.02, 0.025), metalGunMat);
    frontSight.position.set(0, 0.05, -0.28);
    weaponGroup.add(frontSight);

    const frontDot = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.006, 0.002), sightDotMat);
    frontDot.position.set(0, 0.052, -0.267);
    weaponGroup.add(frontDot);

    muzzleMarker.position.set(0, 0.015, -0.33);
  }

  // Animation cycle variables
  let walkCycle = 0;
  let swayX = 0;
  let swayY = 0;

  function update(dt: number, isMoving: boolean, isSprinting: boolean, isAiming: boolean, recoilAmount: number, mouseDeltaX: number, mouseDeltaY: number) {
    // 1. Mouse lag & angular sway
    const targetSwayX = -mouseDeltaX * 0.0004;
    const targetSwayY = mouseDeltaY * 0.0004;
    swayX = THREE.MathUtils.damp(swayX, targetSwayX, 10, dt);
    swayY = THREE.MathUtils.damp(swayY, targetSwayY, 10, dt);

    // 2. Walking & Sprinting Bobbing
    const bobFreq = isSprinting ? 12 : 7.5;
    if (isMoving) {
      walkCycle += dt * bobFreq;
    } else {
      // Gentle breathing idle
      walkCycle += dt * 1.5;
    }

    const bobX = Math.sin(walkCycle) * (isMoving ? (isSprinting ? 0.012 : 0.005) : 0.0008);
    const bobY = Math.abs(Math.cos(walkCycle)) * (isMoving ? (isSprinting ? 0.014 : 0.006) : 0.0012);

    // 3. Aim Down Sights (ADS) Alignment
    const defaultX = 0.17;
    const defaultY = -0.21;
    const defaultZ = -0.38;

    const targetX = isAiming ? 0.0 : defaultX + bobX + swayX;
    const targetY = isAiming ? -0.15 : defaultY - bobY + swayY;
    const targetZ = isAiming ? -0.32 : defaultZ;

    root.position.x = THREE.MathUtils.damp(root.position.x, targetX, 16, dt);
    root.position.y = THREE.MathUtils.damp(root.position.y, targetY, 16, dt);
    root.position.z = THREE.MathUtils.damp(root.position.z, targetZ, 16, dt);

    // 4. Recoil snap & recovery
    const recoilRotX = recoilAmount * 2.2;
    const recoilPosZ = recoilAmount * 0.12;

    weaponGroup.rotation.x = recoilRotX;
    weaponGroup.position.z = recoilPosZ;
  }

  function dispose() {
    root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
  }

  return {
    root,
    weaponGroup,
    muzzleMarker,
    rightArm,
    leftArm,
    update,
    dispose
  };
}

// -------------------------------------------------------------
// THIRD-PERSON CS:GO OPERATOR (Remote players & Bots)
// -------------------------------------------------------------
export function createCharacter(initialState: Partial<PlayerNetState> = {}, isLocalPlayer: boolean = false): CharacterRig {
  const root = new THREE.Group();
  root.position.set(initialState.x || 0, initialState.y || 0, initialState.z || 0);

  const isCT = initialState.team !== 'T'; // Default CT (Counter-Terrorist)

  // Authentic Military Tactical Materials
  const uniformMat = new THREE.MeshStandardMaterial({
    color: isCT ? 0x1e293b : 0x78716c, // Navy CT vs Olive/Tan T
    roughness: 0.85,
    metalness: 0.1
  });

  const vestMat = new THREE.MeshStandardMaterial({
    color: isCT ? 0x0f172a : 0x44403c, // Dark Kevlar plate carrier
    roughness: 0.9,
    metalness: 0.2
  });

  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xd4a373, // Facial skin tone under balaclava
    roughness: 0.7,
    metalness: 0.05
  });

  const helmetMat = new THREE.MeshStandardMaterial({
    color: isCT ? 0x020617 : 0x292524, // Ballistic helmet / mask
    roughness: 0.5,
    metalness: 0.5
  });

  const bootMat = new THREE.MeshStandardMaterial({
    color: 0x09090b,
    roughness: 0.4,
    metalness: 0.3
  });

  const gunMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.3,
    metalness: 0.9
  });

  // 1. Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.35), uniformMat);
  torso.position.y = 0.95;
  torso.castShadow = true;
  torso.receiveShadow = true;
  root.add(torso);

  // Kevlar tactical vest plate
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.6, 0.38), vestMat);
  vest.position.set(0, 0.05, 0);
  torso.add(vest);

  // 2. Head & Helmet / Balaclava
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.38, 0.36), helmetMat);
  head.position.set(0, 0.58, 0);
  head.castShadow = true;
  torso.add(head);

  // Face slit for eyes
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.08), skinMat);
  visor.position.set(0, 0.02, 0.16);
  head.add(visor);

  // 3. Arms
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.35, 0.25, 0);
  const leftArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.65, 0.18), uniformMat);
  leftArmMesh.position.y = -0.28;
  leftArm.add(leftArmMesh);
  torso.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.35, 0.25, 0);
  const rightArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.65, 0.18), uniformMat);
  rightArmMesh.position.y = -0.28;
  rightArm.add(rightArmMesh);
  torso.add(rightArm);

  // 4. Weapon attached to hands
  const weaponMesh = new THREE.Group();
  const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.55), gunMat);
  gunBody.position.set(0, 0, -0.25);
  weaponMesh.add(gunBody);

  const muzzleMarker = new THREE.Object3D();
  muzzleMarker.position.set(0, 0.03, -0.55);
  weaponMesh.add(muzzleMarker);

  weaponMesh.position.set(0.2, -0.2, 0.2);
  torso.add(weaponMesh);

  // 5. Legs
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.16, 0.6, 0);
  const leftLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.65, 0.22), uniformMat);
  leftLegMesh.position.y = -0.32;
  leftLeg.add(leftLegMesh);

  const leftBoot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.15, 0.3), bootMat);
  leftBoot.position.set(0, -0.6, 0.04);
  leftLeg.add(leftBoot);
  root.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.16, 0.6, 0);
  const rightLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.65, 0.22), uniformMat);
  rightLegMesh.position.y = -0.32;
  rightLeg.add(rightLegMesh);

  const rightBoot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.15, 0.3), bootMat);
  rightBoot.position.set(0, -0.6, 0.04);
  rightLeg.add(rightBoot);
  root.add(rightLeg);

  // 6. Nameplate Canvas & Billboard Sprite
  const nameplateCanvas = document.createElement('canvas');
  nameplateCanvas.width = 256;
  nameplateCanvas.height = 64;
  const nameplateTexture = new THREE.CanvasTexture(nameplateCanvas);
  nameplateTexture.minFilter = THREE.LinearFilter;

  const spriteMat = new THREE.SpriteMaterial({ map: nameplateTexture, depthTest: false });
  const nameplateSprite = new THREE.Sprite(spriteMat);
  nameplateSprite.position.set(0, 2.1, 0);
  nameplateSprite.scale.set(1.4, 0.35, 1);
  root.add(nameplateSprite);

  function updateNameplate(name: string, health: number, shield: number, isBot: boolean = false) {
    const ctx = nameplateCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, 256, 64);

    // Background pill
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.beginPath();
    ctx.roundRect(8, 8, 240, 48, 8);
    ctx.fill();

    // Name text
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.fillStyle = isBot ? '#f59e0b' : '#38bdf8';
    ctx.textAlign = 'center';
    ctx.fillText(`${isBot ? '[BOT] ' : ''}${name}`, 128, 30);

    // Health bar
    const barW = 190;
    const barH = 7;
    const x = (256 - barW) / 2;
    const y = 38;

    ctx.fillStyle = '#334155';
    ctx.fillRect(x, y, barW, barH);

    const hpPercent = Math.max(0, Math.min(1, health / 100));
    ctx.fillStyle = hpPercent > 0.5 ? '#10b981' : hpPercent > 0.25 ? '#f59e0b' : '#ef4444';
    ctx.fillRect(x, y, barW * hpPercent, barH);

    nameplateTexture.needsUpdate = true;
  }

  // Animation Update
  let runTime = 0;
  function updateAnimation(dt: number, state: PlayerNetState, isLocal: boolean) {
    const isMoving = Math.hypot(state.vx, state.vz) > 0.4;
    const speed = state.isSprinting ? 12 : 7;

    if (isMoving) {
      runTime += dt * speed;
      const legAngle = Math.sin(runTime) * 0.65;
      leftLeg.rotation.x = legAngle;
      rightLeg.rotation.x = -legAngle;

      leftArm.rotation.x = -legAngle * 0.7;
      rightArm.rotation.x = legAngle * 0.7;
    } else {
      leftLeg.rotation.x = THREE.MathUtils.damp(leftLeg.rotation.x, 0, 10, dt);
      rightLeg.rotation.x = THREE.MathUtils.damp(rightLeg.rotation.x, 0, 10, dt);
      leftArm.rotation.x = THREE.MathUtils.damp(leftArm.rotation.x, -0.3, 10, dt);
      rightArm.rotation.x = THREE.MathUtils.damp(rightArm.rotation.x, -0.5, 10, dt);
    }

    // Aim pitch
    torso.rotation.x = -state.pitch * 0.5;
  }

  function dispose() {
    nameplateTexture.dispose();
    spriteMat.dispose();
    root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
  }

  updateNameplate(initialState.name || 'Operador', initialState.health || 100, initialState.shield || 100, initialState.isBot);

  return {
    root,
    torso,
    head,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    weaponMesh,
    nameplateSprite,
    nameplateCanvas,
    muzzleMarker,
    updateAnimation,
    updateNameplate,
    dispose
  };
}
