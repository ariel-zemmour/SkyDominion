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
 * Derived from official Lockheed Martin F-16 3-view blueprints and aerodynamic station waterlines.
 */
function createBlendedFuselageGeo() {
  // Longitudinal cross-section stations along Z (from nose tip to engine exhaust)
  const stations = [
    { z: -2.80, yTop: -0.01, xLedge: 0.015, yLedge: -0.035, yBottom: -0.055 }, // Pitot base / Radome tip
    { z: -2.45, yTop:  0.07, xLedge: 0.11,  yLedge: -0.025, yBottom: -0.125 }, // Forward Radome
    { z: -2.05, yTop:  0.17, xLedge: 0.22,  yLedge: -0.015, yBottom: -0.190 }, // Radome bulkhead / Chine start
    { z: -1.65, yTop:  0.25, xLedge: 0.36,  yLedge:  0.005, yBottom: -0.235 }, // Cockpit forward / LERX flare
    { z: -1.25, yTop:  0.29, xLedge: 0.58,  yLedge:  0.020, yBottom: -0.260 }, // Cockpit mid / Canopy apex
    { z: -0.85, yTop:  0.29, xLedge: 0.84,  yLedge:  0.025, yBottom: -0.280 }, // Cockpit aft / Chin intake zone
    { z: -0.45, yTop:  0.27, xLedge: 1.04,  yLedge:  0.020, yBottom: -0.295 }, // Canopy aft blend / LERX wide
    { z:  0.00, yTop:  0.26, xLedge: 1.15,  yLedge:  0.010, yBottom: -0.315 }, // Wing root leading edge (40° junction)
    { z:  0.50, yTop:  0.25, xLedge: 0.86,  yLedge:  0.000, yBottom: -0.300 }, // Mid wing body / fuel cells
    { z:  1.00, yTop:  0.24, xLedge: 0.62,  yLedge: -0.010, yBottom: -0.280 }, // Aft fuselage / engine casing
    { z:  1.45, yTop:  0.22, xLedge: 0.49,  yLedge: -0.015, yBottom: -0.260 }, // Wing root trailing edge
    { z:  1.80, yTop:  0.20, xLedge: 0.42,  yLedge: -0.015, yBottom: -0.245 }, // Tail base / stabilator shelf
    { z:  2.15, yTop:  0.18, xLedge: 0.28,  yLedge:  0.000, yBottom: -0.215 }  // Exhaust nozzle junction
  ];

  const numRingPts = 12;
  const rings: number[][][] = [];

  stations.forEach(st => {
    const ring: number[][] = [];
    // Right half (X >= 0): Top Center -> Shoulder -> Strake Edge -> Belly Flank -> Bottom Center
    ring.push([0, st.yTop, st.z]); // 0: Top center (spine)
    ring.push([st.xLedge * 0.35, st.yTop - (st.yTop - st.yLedge) * 0.22, st.z]); // 1: Upper shoulder
    ring.push([st.xLedge * 0.70, st.yTop - (st.yTop - st.yLedge) * 0.65, st.z]); // 2: Strake inner ramp
    ring.push([st.xLedge, st.yLedge, st.z]); // 3: Razor-sharp LERX knife edge
    ring.push([st.xLedge * 0.75, st.yLedge - 0.025, st.z]); // 4: Strake lower contour
    ring.push([st.xLedge * 0.45, st.yBottom + (st.yLedge - st.yBottom) * 0.45, st.z]); // 5: Belly flank
    ring.push([0, st.yBottom, st.z]); // 6: Bottom center (belly)

    // Left half (X < 0): Mirrored in counter-clockwise order for outward normals
    ring.push([-st.xLedge * 0.45, st.yBottom + (st.yLedge - st.yBottom) * 0.45, st.z]); // 7
    ring.push([-st.xLedge * 0.75, st.yLedge - 0.025, st.z]); // 8
    ring.push([-st.xLedge, st.yLedge, st.z]); // 9
    ring.push([-st.xLedge * 0.70, st.yTop - (st.yTop - st.yLedge) * 0.65, st.z]); // 10
    ring.push([-st.xLedge * 0.35, st.yTop - (st.yTop - st.yLedge) * 0.22, st.z]); // 11
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
      const i0 = r1 + p;
      const i1 = r1 + nextP;
      const i2 = r2 + p;
      const i3 = r2 + nextP;

      indices.push(i0, i2, i1);
      indices.push(i1, i2, i3);
    }
  }

  // Extreme nose tip vertex fan
  const noseTipIdx = vertices.length / 3;
  vertices.push(0, -0.035, -2.90);
  for (let p = 0; p < numRingPts; p++) {
    const nextP = (p + 1) % numRingPts;
    indices.push(noseTipIdx, p, nextP);
  }

  // Rear exhaust ring cap
  const rearCenterIdx = vertices.length / 3;
  const lastRingStart = (rings.length - 1) * numRingPts;
  vertices.push(0, -0.015, 2.18);
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
 * Creates the authentic, frameless 360-degree blown bubble canopy for the F-16.
 * Contoured to match the cockpit sill lines without seams or gaps.
 */
function createCanopyBubbleGeo() {
  const stations = [
    { z: -1.98, yBase: 0.17, height: 0.04, halfWidth: 0.11 }, // Windscreen forward apex
    { z: -1.78, yBase: 0.22, height: 0.15, halfWidth: 0.18 }, // Forward arc
    { z: -1.50, yBase: 0.25, height: 0.23, halfWidth: 0.23 }, // Mid forward
    { z: -1.22, yBase: 0.26, height: 0.27, halfWidth: 0.25 }, // Canopy crest above pilot head (Y ≈ 0.53)
    { z: -0.95, yBase: 0.26, height: 0.25, halfWidth: 0.24 }, // Aft of headrest
    { z: -0.68, yBase: 0.25, height: 0.18, halfWidth: 0.21 }, // Rear slope
    { z: -0.42, yBase: 0.24, height: 0.08, halfWidth: 0.16 }, // Dorsal spine transition
    { z: -0.28, yBase: 0.23, height: 0.02, halfWidth: 0.12 }  // Fairing blend into spine
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
      const i0 = r1 + p;
      const i1 = r1 + p + 1;
      const i2 = r2 + p;
      const i3 = r2 + p + 1;

      indices.push(i0, i2, i1);
      indices.push(i1, i2, i3);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates the cropped delta wing with an exact 40-degree leading edge sweep angle,
 * thin supersonic airfoil section, and forward-swept trailing edge.
 */
function createF16WingGeo(isRight: boolean) {
  const sign = isRight ? 1 : -1;
  const rootX = 1.15 * sign;
  const rootZ0 = 0.0;     // Junction with LERX
  const rootZ1 = 1.75;    // Trailing edge root
  const tipX = 2.85 * sign;
  // 40° sweep: tan(40°) = 0.8391 => deltaZ = 1.70 * 0.8391 = 1.4265
  const tipZ0 = 1.4265;   // Wingtip leading edge
  const tipZ1 = 1.9065;   // Wingtip trailing edge (tip chord = 0.48)

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
    depth: 0.032,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.012,
    bevelThickness: 0.012
  });
}

/**
 * Creates the single vertical stabilizer with the signature curved dorsal fairing blend,
 * swept leading edge, and top ECM antenna pod deck.
 */
function createVerticalTailGeo() {
  const shape = new THREE.Shape();
  // Starts on dorsal spine at y = 0.24, z = 0.20
  shape.moveTo(0.24, 0.20);
  // Elegant dorsal spine fairing curve
  shape.bezierCurveTo(0.32, 0.60, 0.50, 1.00, 0.75, 1.25);
  // 45° swept leading edge
  shape.lineTo(1.85, 1.70); // Top fin leading edge
  // Top fin deck (ECM fairing base)
  shape.lineTo(1.85, 1.95); // Top fin trailing edge
  // Rudder trailing edge
  shape.lineTo(0.40, 2.10); // Base of rudder / drag chute housing
  // Aft fairing into rear fuselage
  shape.lineTo(0.22, 1.90);
  shape.closePath();

  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.045,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.012,
    bevelThickness: 0.012
  });
}

