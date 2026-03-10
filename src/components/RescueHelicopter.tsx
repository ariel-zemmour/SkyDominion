import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store';
import { getTerrainHeight } from '../utils/terrain';

const RESCUE_HOVER_HEIGHT = 20;
const HELI_SPEED = 80;
const ROPE_SPEED = 10;
const ROPE_LENGTH = 18;
const REPAIR_DURATION = 8; // seconds to repair
const HANGAR_POS = new THREE.Vector3(200, 0, 200); // Hangar on the map

export function RescueHelicopter() {
  const isRescueCalled = useGameStore(state => state.isRescueCalled);
  const rescueState = useGameStore(state => state.rescueState);

  if (!isRescueCalled || rescueState === 'none') return null;

  return (
    <>
      <HelicopterModel />
      <SOSFlare />
      <HangarModel />
    </>
  );
}

// ── SOS Smoke Flare ──────────────────────────────────────────────
function SOSFlare() {
  const group = useRef<THREE.Group>(null);
  const rescueState = useGameStore(state => state.rescueState);
  const sosFired = useGameStore(state => state.sosFired);

  // Store the original flare position
  const [flarePos] = useState(() => {
    const p = useGameStore.getState().pilotPos.clone();
    p.y = getTerrainHeight(p.x, p.z) + 0.5;
    return p;
  });

  useFrame((state) => {
    if (!group.current || !sosFired) return;
    // Only show during incoming/hovering phase
    if (rescueState !== 'incoming' && rescueState !== 'hovering') {
      group.current.visible = false;
      return;
    }
    group.current.visible = true;
    group.current.position.copy(flarePos);
  });

  if (!sosFired) return null;

  return (
    <group ref={group}>
      {/* Red smoke stack — multiple rising spheres */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
        <mesh key={i} position={[
          Math.sin(i * 1.2) * 0.8,
          2 + i * 3,
          Math.cos(i * 0.9) * 0.8
        ]}>
          <sphereGeometry args={[1.2 + i * 0.4, 8, 8]} />
          <meshStandardMaterial
            color={i < 3 ? '#ff2200' : '#ff6600'}
            transparent
            opacity={0.5 - i * 0.05}
          />
        </mesh>
      ))}
      {/* Bright flare point at base */}
      <pointLight position={[0, 1, 0]} color="#ff3300" intensity={15} distance={200} />
      <mesh position={[0, 0.5, 0]}>
        <sphereGeometry args={[0.5, 12, 12]} />
        <meshStandardMaterial color="#ff4400" emissive="#ff2200" emissiveIntensity={3} />
      </mesh>
    </group>
  );
}

