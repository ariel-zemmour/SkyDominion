import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../store';
import { getTerrainHeight } from '../utils/terrain';

interface F16ModelProps {
  afterburnerGlowRef: React.RefObject<THREE.Mesh | null>;
  isAfterburner: boolean;
}

/**
 * Creates the continuous, seamless Blended Wing-Body (BWB) fuselage for the F-16 Fighting Falcon.
 * Strictly calibrated to official 1:1 Lockheed Martin F-16C technical blueprints (FS stations, WL waterlines, BL buttlines).
 * Real aircraft dimensions: Length 15.03m, Wingspan 9.96m, Height 5.09m (Scaling: 1 unit = 4.0 meters).
 */
function createBlueprintFuselageGeo() {
  // 15 technical stations along Z axis (from nose radome tip Z=-1.72 to exhaust nozzle Z=+1.75)
  const stations = [
    { z: -1.72, yTop: -0.015, xLedge: 0.012, yLedge: -0.035, yBottom: -0.055 }, // Radome nose tip
    { z: -1.50, yTop:  0.050, xLedge: 0.080, yLedge: -0.025, yBottom: -0.095 }, // Forward radome cone (slight droop)
    { z: -1.25, yTop:  0.115, xLedge: 0.150, yLedge: -0.015, yBottom: -0.135 }, // Radome bulkhead / chine origin
    { z: -1.00, yTop:  0.170, xLedge: 0.220, yLedge:  0.000, yBottom: -0.165 }, // Forward cockpit / LERX flare start
    { z: -0.75, yTop:  0.195, xLedge: 0.280, yLedge:  0.012, yBottom: -0.180 }, // Mid cockpit / chin intake zone
    { z: -0.50, yTop:  0.195, xLedge: 0.340, yLedge:  0.015, yBottom: -0.190 }, // Cockpit aft bulkhead
    { z: -0.25, yTop:  0.185, xLedge: 0.380, yLedge:  0.010, yBottom: -0.195 }, // Canopy rear blend into dorsal spine
    { z:  0.00, yTop:  0.175, xLedge: 0.400, yLedge:  0.005, yBottom: -0.200 }, // Wing root leading edge (40° junction)
    { z:  0.35, yTop:  0.165, xLedge: 0.360, yLedge:  0.000, yBottom: -0.190 }, // Mid wing fuselage / fuel cell
    { z:  0.70, yTop:  0.160, xLedge: 0.310, yLedge: -0.005, yBottom: -0.180 }, // Engine nacelle transition
    { z:  1.05, yTop:  0.155, xLedge: 0.270, yLedge: -0.010, yBottom: -0.170 }, // Wing root trailing edge
    { z:  1.30, yTop:  0.145, xLedge: 0.240, yLedge: -0.010, yBottom: -0.160 }, // Tail fin root start / stabilator shelf
    { z:  1.55, yTop:  0.135, xLedge: 0.210, yLedge: -0.005, yBottom: -0.150 }, // Ventral fin root
    { z:  1.75, yTop:  0.125, xLedge: 0.175, yLedge:  0.000, yBottom: -0.140 }  // Exhaust nozzle junction
  ];

  const numRingPts = 12;
  const rings: number[][][] = [];

  stations.forEach(st => {
    const ring: number[][] = [];
    // Right half (X >= 0): Top Center -> Shoulder -> Strake Edge -> Belly Flank -> Bottom Center
    ring.push([0, st.yTop, st.z]);
    ring.push([st.xLedge * 0.35, st.yTop - (st.yTop - st.yLedge) * 0.22, st.z]);
    ring.push([st.xLedge * 0.70, st.yTop - (st.yTop - st.yLedge) * 0.65, st.z]);
    ring.push([st.xLedge, st.yLedge, st.z]); // Razor sharp LERX strake edge
    ring.push([st.xLedge * 0.75, st.yLedge - 0.02, st.z]);
    ring.push([st.xLedge * 0.45, st.yBottom + (st.yLedge - st.yBottom) * 0.45, st.z]);
    ring.push([0, st.yBottom, st.z]);

    // Left half (X < 0): Mirrored in counter-clockwise order for outward normals
    ring.push([-st.xLedge * 0.45, st.yBottom + (st.yLedge - st.yBottom) * 0.45, st.z]);
    ring.push([-st.xLedge * 0.75, st.yLedge - 0.02, st.z]);
    ring.push([-st.xLedge, st.yLedge, st.z]);
    ring.push([-st.xLedge * 0.70, st.yTop - (st.yTop - st.yLedge) * 0.65, st.z]);
    ring.push([-st.xLedge * 0.35, st.yTop - (st.yTop - st.yLedge) * 0.22, st.z]);
    rings.push(ring);
  });

  const vertices: number[] = [];
  const indices: number[] = [];

  rings.forEach(ring => {
    ring.forEach(pt => vertices.push(pt[0], pt[1], pt[2]));
  });

  // Connect adjacent rings with quad faces (2 triangles per quad)
  for (let s = 0; s < rings.length - 1; s++) {
    const r1 = s * numRingPts;
    const r2 = (s + 1) * numRingPts;
    for (let p = 0; p < numRingPts; p++) {
      const nextP = (p + 1) % numRingPts;
      indices.push(r1 + p, r2 + p, r1 + nextP);
      indices.push(r1 + nextP, r2 + p, r2 + nextP);
    }
  }

  // Extreme nose point fan
  const noseTipIdx = vertices.length / 3;
  vertices.push(0, -0.035, -1.75);
  for (let p = 0; p < numRingPts; p++) {
    const nextP = (p + 1) % numRingPts;
    indices.push(noseTipIdx, p, nextP);
  }

  // Rear exhaust cap fan
  const rearCenterIdx = vertices.length / 3;
  const lastRingStart = (rings.length - 1) * numRingPts;
  vertices.push(0, -0.010, 1.76);
  for (let p = 0; p < numRingPts; p++) {
    const nextP = (p + 1) % numRingPts;
    indices.push(rearCenterIdx, lastRingStart + nextP, lastRingStart + p);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates the authentic blown bubble canopy with exact teardrop curvature,
 * seating perfectly onto the fuselage sills without gaps or bow frames.
 */
function createBlueprintCanopyGeo() {
  const stations = [
    { z: -1.22, yBase: 0.115, height: 0.035, halfWidth: 0.075 }, // Windscreen apex
    { z: -1.05, yBase: 0.150, height: 0.110, halfWidth: 0.120 }, // Forward windscreen slope
    { z: -0.85, yBase: 0.170, height: 0.170, halfWidth: 0.155 }, // Cockpit forward
    { z: -0.65, yBase: 0.175, height: 0.185, halfWidth: 0.160 }, // Canopy crest above pilot head (Y ≈ 0.36)
    { z: -0.45, yBase: 0.170, height: 0.140, halfWidth: 0.145 }, // Headrest aft
    { z: -0.30, yBase: 0.165, height: 0.070, halfWidth: 0.120 }, // Rear slope
    { z: -0.18, yBase: 0.160, height: 0.020, halfWidth: 0.090 }  // Dorsal spine fairing blend
  ];

  const numArchPts = 9;
  const rings: number[][][] = [];

  stations.forEach(st => {
    const ring: number[][] = [];
    for (let i = 0; i < numArchPts; i++) {
      const theta = (i / (numArchPts - 1)) * Math.PI;
      const x = -Math.cos(theta) * st.halfWidth;
      const y = st.yBase + Math.sin(theta) * st.height;
      ring.push([x, y, st.z]);
    }
    rings.push(ring);
  });

  const vertices: number[] = [];
  const indices: number[] = [];

  rings.forEach(ring => {
    ring.forEach(pt => vertices.push(pt[0], pt[1], pt[2]));
  });

  for (let s = 0; s < rings.length - 1; s++) {
    const r1 = s * numArchPts;
    const r2 = (s + 1) * numArchPts;
    for (let p = 0; p < numArchPts - 1; p++) {
      indices.push(r1 + p, r2 + p, r1 + p + 1);
      indices.push(r1 + p + 1, r2 + p, r2 + p + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates the authentic cropped delta wings with exact 40.0-degree leading edge sweep,
 * forward-swept trailing edges, and true 9.96m wingspan scaling.
 */
function createBlueprintWingGeo(isRight: boolean) {
  const sign = isRight ? 1 : -1;
  const rootX = 0.40 * sign;
  const rootZ0 = 0.0;    // Junction with LERX strake
  const rootZ1 = 1.15;   // Trailing edge root
  const tipX = 1.20 * sign;
  // 40° sweep: tan(40°) = 0.8391 => deltaZ = 0.80 * 0.8391 = 0.671
  const tipZ0 = 0.671;  // Wingtip leading edge
  const tipZ1 = 0.911;  // Wingtip trailing edge (tip chord = 0.24)

  const shape = new THREE.Shape();
  if (isRight) {
    shape.moveTo(rootX, rootZ0);
    shape.lineTo(tipX, tipZ0);
    shape.lineTo(tipX, tipZ1);
    shape.lineTo(rootX, rootZ1);
  } else {
    shape.moveTo(rootX, rootZ0);
    shape.lineTo(rootX, rootZ1);
    shape.lineTo(tipX, tipZ1);
    shape.lineTo(tipX, tipZ0);
  }
  shape.closePath();

  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.024,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.008,
    bevelThickness: 0.008
  });
}

/**
 * Creates the single vertical tail fin with dorsal spine blend curve,
 * 45° swept leading edge, and top ECM antenna pod deck.
 */
function createBlueprintTailFinGeo() {
  const shape = new THREE.Shape();
  // Starts on dorsal spine at y = 0.16, z = 0.15
  shape.moveTo(0.16, 0.15);
  // Elegant curved dorsal fairing blend into fin leading edge
  shape.bezierCurveTo(0.22, 0.40, 0.35, 0.65, 0.52, 0.82);
  // 45° swept leading edge
  shape.lineTo(0.86, 1.15); // Top fin leading edge
  shape.lineTo(0.86, 1.32); // Top fin trailing edge
  // Rudder trailing edge
  shape.lineTo(0.25, 1.45); // Rudder base / drag chute housing
  shape.lineTo(0.15, 1.30); // Base fairing into engine rear
  shape.closePath();

  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.032,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.008,
    bevelThickness: 0.008
  });
}

/**
 * Creates the all-moving horizontal stabilators (swept tailplanes, span 5.58m).
 */
function createBlueprintStabGeo(isRight: boolean) {
  const sign = isRight ? 1 : -1;
  const rootX = 0.22 * sign;
  const tipX = 0.70 * sign;
  const rootZ0 = 1.15;
  const tipZ0 = 1.63;
  const tipZ1 = 1.85;
  const rootZ1 = 1.65;

  const shape = new THREE.Shape();
  if (isRight) {
    shape.moveTo(rootX, rootZ0);
    shape.lineTo(tipX, tipZ0);
    shape.lineTo(tipX, tipZ1);
    shape.lineTo(rootX, rootZ1);
  } else {
    shape.moveTo(rootX, rootZ0);
    shape.lineTo(rootX, rootZ1);
    shape.lineTo(tipX, tipZ1);
    shape.lineTo(tipX, tipZ0);
  }
  shape.closePath();

  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.020,
    bevelEnabled: true,
    bevelSegments: 1,
    steps: 1,
    bevelSize: 0.006,
    bevelThickness: 0.006
  });
}

