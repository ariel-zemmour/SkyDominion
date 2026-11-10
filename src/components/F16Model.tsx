import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../store';
import { getTerrainHeight } from '../utils/terrain';

interface F16ModelProps {
  afterburnerGlowRef: React.RefObject<THREE.Mesh | null>;
  isAfterburner: boolean;
}

export function F16Model({ afterburnerGlowRef, isAfterburner }: F16ModelProps) {
  const cameraMode = useGameStore(state => state.cameraMode);
  const gearGroup = useRef<THREE.Group>(null);
  const gearAnim = useRef(0); // 0 = retracted, 1 = deployed

  // Wing geometry using THREE.Shape for authentic 40-degree sweep
  const { leftWingGeo, rightWingGeo } = useMemo(() => {
    // Left Wing (X negative)
    const leftShape = new THREE.Shape();
    leftShape.moveTo(0, 0); // Root leading edge (blended into LERX)
    leftShape.lineTo(-1.8, 1.51); // Tip leading edge (40 deg sweep: dx=1.8, dz=1.51 => tan(40)=0.839)
    leftShape.lineTo(-1.8, 2.0); // Wingtip launcher rail edge
    leftShape.lineTo(-0.15, 1.85); // Trailing edge root
    leftShape.closePath();

    // Right Wing (X positive)
    const rightShape = new THREE.Shape();
    rightShape.moveTo(0, 0);
    rightShape.lineTo(1.8, 1.51);
    rightShape.lineTo(1.8, 2.0);
    rightShape.lineTo(0.15, 1.85);
    rightShape.closePath();

    const extrudeSettings = { depth: 0.04, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.015, bevelThickness: 0.015 };
    return {
      leftWingGeo: new THREE.ExtrudeGeometry(leftShape, extrudeSettings),
      rightWingGeo: new THREE.ExtrudeGeometry(rightShape, extrudeSettings)
    };
  }, []);

  // LERX (Leading Edge Root Extensions / Strakes)
  const { leftLerxGeo, rightLerxGeo } = useMemo(() => {
    const extrudeSettings = { depth: 0.05, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.02, bevelThickness: 0.02 };

    const left = new THREE.Shape();
    left.moveTo(-0.25, -1.2); // Starts beside cockpit
    left.bezierCurveTo(-0.35, -0.6, -0.65, -0.1, -0.85, 0.4); // S-curve flare
    left.lineTo(-0.25, 0.4);
    left.closePath();

    const right = new THREE.Shape();
    right.moveTo(0.25, -1.2);
    right.bezierCurveTo(0.35, -0.6, 0.65, -0.1, 0.85, 0.4);
    right.lineTo(0.25, 0.4);
    right.closePath();

    return {
      leftLerxGeo: new THREE.ExtrudeGeometry(left, extrudeSettings),
      rightLerxGeo: new THREE.ExtrudeGeometry(right, extrudeSettings)
    };
  }, []);

  // Horizontal Stabilators (All-moving tailplanes)
  const { leftStabGeo, rightStabGeo } = useMemo(() => {
    const extrudeSettings = { depth: 0.03, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: 0.01, bevelThickness: 0.01 };

    const left = new THREE.Shape();
    left.moveTo(-0.2, 1.6);
    left.lineTo(-1.1, 2.3);
    left.lineTo(-1.0, 2.6);
    left.lineTo(-0.2, 2.4);
    left.closePath();

    const right = new THREE.Shape();
    right.moveTo(0.2, 1.6);
    right.lineTo(1.1, 2.3);
    right.lineTo(1.0, 2.6);
    right.lineTo(0.2, 2.4);
    right.closePath();

    return {
      leftStabGeo: new THREE.ExtrudeGeometry(left, extrudeSettings),
      rightStabGeo: new THREE.ExtrudeGeometry(right, extrudeSettings)
    };
  }, []);

  // Vertical Tail Fin with Dorsal Spine Fairing
  const tailFinGeo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0.1, -0.2); // Dorsal fairing start on fuselage spine
    shape.lineTo(0.18, 0.8);  // Fin base
    shape.lineTo(0.95, 1.6);  // Fin top leading edge
    shape.lineTo(0.98, 1.5);  // Top trailing tip (ECM pod)
    shape.lineTo(0.55, 0.8);  // Rudder trailing edge
    shape.lineTo(0.48, -0.2); // Base rear
    shape.closePath();

    return new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.01, bevelThickness: 0.01 });
  }, []);

  // Dynamic Landing Gear Animation (retract when airborne, deploy near ground)
  useFrame((_, delta) => {
    const playerPos = useGameStore.getState().playerPos;
    const terrainY = getTerrainHeight(playerPos.x, playerPos.z);
    const altitudeAboveGround = playerPos.y - terrainY;

    // Deploy gear if close to ground (< 12m), retract otherwise
    const target = altitudeAboveGround < 12 ? 1 : 0;
    gearAnim.current = THREE.MathUtils.lerp(gearAnim.current, target, delta * 3);

    if (gearGroup.current) {
      gearGroup.current.position.y = -0.35 - gearAnim.current * 0.45;
      gearGroup.current.scale.setScalar(gearAnim.current);
      gearGroup.current.visible = gearAnim.current > 0.05;
    }
  });

  // Materials
  const topGray = '#525a65';       // Dark Compass Ghost Gray
  const bellyGray = '#8a94a0';     // Light Ghost Gray
  const radomeColor = '#32363b';   // Dark composite radome
  const metalDetail = '#1c1e22';   // Engine & Gun mechanics
  const slimeLight = '#84cc16';    // Formation electroluminescent strip

  return (
    <group>
      {/* ── 1. NOSE RADOME & PITOT TUBE ────────────────────────── */}
      {/* Pitot Static Needle Tube at extreme nose tip */}
      <mesh position={[0, 0.04, -2.9]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.008, 0.015, 0.55, 8]} />
        <meshStandardMaterial color="#c8d1db" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Aerodynamic Radome Nose Cone */}
      <mesh position={[0, 0.03, -2.35]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.04, 0.22, 0.85, 24]} />
        <meshStandardMaterial color={radomeColor} roughness={0.4} metalness={0.3} />
      </mesh>

      {/* ── 2. FORWARD FUSELAGE & BLENDED CHINES ────────────────── */}
      <mesh position={[0, 0.05, -1.6]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.22, 0.32, 0.9, 24]} />
        <meshStandardMaterial color={topGray} roughness={0.3} metalness={0.5} />
      </mesh>

      {/* ── 3. SEAMLESS 360-DEGREE BUBBLE CANOPY ───────────────── */}
      <group position={[0, 0.22, -1.35]}>
        {/* Transparent Bubble Canopy Glass (Teardrop shape) */}
        <mesh scale={[0.85, 0.9, 2.2]} castShadow>
          <sphereGeometry args={[0.28, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.65]} />
          <meshStandardMaterial
            color="#1d2e3d"
            roughness={0.05}
            metalness={0.8}
            transparent
            opacity={cameraMode === 'cockpit' ? 0.2 : 0.65}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Canopy Base Frame Trim / Sills */}
        <mesh position={[0, -0.06, 0]} scale={[0.88, 0.1, 2.2]}>
          <cylinderGeometry args={[0.29, 0.3, 0.1, 24]} />
          <meshStandardMaterial color="#1a1c20" roughness={0.7} />
        </mesh>

        {/* Ejection Seat (ACES II) & Pilot Silhouette */}
        <group position={[0, -0.05, 0.05]}>
          {/* Seat backrest */}
          <mesh position={[0, 0.08, 0]} rotation={[0.25, 0, 0]}>
            <boxGeometry args={[0.18, 0.36, 0.1]} />
            <meshStandardMaterial color="#111" roughness={0.8} />
          </mesh>
          {/* Headrest */}
          <mesh position={[0, 0.24, -0.02]} rotation={[0.25, 0, 0]}>
            <boxGeometry args={[0.14, 0.12, 0.08]} />
            <meshStandardMaterial color="#7a1818" roughness={0.7} />
          </mesh>
          {/* Pilot Helmet */}
          <mesh position={[0, 0.18, -0.08]}>
            <sphereGeometry args={[0.07, 16, 16]} />
            <meshStandardMaterial color="#304835" roughness={0.4} />
          </mesh>
          {/* Dark Helmet Visor */}
          <mesh position={[0, 0.19, -0.13]}>
            <sphereGeometry args={[0.045, 12, 12]} />
            <meshStandardMaterial color="#050505" roughness={0.1} metalness={0.9} />
          </mesh>
          {/* HUD Combiner Glass frame */}
          <mesh position={[0, 0.12, -0.42]} rotation={[0.4, 0, 0]}>
            <boxGeometry args={[0.14, 0.12, 0.01]} />
            <meshStandardMaterial color="#10b981" transparent opacity={0.4} />
          </mesh>
        </group>
      </group>

      {/* ── 4. M61A1 VULCAN 20MM CANNON PORT (PORT SIDE) ───────── */}
      <group position={[-0.26, 0.14, -1.05]}>
        {/* Recessed Gun Trough Fairing */}
        <mesh rotation={[0, -0.05, 0]}>
          <boxGeometry args={[0.06, 0.06, 0.45]} />
          <meshStandardMaterial color="#1a1c20" roughness={0.5} metalness={0.8} />
        </mesh>
        {/* Cannon Muzzle Opening */}
        <mesh position={[-0.01, 0, -0.22]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.022, 0.022, 0.06, 12]} />
          <meshStandardMaterial color="#0a0a0c" metalness={0.95} roughness={0.1} />
        </mesh>
      </group>

      {/* ── 5. CHIN "SMILE" ENGINE INTAKE ──────────────────────── */}
      <group position={[0, -0.22, -0.7]}>
        {/* Distinctive Curved Smile Intake Mouth Cowling */}
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.26, 0.32, 0.95, 16, 1, false, 0, Math.PI]} />
          <meshStandardMaterial color={bellyGray} roughness={0.4} metalness={0.4} side={THREE.DoubleSide} />
        </mesh>
        {/* Boundary Layer Splitter Plate above Intake */}
        <mesh position={[0, 0.04, -0.2]}>
          <boxGeometry args={[0.48, 0.02, 0.5]} />
          <meshStandardMaterial color={bellyGray} metalness={0.5} roughness={0.3} />
        </mesh>
        {/* Dark Internal Air Duct / Compressor Face Shadow */}
        <mesh position={[0, -0.08, -0.38]} rotation={[0.15, 0, 0]}>
          <planeGeometry args={[0.38, 0.22]} />
          <meshBasicMaterial color="#020305" side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* ── 6. CENTER & AFT FUSELAGE (BLENDED BODY) ───────────── */}
      {/* Main Mid-Fuselage Cylinder */}
      <mesh position={[0, 0.02, 0.2]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.38, 0.36, 1.8, 24]} />
        <meshStandardMaterial color={topGray} roughness={0.3} metalness={0.5} />
      </mesh>

      {/* Dorsal Spine Ridge (connects canopy base to tail fin) */}
      <mesh position={[0, 0.26, 0.3]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.12, 1.9, 12]} />
        <meshStandardMaterial color={topGray} roughness={0.35} metalness={0.4} />
      </mesh>

      {/* LERX Strakes (Wing-Body Blending) */}
      <mesh geometry={leftLerxGeo} position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
        <meshStandardMaterial color={topGray} roughness={0.3} metalness={0.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={rightLerxGeo} position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
        <meshStandardMaterial color={topGray} roughness={0.3} metalness={0.5} side={THREE.DoubleSide} />
      </mesh>

      {/* ── 7. MAIN WINGS (40-DEGREE SWEEP & CROPPED DELTA) ────── */}
      <group position={[0, 0.02, 0]}>
        {/* Left Swept Wing */}
        <mesh geometry={leftWingGeo} rotation={[-Math.PI / 2, 0, 0]} position={[-0.4, 0, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={topGray} roughness={0.3} metalness={0.6} side={THREE.DoubleSide} />
        </mesh>

        {/* Right Swept Wing */}
        <mesh geometry={rightWingGeo} rotation={[-Math.PI / 2, 0, 0]} position={[0.4, 0, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={topGray} roughness={0.3} metalness={0.6} side={THREE.DoubleSide} />
        </mesh>

        {/* Wingtip Missile Launch Rails (LAU-129) */}
        <mesh position={[-2.22, 0, 1.7]} rotation={[Math.PI / 2, 0, 0]}>
          <boxGeometry args={[0.04, 0.06, 0.7]} />
          <meshStandardMaterial color="#222" metalness={0.8} />
        </mesh>
        <mesh position={[2.22, 0, 1.7]} rotation={[Math.PI / 2, 0, 0]}>
          <boxGeometry args={[0.04, 0.06, 0.7]} />
          <meshStandardMaterial color="#222" metalness={0.8} />
        </mesh>

        {/* Wingtip AIM-9 Sidewinder / AMRAAM Missiles */}
        {/* Left Wingtip Missile */}
        <group position={[-2.22, -0.02, 1.7]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.85, 12]} />
            <meshStandardMaterial color="#d1d5db" metalness={0.4} roughness={0.4} />
          </mesh>
          {/* Seeker head */}
          <mesh position={[0, 0, -0.44]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.025, 0.08, 12]} />
            <meshStandardMaterial color="#1e293b" metalness={0.9} />
          </mesh>
          {/* Forward canards */}
          <mesh position={[0, 0, -0.3]}>
            <boxGeometry args={[0.16, 0.01, 0.08]} />
            <meshStandardMaterial color="#475569" />
          </mesh>
          {/* Rear fins */}
          <mesh position={[0, 0, 0.35]}>
            <boxGeometry args={[0.22, 0.01, 0.12]} />
            <meshStandardMaterial color="#475569" />
          </mesh>
          {/* Red Port Navigation Light */}
          <mesh position={[-0.04, 0.03, -0.1]}>
            <sphereGeometry args={[0.015, 8, 8]} />
            <meshBasicMaterial color="#ef4444" />
          </mesh>
        </group>

        {/* Right Wingtip Missile */}
        <group position={[2.22, -0.02, 1.7]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.85, 12]} />
            <meshStandardMaterial color="#d1d5db" metalness={0.4} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0, -0.44]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.025, 0.08, 12]} />
            <meshStandardMaterial color="#1e293b" metalness={0.9} />
          </mesh>
          <mesh position={[0, 0, -0.3]}>
            <boxGeometry args={[0.16, 0.01, 0.08]} />
            <meshStandardMaterial color="#475569" />
          </mesh>
          <mesh position={[0, 0, 0.35]}>
            <boxGeometry args={[0.22, 0.01, 0.12]} />
            <meshStandardMaterial color="#475569" />
          </mesh>
          {/* Green Starboard Navigation Light */}
          <mesh position={[0.04, 0.03, -0.1]}>
            <sphereGeometry args={[0.015, 8, 8]} />
            <meshBasicMaterial color="#22c55e" />
          </mesh>
        </group>
      </group>

      {/* ── 8. SINGLE VERTICAL STABILIZER & DORSAL SPINE BLEND ─── */}
      <mesh
        geometry={tailFinGeo}
        position={[-0.03, 0.15, 0.5]}
        rotation={[0, Math.PI / 2, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={topGray} roughness={0.3} metalness={0.6} side={THREE.DoubleSide} />
      </mesh>

      {/* Top ECM / RWR Antenna Pod at Fin Tip */}
      <mesh position={[0, 1.8, 1.45]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.35, 12]} />
        <meshStandardMaterial color="#202226" metalness={0.7} />
      </mesh>

      {/* Tail Formation Slime Light Strip */}
      <mesh position={[0.04, 1.2, 1.1]} rotation={[0, 0, 0]}>
        <planeGeometry args={[0.01, 0.25]} />
        <meshBasicMaterial color={slimeLight} side={THREE.DoubleSide} />
      </mesh>

      {/* ── 9. TWIN VENTRAL FINS (CANTED 30° OUTWARD) ──────────── */}
      {/* Left Ventral Fin */}
      <mesh position={[-0.22, -0.32, 1.65]} rotation={[-0.05, 0, 0.32]} castShadow>
        <boxGeometry args={[0.02, 0.32, 0.65]} />
        <meshStandardMaterial color={bellyGray} roughness={0.3} metalness={0.5} />
      </mesh>
      {/* Right Ventral Fin */}
      <mesh position={[0.22, -0.32, 1.65]} rotation={[-0.05, 0, -0.32]} castShadow>
        <boxGeometry args={[0.02, 0.32, 0.65]} />
        <meshStandardMaterial color={bellyGray} roughness={0.3} metalness={0.5} />
      </mesh>

      {/* ── 10. ALL-MOVING HORIZONTAL STABILATORS ───────────────── */}
      <mesh geometry={leftStabGeo} rotation={[-Math.PI / 2, 0, 0]} position={[-0.2, -0.02, 0]} castShadow>
        <meshStandardMaterial color={topGray} roughness={0.3} metalness={0.6} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={rightStabGeo} rotation={[-Math.PI / 2, 0, 0]} position={[0.2, -0.02, 0]} castShadow>
        <meshStandardMaterial color={topGray} roughness={0.3} metalness={0.6} side={THREE.DoubleSide} />
      </mesh>

      {/* ── 11. ENGINE NOZZLE & CONVERGENT-DIVERGENT PETALS ────── */}
      <group position={[0, 0, 1.95]}>
        {/* Rear Engine Fairing Blending */}
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.34, 0.32, 0.5, 24]} />
          <meshStandardMaterial color={topGray} roughness={0.4} metalness={0.5} />
        </mesh>

        {/* Titanium Afterburner Nozzle (Multi-Petal Exhaust) */}
        <mesh position={[0, 0, 0.38]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.27, 0.29, 0.32, 24, 1, true]} />
          <meshStandardMaterial color={metalDetail} roughness={0.25} metalness={0.9} side={THREE.DoubleSide} />
        </mesh>

        {/* Inner Ceramic Flame Holder Ring */}
        <mesh position={[0, 0, 0.28]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.15, 0.26, 24]} />
          <meshStandardMaterial color="#ff7700" emissive="#ff3300" emissiveIntensity={isAfterburner ? 0.8 : 0.2} />
        </mesh>

        {/* Dynamic Afterburner Flame with Core Shock Diamonds */}
        <mesh ref={afterburnerGlowRef} position={[0, 0, 0.85]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.25, 0.9, 16]} />
          <meshBasicMaterial
            color="#38bdf8"
            transparent
            opacity={isAfterburner ? 0.9 : 0.4}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        {isAfterburner && (
          <mesh position={[0, 0, 1.2]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.02, 0.18, 1.4, 16]} />
            <meshBasicMaterial color="#f97316" transparent opacity={0.8} blending={THREE.AdditiveBlending} />
          </mesh>
        )}
      </group>

      {/* ── 12. RETRACTABLE LANDING GEAR SYSTEM ─────────────────── */}
      <group ref={gearGroup}>
        {/* Forward Nose Landing Gear */}
        <group position={[0, -0.15, -1.2]}>
          {/* Nose Oleo Strut (Forward canted) */}
          <mesh rotation={[-0.15, 0, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.5, 12]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.1} />
          </mesh>
          {/* Dual Taxi Lights */}
          <mesh position={[0, -0.12, -0.06]}>
            <boxGeometry args={[0.08, 0.04, 0.04]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          {/* Nose Wheel Tire */}
          <mesh position={[0, -0.26, 0.04]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.08, 0.08, 0.06, 16]} />
            <meshStandardMaterial color="#1f2429" roughness={0.9} />
          </mesh>
          {/* Nose Wheel Hub */}
          <mesh position={[0, -0.26, 0.04]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.04, 0.04, 0.065, 12]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
          </mesh>
        </group>

        {/* Main Landing Gear (Port & Starboard) */}
        {[-0.42, 0.42].map((xOffset, idx) => (
          <group key={idx} position={[xOffset, -0.12, 0.45]}>
            {/* Main Gear Angled Oleo Strut */}
            <mesh rotation={[0, 0, xOffset > 0 ? -0.18 : 0.18]}>
              <cylinderGeometry args={[0.03, 0.03, 0.55, 12]} />
              <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.1} />
            </mesh>
            {/* Main Wheel Tire */}
            <mesh position={[xOffset > 0 ? 0.06 : -0.06, -0.28, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.13, 0.13, 0.09, 16]} />
              <meshStandardMaterial color="#1a1e22" roughness={0.9} />
            </mesh>
            {/* Main Wheel Magnesium Hub */}
            <mesh position={[xOffset > 0 ? 0.06 : -0.06, -0.28, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.07, 0.07, 0.095, 12]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.8} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