// ── Hangar / Garage Building ─────────────────────────────────────
function HangarModel() {
  const rescueState = useGameStore(state => state.rescueState);
  const hangarRef = useRef<THREE.Group>(null);
  const mechanicRef = useRef<THREE.Group>(null);

  // Only show hangar when relevant
  if (!['toHangar', 'landing', 'repairing', 'repaired'].includes(rescueState)) return null;

  const groundY = getTerrainHeight(HANGAR_POS.x, HANGAR_POS.z);

  useFrame((state) => {
    // Mechanic animation
    if (mechanicRef.current && rescueState === 'repairing') {
      // Wiggle mechanic to simulate working
      mechanicRef.current.position.x = 8 + Math.sin(state.clock.elapsedTime * 10) * 0.5;
      mechanicRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 15) * 0.2;
    } else if (mechanicRef.current) {
      mechanicRef.current.position.x = 8;
      mechanicRef.current.rotation.z = 0;
    }
  });

  return (
    <group ref={hangarRef} position={[HANGAR_POS.x, groundY, HANGAR_POS.z]}>
      {/* Main hangar structure — Quonset hut style */}
      <mesh position={[0, 5, 0]}>
        <boxGeometry args={[20, 10, 30]} />
        <meshStandardMaterial color="#556677" roughness={0.9} metalness={0.3} />
      </mesh>
      {/* Roof */}
      <mesh position={[0, 10.5, 0]} rotation={[0, 0, 0]}>
        <boxGeometry args={[22, 1, 32]} />
        <meshStandardMaterial color="#445566" roughness={0.8} metalness={0.4} />
      </mesh>
      {/* Open front door - black void to simulate depth */}
      <mesh position={[0, 4, 15.5]}>
        <boxGeometry args={[14, 8, 0.3]} />
        <meshStandardMaterial color="#111" />
      </mesh>

      {/* NEW: Runway stretching out of the hangar */}
      <mesh position={[0, 0.05, 115]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[14, 200]} />
        <meshStandardMaterial color="#222" roughness={0.9} />
      </mesh>
      {/* Runway center lines */}
      {[...Array(10)].map((_, i) => (
        <mesh key={i} position={[0, 0.1, 30 + i * 20]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.5, 8]} />
          <meshStandardMaterial color="#fff" />
        </mesh>
      ))}

      {/* Landing pad — "H" marking */}
      <mesh position={[0, 0.06, 25]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[12, 32]} />
        <meshStandardMaterial color="#333" roughness={1} />
      </mesh>
      <mesh position={[0, 0.1, 25]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[10, 11, 32]} />
        <meshStandardMaterial color="#ffcc00" />
      </mesh>
      {/* Mechanic figure */}
      <group ref={mechanicRef} position={[8, 0, 18]}>
        {/* Body */}
        <mesh position={[0, 1.2, 0]}>
          <boxGeometry args={[0.8, 1.2, 0.5]} />
          <meshStandardMaterial color="#0055aa" roughness={0.8} />
        </mesh>
        {/* Head */}
        <mesh position={[0, 2.1, 0]}>
          <sphereGeometry args={[0.25, 10, 10]} />
          <meshStandardMaterial color="#d4a574" />
        </mesh>
        {/* Hard hat */}
        <mesh position={[0, 2.35, 0]}>
          <sphereGeometry args={[0.28, 10, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#ffcc00" />
        </mesh>
        {/* Legs */}
        <mesh position={[0.15, 0.2, 0]}>
          <boxGeometry args={[0.2, 0.8, 0.25]} />
          <meshStandardMaterial color="#333" />
        </mesh>
        <mesh position={[-0.15, 0.2, 0]}>
          <boxGeometry args={[0.2, 0.8, 0.25]} />
          <meshStandardMaterial color="#333" />
        </mesh>
        {/* Wrench */}
        <mesh position={[-0.5, 1.2, 0.4]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.1, 0.8, 0.1]} />
          <meshStandardMaterial color="#888" metalness={0.8} />
        </mesh>
      </group>
      {/* Hangar lights */}
      <pointLight position={[0, 9, 0]} color="#ffffcc" intensity={5} distance={30} />
      <pointLight position={[0, 2, 20]} color="#ffffcc" intensity={3} distance={15} />
    </group>
  );
}