/**
 * Creates all-moving horizontal stabilators (swept cropped delta tailplanes).
 */
function createStabilatorGeo(isRight: boolean) {
  const sign = isRight ? 1 : -1;
  const rootX = 0.45 * sign;
  const tipX = 1.45 * sign;
  const rootZ0 = 1.60;
  const tipZ0 = 2.60;
  const tipZ1 = 2.95;
  const rootZ1 = 2.45;

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
    depth: 0.026,
    bevelEnabled: true,
    bevelSegments: 1,
    steps: 1,
    bevelSize: 0.008,
    bevelThickness: 0.008
  });
}

export function F16Model({ afterburnerGlowRef, isAfterburner }: F16ModelProps) {
  const cameraMode = useGameStore(state => state.cameraMode);
  const gearGroup = useRef<THREE.Group>(null);
  const gearAnim = useRef(0);

  // Generate precision geometries once
  const { fuselageGeo, canopyGeo, rightWingGeo, leftWingGeo, tailFinGeo, rightStabGeo, leftStabGeo } = useMemo(() => {
    return {
      fuselageGeo: createBlendedFuselageGeo(),
      canopyGeo: createCanopyBubbleGeo(),
      rightWingGeo: createF16WingGeo(true),
      leftWingGeo: createF16WingGeo(false),
      tailFinGeo: createVerticalTailGeo(),
      rightStabGeo: createStabilatorGeo(true),
      leftStabGeo: createStabilatorGeo(false)
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
      gearGroup.current.position.y = -0.32 - gearAnim.current * 0.48;
      gearGroup.current.scale.setScalar(gearAnim.current);
      gearGroup.current.visible = gearAnim.current > 0.04;
    }
  });

  // Authentic USAF Two-Tone Camouflage PBR Materials
  const upperCamo = '#49525e';      // Dark Compass Ghost Gray (FS 36320)
  const neutralCamo = '#5d6776';    // Medium Ghost Gray
  const bellyCamo = '#87919f';      // Light Compass Ghost Gray (FS 36375)
  const radomeColor = '#30343a';    // Matte Dark Tactical Radome
  const antiGlare = '#181a1d';      // Non-reflective cockpit cowl & gun trough
  const metalFeather = '#22252a';   // Titanium & Inconel exhaust petals
  const slimeLight = '#84cc16';     // Electroluminescent formation strips

  return (
    <group>
      {/* ── 1. PITOT STATIC TUBE & AOA PROBES ────────────────────── */}
      {/* Stainless steel needle pitot tube at radome tip */}
      <mesh position={[0, -0.035, -3.05]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.007, 0.014, 0.45, 8]} />
        <meshStandardMaterial color="#d4dbe4" metalness={0.95} roughness={0.1} />
      </mesh>

      {/* Port & Starboard Angle-of-Attack (AoA) Vanes */}
      <mesh position={[-0.14, -0.02, -2.4]} rotation={[0, 0, 0.3]}>
        <boxGeometry args={[0.04, 0.005, 0.02]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.8} />
      </mesh>
      <mesh position={[0.14, -0.02, -2.4]} rotation={[0, 0, -0.3]}>
        <boxGeometry args={[0.04, 0.005, 0.02]} />
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
      <mesh position={[0, 0.20, -1.82]} rotation={[-0.22, 0, 0]}>
        <planeGeometry args={[0.26, 0.38]} />
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
        <group position={[0, 0.15, -1.25]}>
          {/* ACES II Ejection Seat backrest & headrest */}
          <mesh position={[0, 0.06, 0.08]} rotation={[0.25, 0, 0]}>
            <boxGeometry args={[0.16, 0.38, 0.1]} />
            <meshStandardMaterial color="#111" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.24, 0.06]} rotation={[0.25, 0, 0]}>
            <boxGeometry args={[0.13, 0.11, 0.08]} />
            <meshStandardMaterial color="#881313" roughness={0.7} />
          </mesh>
          {/* Pilot helmet & dark visor */}
          <mesh position={[0, 0.18, -0.02]}>
            <sphereGeometry args={[0.065, 16, 16]} />
            <meshStandardMaterial color="#2d3748" roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.19, -0.07]}>
            <sphereGeometry args={[0.042, 12, 12]} />
            <meshStandardMaterial color="#050505" roughness={0.1} metalness={0.9} />
          </mesh>
          {/* HUD Glass combiner bracket */}
          <mesh position={[0, 0.14, -0.44]} rotation={[0.42, 0, 0]}>
            <boxGeometry args={[0.13, 0.11, 0.01]} />
            <meshStandardMaterial color="#10b981" transparent opacity={0.35} />
          </mesh>
        </group>
      </group>

      {/* ── 4. CHIN "SMILE" ENGINE INTAKE ───────────────────────── */}
      <group position={[0, -0.26, -0.65]}>
        {/* Splitter plate (boundary-layer diverter gap below belly) */}
        <mesh position={[0, 0.06, -0.2]}>
          <boxGeometry args={[0.48, 0.02, 0.55]} />
          <meshStandardMaterial color={bellyCamo} roughness={0.35} metalness={0.5} />
        </mesh>

        {/* Signature "Smile" curved intake lip cowlings */}
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.25, 0.31, 0.90, 16, 1, false, 0, Math.PI]} />
          <meshStandardMaterial color={bellyCamo} roughness={0.4} metalness={0.4} side={THREE.DoubleSide} />
        </mesh>

        {/* Dark interior duct cavity */}
        <mesh position={[0, -0.08, -0.38]} rotation={[0.15, 0, 0]}>
          <planeGeometry args={[0.40, 0.22]} />
          <meshBasicMaterial color="#030406" side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* ── 5. M61A1 VULCAN 20MM CANNON (PORT SIDE) ─────────────── */}
      <group position={[-0.32, 0.14, -1.02]}>
        {/* Recessed gun trough fairing */}
        <mesh rotation={[0, -0.06, 0]}>
          <boxGeometry args={[0.065, 0.06, 0.50]} />
          <meshStandardMaterial color={antiGlare} roughness={0.6} metalness={0.7} />
        </mesh>
        {/* 6-barrel rotary muzzle opening */}
        <mesh position={[-0.01, 0, -0.26]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.022, 0.022, 0.07, 12]} />
          <meshStandardMaterial color="#0b0b0e" roughness={0.15} metalness={0.95} />
        </mesh>
      </group>

      {/* ── 6. 40-DEGREE SWEPT CROPPED DELTA WINGS ──────────────── */}
      <group position={[0, 0.015, 0]}>
        {/* Right Wing */}
        <mesh geometry={rightWingGeo} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={neutralCamo} roughness={0.35} metalness={0.5} side={THREE.DoubleSide} />
        </mesh>
        {/* Left Wing */}
        <mesh geometry={leftWingGeo} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={neutralCamo} roughness={0.35} metalness={0.5} side={THREE.DoubleSide} />
        </mesh>

        {/* Wingtip Missile Launch Rails (LAU-129) */}
        <mesh position={[2.85, 0, 1.67]} rotation={[Math.PI / 2, 0, 0]}>
          <boxGeometry args={[0.04, 0.05, 0.72]} />
          <meshStandardMaterial color="#1a1c20" metalness={0.8} />
        </mesh>
        <mesh position={[-2.85, 0, 1.67]} rotation={[Math.PI / 2, 0, 0]}>
          <boxGeometry args={[0.04, 0.05, 0.72]} />
          <meshStandardMaterial color="#1a1c20" metalness={0.8} />
        </mesh>

        {/* Starboard Wingtip AIM-9 Sidewinder / AIM-120 Missile */}
        <group position={[2.85, -0.02, 1.67]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.024, 0.024, 0.88, 12]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.3} metalness={0.4} />
          </mesh>
          <mesh position={[0, 0, -0.46]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.024, 0.09, 12]} />
            <meshStandardMaterial color="#1e293b" metalness={0.9} />
          </mesh>
          <mesh position={[0, 0, -0.32]}>
            <boxGeometry args={[0.15, 0.01, 0.07]} />
            <meshStandardMaterial color="#475569" />
          </mesh>
          <mesh position={[0, 0, 0.36]}>
            <boxGeometry args={[0.22, 0.01, 0.12]} />
            <meshStandardMaterial color="#475569" />
          </mesh>
          {/* Starboard Green Navigation Light */}
          <mesh position={[0.04, 0.03, -0.1]}>
            <sphereGeometry args={[0.015, 8, 8]} />
            <meshBasicMaterial color="#22c55e" />
          </mesh>
        </group>

        {/* Port Wingtip AIM-9 Sidewinder / AIM-120 Missile */}
        <group position={[-2.85, -0.02, 1.67]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.024, 0.024, 0.88, 12]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.3} metalness={0.4} />
          </mesh>
          <mesh position={[0, 0, -0.46]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.024, 0.09, 12]} />
            <meshStandardMaterial color="#1e293b" metalness={0.9} />
          </mesh>
          <mesh position={[0, 0, -0.32]}>
            <boxGeometry args={[0.15, 0.01, 0.07]} />
            <meshStandardMaterial color="#475569" />
          </mesh>
          <mesh position={[0, 0, 0.36]}>
            <boxGeometry args={[0.22, 0.01, 0.12]} />
            <meshStandardMaterial color="#475569" />
          </mesh>
          {/* Port Red Navigation Light */}
          <mesh position={[-0.04, 0.03, -0.1]}>
            <sphereGeometry args={[0.015, 8, 8]} />
            <meshBasicMaterial color="#ef4444" />
          </mesh>
        </group>
      </group>

      {/* ── 7. VERTICAL STABILIZER WITH DORSAL SPINE BLEND ──────── */}
      <mesh
        geometry={tailFinGeo}
        position={[-0.022, 0.0, 0.0]}
        rotation={[0, Math.PI / 2, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={upperCamo} roughness={0.35} metalness={0.5} side={THREE.DoubleSide} />
      </mesh>

      {/* Cylindrical ECM / RWR Pod at Fin Tip */}
      <mesh position={[0, 1.85, 1.76]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.032, 0.032, 0.36, 12]} />
        <meshStandardMaterial color="#1a1c20" metalness={0.8} />
      </mesh>

      {/* Tail Formation Slime Light Strip */}
      <mesh position={[0.03, 1.25, 1.4]} rotation={[0, 0, 0]}>
        <planeGeometry args={[0.01, 0.22]} />
        <meshBasicMaterial color={slimeLight} side={THREE.DoubleSide} />
      </mesh>

      {/* ── 8. TWIN VENTRAL FINS (CANTED 30° OUTWARD) ───────────── */}
      {/* Port Ventral Fin */}
      <mesh position={[-0.26, -0.34, 1.70]} rotation={[-0.06, 0, 0.52]} castShadow>
        <boxGeometry args={[0.022, 0.32, 0.68]} />
        <meshStandardMaterial color={bellyCamo} roughness={0.4} metalness={0.4} />
      </mesh>
      {/* Starboard Ventral Fin */}
      <mesh position={[0.26, -0.34, 1.70]} rotation={[-0.06, 0, -0.52]} castShadow>
        <boxGeometry args={[0.022, 0.32, 0.68]} />
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
      <group position={[0, -0.015, 2.15]}>
        {/* Carbon/Titanium Feather Petals Nozzle */}
        <mesh position={[0, 0, 0.22]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.27, 0.29, 0.34, 24, 1, true]} />
          <meshStandardMaterial color={metalFeather} roughness={0.25} metalness={0.92} side={THREE.DoubleSide} />
        </mesh>

        {/* Inner Flame-Holder Ceramic Ring */}
        <mesh position={[0, 0, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.15, 0.26, 24]} />
          <meshStandardMaterial
            color="#f97316"
            emissive="#ea580c"
            emissiveIntensity={isAfterburner ? 0.9 : 0.25}
          />
        </mesh>

        {/* Dynamic Afterburner Shock Diamonds & Core Flame */}
        <mesh ref={afterburnerGlowRef} position={[0, 0, 0.70]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.06, 0.24, 0.85, 16]} />
          <meshBasicMaterial
            color="#38bdf8"
            transparent
            opacity={isAfterburner ? 0.9 : 0.35}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        {isAfterburner && (
          <mesh position={[0, 0, 1.15]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.015, 0.16, 1.35, 16]} />
            <meshBasicMaterial color="#fb923c" transparent opacity={0.8} blending={THREE.AdditiveBlending} />
          </mesh>
        )}
      </group>

      {/* ── 11. RETRACTABLE LANDING GEAR SYSTEM ──────────────────── */}
      <group ref={gearGroup}>
        {/* Forward Nose Gear (cant forward) */}
        <group position={[0, -0.15, -1.25]}>
          <mesh rotation={[-0.18, 0, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.52, 12]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.1} />
          </mesh>
          <mesh position={[0, -0.12, -0.06]}>
            <boxGeometry args={[0.08, 0.04, 0.04]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0, -0.28, 0.05]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.085, 0.085, 0.065, 16]} />
            <meshStandardMaterial color="#1a1e23" roughness={0.9} />
          </mesh>
          <mesh position={[0, -0.28, 0.05]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.045, 0.045, 0.07, 12]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
          </mesh>
        </group>

        {/* Main Landing Gear (Port & Starboard) */}
        {[-0.45, 0.45].map((xOffset, idx) => (
          <group key={idx} position={[xOffset, -0.12, 0.48]}>
            <mesh rotation={[0, 0, xOffset > 0 ? -0.20 : 0.20]}>
              <cylinderGeometry args={[0.03, 0.03, 0.58, 12]} />
              <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.1} />
            </mesh>
            <mesh position={[xOffset > 0 ? 0.06 : -0.06, -0.30, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.135, 0.135, 0.095, 16]} />
              <meshStandardMaterial color="#15181c" roughness={0.9} />
            </mesh>
            <mesh position={[xOffset > 0 ? 0.06 : -0.06, -0.30, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.075, 0.075, 0.10, 12]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.8} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