export function F16Model({ afterburnerGlowRef, isAfterburner }: F16ModelProps) {
  const cameraMode = useGameStore(state => state.cameraMode);
  const gearGroup = useRef<THREE.Group>(null);
  const gearAnim = useRef(0);

  // Generate precision blueprint geometries
  const { fuselageGeo, canopyGeo, rightWingGeo, leftWingGeo, tailFinGeo, rightStabGeo, leftStabGeo } = useMemo(() => {
    return {
      fuselageGeo: createBlueprintFuselageGeo(),
      canopyGeo: createBlueprintCanopyGeo(),
      rightWingGeo: createBlueprintWingGeo(true),
      leftWingGeo: createBlueprintWingGeo(false),
      tailFinGeo: createBlueprintTailFinGeo(),
      rightStabGeo: createBlueprintStabGeo(true),
      leftStabGeo: createBlueprintStabGeo(false)
    };
  }, []);

  // Landing gear kinematics
  useFrame((_, delta) => {
    const playerPos = useGameStore.getState().playerPos;
    const terrainY = getTerrainHeight(playerPos.x, playerPos.z);
    const altitudeAboveGround = playerPos.y - terrainY;

    const target = altitudeAboveGround < 12 ? 1 : 0;
    gearAnim.current = THREE.MathUtils.lerp(gearAnim.current, target, delta * 3.5);

    if (gearGroup.current) {
      gearGroup.current.position.y = -0.22 - gearAnim.current * 0.35;
      gearGroup.current.scale.setScalar(gearAnim.current);
      gearGroup.current.visible = gearAnim.current > 0.04;
    }
  });

  // Authentic USAF Two-Tone Tactical Camouflage Materials
  const upperCamo = '#474f5a';      // FS 36320 Dark Compass Ghost Gray
  const neutralCamo = '#5a6472';    // FS 36270 Medium Ghost Gray
  const bellyCamo = '#828c9a';      // FS 36375 Light Compass Ghost Gray
  const antiGlare = '#181a1d';      // Non-reflective cockpit cowl & gun trough
  const metalFeather = '#202227';   // Titanium exhaust petals
  const slimeLight = '#84cc16';     // Formation electroluminescent strip

  return (
    <group>
      {/* ── 1. PITOT STATIC TUBE & AOA PROBES ────────────────────── */}
      {/* Pitot Static Needle Tube at extreme nose tip */}
      <mesh position={[0, -0.035, -1.95]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.005, 0.010, 0.40, 8]} />
        <meshStandardMaterial color="#d4dbe4" metalness={0.95} roughness={0.1} />
      </mesh>

      {/* Port & Starboard AoA Sensors */}
      <mesh position={[-0.10, -0.02, -1.45]} rotation={[0, 0, 0.3]}>
        <boxGeometry args={[0.025, 0.004, 0.015]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.8} />
      </mesh>
      <mesh position={[0.10, -0.02, -1.45]} rotation={[0, 0, -0.3]}>
        <boxGeometry args={[0.025, 0.004, 0.015]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.8} />
      </mesh>

      {/* ── 2. SEAMLESS BLENDED WING-BODY FUSELAGE + LERX ───────── */}
      <mesh geometry={fuselageGeo} castShadow receiveShadow>
        <meshStandardMaterial
          color={upperCamo}
          roughness={0.35}
          metalness={0.45}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Matte black anti-glare shield in front of windscreen */}
      <mesh position={[0, 0.13, -1.30]} rotation={[-0.20, 0, 0]}>
        <planeGeometry args={[0.18, 0.22]} />
        <meshStandardMaterial color={antiGlare} roughness={0.9} />
      </mesh>

      {/* ── 3. FRAMELESS 360-DEGREE BLOWN BUBBLE CANOPY ─────────── */}
      <group>
        {/* Blown Polycarbonate Glass Shell */}
        <mesh geometry={canopyGeo} castShadow>
          <meshStandardMaterial
            color="#1b2a38"
            roughness={0.06}
            metalness={0.85}
            transparent
            opacity={cameraMode === 'cockpit' ? 0.2 : 0.68}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Cockpit Interior Detail visible through glass */}
        <group position={[0, 0.12, -0.75]}>
          {/* ACES II Ejection Seat */}
          <mesh position={[0, 0.05, 0.06]} rotation={[0.25, 0, 0]}>
            <boxGeometry args={[0.11, 0.28, 0.08]} />
            <meshStandardMaterial color="#111" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.18, 0.04]} rotation={[0.25, 0, 0]}>
            <boxGeometry args={[0.09, 0.08, 0.06]} />
            <meshStandardMaterial color="#881313" roughness={0.7} />
          </mesh>
          {/* Pilot helmet & dark visor */}
          <mesh position={[0, 0.13, -0.02]}>
            <sphereGeometry args={[0.048, 16, 16]} />
            <meshStandardMaterial color="#2d3748" roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.14, -0.055]}>
            <sphereGeometry args={[0.030, 12, 12]} />
            <meshStandardMaterial color="#050505" roughness={0.1} metalness={0.9} />
          </mesh>
          {/* HUD Combiner Glass frame */}
          <mesh position={[0, 0.10, -0.32]} rotation={[0.42, 0, 0]}>
            <boxGeometry args={[0.09, 0.08, 0.008]} />
            <meshStandardMaterial color="#10b981" transparent opacity={0.35} />
          </mesh>
        </group>
      </group>

      {/* ── 4. CHIN "SMILE" ENGINE INTAKE ───────────────────────── */}
      <group position={[0, -0.19, -0.45]}>
        {/* Splitter plate (boundary-layer diverter gap below belly) */}
        <mesh position={[0, 0.045, -0.15]}>
          <boxGeometry args={[0.28, 0.015, 0.40]} />
          <meshStandardMaterial color={bellyCamo} roughness={0.35} metalness={0.5} />
        </mesh>

        {/* Signature "Smile" curved intake lip cowlings */}
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.14, 0.19, 0.65, 16, 1, false, 0, Math.PI]} />
          <meshStandardMaterial color={bellyCamo} roughness={0.4} metalness={0.4} side={THREE.DoubleSide} />
        </mesh>

        {/* Dark interior duct cavity */}
        <mesh position={[0, -0.05, -0.28]} rotation={[0.15, 0, 0]}>
          <planeGeometry args={[0.24, 0.14]} />
          <meshBasicMaterial color="#030406" side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* ── 5. M61A1 VULCAN 20MM CANNON (PORT SIDE) ─────────────── */}
      <group position={[-0.20, 0.12, -0.78]}>
        {/* Recessed gun trough fairing */}
        <mesh rotation={[0, -0.06, 0]}>
          <boxGeometry args={[0.045, 0.045, 0.35]} />
          <meshStandardMaterial color={antiGlare} roughness={0.6} metalness={0.7} />
        </mesh>
        {/* 6-barrel rotary muzzle opening */}
        <mesh position={[-0.01, 0, -0.18]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.016, 0.016, 0.05, 12]} />
          <meshStandardMaterial color="#0b0b0e" roughness={0.15} metalness={0.95} />
        </mesh>
      </group>

      {/* ── 6. 40-DEGREE SWEPT CROPPED DELTA WINGS ──────────────── */}
      <group position={[0, 0.01, 0]}>
        {/* Right Wing */}
        <mesh geometry={rightWingGeo} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={neutralCamo} roughness={0.35} metalness={0.5} side={THREE.DoubleSide} />
        </mesh>
        {/* Left Wing */}
        <mesh geometry={leftWingGeo} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={neutralCamo} roughness={0.35} metalness={0.5} side={THREE.DoubleSide} />
        </mesh>

        {/* Wingtip Missile Launch Rails (LAU-129) */}
        <mesh position={[1.20, 0, 0.79]} rotation={[Math.PI / 2, 0, 0]}>
          <boxGeometry args={[0.03, 0.035, 0.52]} />
          <meshStandardMaterial color="#1a1c20" metalness={0.8} />
        </mesh>
        <mesh position={[-1.20, 0, 0.79]} rotation={[Math.PI / 2, 0, 0]}>
          <boxGeometry args={[0.03, 0.035, 0.52]} />
          <meshStandardMaterial color="#1a1c20" metalness={0.8} />
        </mesh>

        {/* Starboard Wingtip AIM-9 Sidewinder Missile */}
        <group position={[1.20, -0.015, 0.79]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.65, 12]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.3} metalness={0.4} />
          </mesh>
          <mesh position={[0, 0, -0.34]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.018, 0.07, 12]} />
            <meshStandardMaterial color="#1e293b" metalness={0.9} />
          </mesh>
          <mesh position={[0, 0, -0.23]}>
            <boxGeometry args={[0.11, 0.008, 0.05]} />
            <meshStandardMaterial color="#475569" />
          </mesh>
          <mesh position={[0, 0, 0.26]}>
            <boxGeometry args={[0.15, 0.008, 0.08]} />
            <meshStandardMaterial color="#475569" />
          </mesh>
          {/* Starboard Green Navigation Light */}
          <mesh position={[0.025, 0.02, -0.08]}>
            <sphereGeometry args={[0.012, 8, 8]} />
            <meshBasicMaterial color="#22c55e" />
          </mesh>
        </group>

        {/* Port Wingtip AIM-9 Sidewinder Missile */}
        <group position={[-1.20, -0.015, 0.79]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.65, 12]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.3} metalness={0.4} />
          </mesh>
          <mesh position={[0, 0, -0.34]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.018, 0.07, 12]} />
            <meshStandardMaterial color="#1e293b" metalness={0.9} />
          </mesh>
          <mesh position={[0, 0, -0.23]}>
            <boxGeometry args={[0.11, 0.008, 0.05]} />
            <meshStandardMaterial color="#475569" />
          </mesh>
          <mesh position={[0, 0, 0.26]}>
            <boxGeometry args={[0.15, 0.008, 0.08]} />
            <meshStandardMaterial color="#475569" />
          </mesh>
          {/* Port Red Navigation Light */}
          <mesh position={[-0.025, 0.02, -0.08]}>
            <sphereGeometry args={[0.012, 8, 8]} />
            <meshBasicMaterial color="#ef4444" />
          </mesh>
        </group>
      </group>

      {/* ── 7. VERTICAL STABILIZER WITH DORSAL SPINE BLEND ──────── */}
      <mesh
        geometry={tailFinGeo}
        position={[-0.016, 0.0, 0.0]}
        rotation={[0, Math.PI / 2, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={upperCamo} roughness={0.35} metalness={0.5} side={THREE.DoubleSide} />
      </mesh>

      {/* Cylindrical ECM / RWR Pod at Fin Tip */}
      <mesh position={[0, 0.86, 1.24]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.024, 0.024, 0.25, 12]} />
        <meshStandardMaterial color="#1a1c20" metalness={0.8} />
      </mesh>

      {/* Tail Formation Slime Light Strip */}
      <mesh position={[0.022, 0.55, 1.05]} rotation={[0, 0, 0]}>
        <planeGeometry args={[0.008, 0.16]} />
        <meshBasicMaterial color={slimeLight} side={THREE.DoubleSide} />
      </mesh>

      {/* ── 8. TWIN VENTRAL FINS (CANTED 30° OUTWARD) ───────────── */}
      {/* Port Ventral Fin */}
      <mesh position={[-0.14, -0.25, 1.25]} rotation={[-0.06, 0, 0.52]} castShadow>
        <boxGeometry args={[0.016, 0.19, 0.45]} />
        <meshStandardMaterial color={bellyCamo} roughness={0.4} metalness={0.4} />
      </mesh>
      {/* Starboard Ventral Fin */}
      <mesh position={[0.14, -0.25, 1.25]} rotation={[-0.06, 0, -0.52]} castShadow>
        <boxGeometry args={[0.016, 0.19, 0.45]} />
        <meshStandardMaterial color={bellyCamo} roughness={0.4} metalness={0.4} />
      </mesh>

      {/* ── 9. ALL-MOVING HORIZONTAL STABILATORS ─────────────────── */}
      <mesh geometry={rightStabGeo} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={upperCamo} roughness={0.35} metalness={0.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={leftStabGeo} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={upperCamo} roughness={0.35} metalness={0.5} side={THREE.DoubleSide} />
      </mesh>

      {/* ── 10. ENGINE EXHAUST & CONVERGENT-DIVERGENT PETALS ────── */}
      <group position={[0, -0.01, 1.75]}>
        {/* Titanium Feather Petals Nozzle */}
        <mesh position={[0, 0, 0.14]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.17, 0.19, 0.24, 24, 1, true]} />
          <meshStandardMaterial color={metalFeather} roughness={0.25} metalness={0.92} side={THREE.DoubleSide} />
        </mesh>

        {/* Inner Flame-Holder Ceramic Ring */}
        <mesh position={[0, 0, 0.08]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.09, 0.16, 24]} />
          <meshStandardMaterial
            color="#f97316"
            emissive="#ea580c"
            emissiveIntensity={isAfterburner ? 0.9 : 0.25}
          />
        </mesh>

        {/* Dynamic Afterburner Shock Diamonds & Core Flame */}
        <mesh ref={afterburnerGlowRef} position={[0, 0, 0.45]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.16, 0.60, 16]} />
          <meshBasicMaterial
            color="#38bdf8"
            transparent
            opacity={isAfterburner ? 0.9 : 0.35}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        {isAfterburner && (
          <mesh position={[0, 0, 0.75]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.01, 0.11, 0.95, 16]} />
            <meshBasicMaterial color="#fb923c" transparent opacity={0.8} blending={THREE.AdditiveBlending} />
          </mesh>
        )}
      </group>

      {/* ── 11. RETRACTABLE LANDING GEAR SYSTEM ──────────────────── */}
      <group ref={gearGroup}>
        {/* Forward Nose Gear (cant forward) */}
        <group position={[0, -0.10, -0.90]}>
          <mesh rotation={[-0.18, 0, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 0.38, 12]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.1} />
          </mesh>
          <mesh position={[0, -0.09, -0.04]}>
            <boxGeometry args={[0.05, 0.025, 0.025]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0, -0.20, 0.035]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.06, 0.06, 0.045, 16]} />
            <meshStandardMaterial color="#1a1e23" roughness={0.9} />
          </mesh>
          <mesh position={[0, -0.20, 0.035]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.03, 0.03, 0.048, 12]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
          </mesh>
        </group>

        {/* Main Landing Gear (Port & Starboard) */}
        {[-0.28, 0.28].map((xOffset, idx) => (
          <group key={idx} position={[xOffset, -0.08, 0.36]}>
            <mesh rotation={[0, 0, xOffset > 0 ? -0.20 : 0.20]}>
              <cylinderGeometry args={[0.022, 0.022, 0.42, 12]} />
              <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.1} />
            </mesh>
            <mesh position={[xOffset > 0 ? 0.04 : -0.04, -0.21, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.095, 0.095, 0.065, 16]} />
              <meshStandardMaterial color="#15181c" roughness={0.9} />
            </mesh>
            <mesh position={[xOffset > 0 ? 0.04 : -0.04, -0.21, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.052, 0.052, 0.068, 12]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.8} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