// ── Helicopter Model + Full State Machine ────────────────────────
function HelicopterModel() {
  const group = useRef<THREE.Group>(null);
  const rotor = useRef<THREE.Mesh>(null);
  const tailRotor = useRef<THREE.Mesh>(null);
  const rope = useRef<THREE.Line>(null);

  const [heliPos] = useState(() => {
    const pilotPos = useGameStore.getState().pilotPos;
    return pilotPos.clone().add(new THREE.Vector3(500, 200, 500));
  });
  const [ropeLength, setRopeLength] = useState(0);
  const repairStart = useRef(0);

  useFrame((state, delta) => {
    if (!group.current) return;

    // Spin rotors
    if (rotor.current) rotor.current.rotation.y += delta * 20;
    if (tailRotor.current) tailRotor.current.rotation.x += delta * 25;

    const store = useGameStore.getState();
    const rescueState = store.rescueState;
    const pilotPos = store.pilotPos;

    // ── State: INCOMING ─────────────────────────────────
    if (rescueState === 'incoming') {
      const targetPos = new THREE.Vector3(pilotPos.x, pilotPos.y + RESCUE_HOVER_HEIGHT, pilotPos.z);
      const dir = targetPos.clone().sub(heliPos).normalize();
      const dist = heliPos.distanceTo(targetPos);

      if (dist < 2) {
        useGameStore.setState({ rescueState: 'hovering' });
      } else {
        heliPos.add(dir.multiplyScalar(Math.min(dist, HELI_SPEED * delta)));
        if (dir.lengthSq() > 0.001) {
          const targetRot = Math.atan2(dir.x, dir.z);
          group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, targetRot, delta * 2);
        }
      }
    }

    // ── State: HOVERING — drop rope, wait for player ────
    else if (rescueState === 'hovering') {
      const targetPos = new THREE.Vector3(pilotPos.x, pilotPos.y + RESCUE_HOVER_HEIGHT, pilotPos.z);
      heliPos.lerp(targetPos, delta * 2);

      if (ropeLength < ROPE_LENGTH) {
        setRopeLength(prev => Math.min(prev + ROPE_SPEED * delta, ROPE_LENGTH));
      } else {
        const distToRope = Math.sqrt(
          Math.pow(pilotPos.x - heliPos.x, 2) +
          Math.pow(pilotPos.z - heliPos.z, 2)
        );
        if (distToRope < 5 && Math.abs((heliPos.y - ropeLength) - pilotPos.y) < 5) {
          useGameStore.setState({ rescueState: 'lifting' });
        }
      }
    }

    // ── State: LIFTING — pull player up ─────────────────
    else if (rescueState === 'lifting') {
      const targetPos = new THREE.Vector3(pilotPos.x, pilotPos.y + RESCUE_HOVER_HEIGHT, pilotPos.z);
      heliPos.lerp(targetPos, delta * 2);

      if (ropeLength > 0) {
        setRopeLength(prev => Math.max(0, prev - ROPE_SPEED * delta));
        const newPilotPos = store.pilotPos.clone();
        newPilotPos.x = THREE.MathUtils.lerp(newPilotPos.x, heliPos.x, delta * 5);
        newPilotPos.z = THREE.MathUtils.lerp(newPilotPos.z, heliPos.z, delta * 5);
        newPilotPos.y = heliPos.y - ropeLength;
        useGameStore.setState({
          pilotPos: newPilotPos,
          pilotVelocityY: 0,
          isOnGround: false,
        });
      } else {
        // Player is in heli → fly to hangar
        useGameStore.setState({ rescueState: 'toHangar' });
      }
    }

    // ── State: TO HANGAR — fly to hangar location ───────
    else if (rescueState === 'toHangar') {
      const hangarGroundY = getTerrainHeight(HANGAR_POS.x, HANGAR_POS.z);
      const hangarTarget = new THREE.Vector3(HANGAR_POS.x, hangarGroundY + RESCUE_HOVER_HEIGHT + 5, HANGAR_POS.z + 25);
      const dir = hangarTarget.clone().sub(heliPos).normalize();
      const dist = heliPos.distanceTo(hangarTarget);

      if (dist < 3) {
        useGameStore.setState({ rescueState: 'landing' });
      } else {
        heliPos.add(dir.multiplyScalar(Math.min(dist, HELI_SPEED * delta)));
        const targetRot = Math.atan2(dir.x, dir.z);
        group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, targetRot, delta * 2);
      }

      // Pilot moves with helicopter
      useGameStore.setState({
        pilotPos: heliPos.clone().add(new THREE.Vector3(0, -2, 0)),
        altitude: Math.max(0, heliPos.y - hangarGroundY),
      });
      setRopeLength(0);
    }

    // ── State: LANDING — descend at hangar pad ──────────
    else if (rescueState === 'landing') {
      const hangarGroundY = getTerrainHeight(HANGAR_POS.x, HANGAR_POS.z);
      const landTarget = new THREE.Vector3(HANGAR_POS.x, hangarGroundY + 3, HANGAR_POS.z + 25);
      const dist = heliPos.distanceTo(landTarget);

      if (dist < 1) {
        heliPos.copy(landTarget);
        repairStart.current = state.clock.elapsedTime;
        useGameStore.setState({
          rescueState: 'repairing',
          isOnGround: true,
          pilotPos: new THREE.Vector3(HANGAR_POS.x, hangarGroundY + 1.8, HANGAR_POS.z + 20),
          isEjected: false, // Player is no longer "ejected" — back in hangar
          repairProgress: 0,
        });
      } else {
        heliPos.lerp(landTarget, delta * 2);
        useGameStore.setState({
          pilotPos: heliPos.clone().add(new THREE.Vector3(0, -2, 0)),
        });
      }
    }

    // ── State: REPAIRING — mechanic fixes the jet ───────
    else if (rescueState === 'repairing') {
      const elapsed = state.clock.elapsedTime - repairStart.current;
      const progress = Math.min(100, (elapsed / REPAIR_DURATION) * 100);
      useGameStore.setState({ repairProgress: progress });

      if (progress >= 100) {
        // Fully repaired! Restore jet and let player fly again
        const hangarGroundY = getTerrainHeight(HANGAR_POS.x, HANGAR_POS.z);
        const jet = useGameStore.getState();
        useGameStore.setState({
          rescueState: 'repaired',
          repairProgress: 100,
          health: 100,
          fuel: 100,
          bullets: 2000,
          homingMissiles: 20,
          groundMissiles: 10,
          jetStatus: 'normal',
          // Place jet at hangar runway start, facing +Z
          playerPos: new THREE.Vector3(HANGAR_POS.x, hangarGroundY + 12, HANGAR_POS.z + 50),
          playerRot: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0)),
          score: jet.score + 1000, // Bonus for surviving
        });

        repairStart.current = state.clock.elapsedTime; // reuse for delay
      }
    }

    // ── State: REPAIRED — player takes off ──────────────
    else if (rescueState === 'repaired') {
      // Helicopter stays parked. Player is back in jet control flying down runway.
      // Wait 5 seconds before making hangar disappear
      if (state.clock.elapsedTime - repairStart.current > 5) {
        useGameStore.setState({
          rescueState: 'none',
          isRescueCalled: false,
          isEjected: false,
          isOnGround: false,
          sosFired: false,
          repairProgress: 0,
          // Reset ground combat
          soldiers: [],
          soldiersDestroyed: 0,
          rifleAmmo: 120,
          gameState: 'playing',
        });
      }
    }

    group.current.position.copy(heliPos);

    // Update rope geometry
    if (rope.current && rope.current.geometry) {
      const positions = rope.current.geometry.attributes.position.array as Float32Array;
      positions[0] = 0; positions[1] = 0; positions[2] = 0;
      positions[3] = 0; positions[4] = -ropeLength; positions[5] = 0;
      rope.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group ref={group}>
      {/* Helicopter body */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[2, 2.5, 6]} />
        <meshStandardMaterial color="#334433" roughness={0.8} />
      </mesh>

      {/* Cockpit canopy */}
      <mesh position={[0, 0.5, 2.5]}>
        <boxGeometry args={[1.6, 1.2, 1.2]} />
        <meshStandardMaterial color="#112233" roughness={0.1} metalness={0.8} />
      </mesh>

      {/* Tail boom */}
      <mesh position={[0, 0.5, -4]}>
        <boxGeometry args={[0.5, 1, 4]} />
        <meshStandardMaterial color="#334433" />
      </mesh>

      {/* Red cross (medical rescue) */}
      <mesh position={[1.01, 0.3, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[1.5, 0.4]} />
        <meshStandardMaterial color="#cc0000" />
      </mesh>
      <mesh position={[1.01, 0.3, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.4, 1.5]} />
        <meshStandardMaterial color="#cc0000" />
      </mesh>

      {/* Main Rotor */}
      <group position={[0, 1.5, 0]}>
        <mesh>
          <cylinderGeometry args={[0.2, 0.2, 0.5, 8]} />
          <meshStandardMaterial color="#222" />
        </mesh>
        <mesh ref={rotor as any} position={[0, 0.25, 0]}>
          <boxGeometry args={[10, 0.05, 0.4]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      </group>

      {/* Tail Rotor */}
      <group position={[0.4, 0.5, -5.5]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.1, 0.1, 0.3, 8]} />
          <meshStandardMaterial color="#222" />
        </mesh>
        <mesh ref={tailRotor as any} position={[0.15, 0, 0]}>
          <boxGeometry args={[0.05, 2, 0.2]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      </group>

      {/* Skids */}
      <mesh position={[-1, -1.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 6, 8]} />
        <meshStandardMaterial color="#555" metalness={0.5} />
      </mesh>
      <mesh position={[1, -1.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 6, 8]} />
        <meshStandardMaterial color="#555" metalness={0.5} />
      </mesh>

      {/* Rope */}
      <line ref={rope as any}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array(6)}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#554422" linewidth={2} />
      </line>
    </group>
  );
}
