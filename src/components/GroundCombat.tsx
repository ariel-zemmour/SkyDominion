import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useKeyboardControls } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../store';
import { audioSynth } from '../audio';
import { getTerrainHeight } from '../utils/terrain';
import { useMobileStore } from '../hooks/useMobileControls';

const PILOT_MOVE_SPEED = 8;
const PILOT_LOOK_SPEED = 2.5;
const GRAVITY = 30;           // m/s² gravity
const PARACHUTE_DRAG = 0.92;  // Drag when parachute is deployed (reduces velocity each frame)
const PARACHUTE_MAX_FALL = 12; // Maximum fall speed with parachute (m/s)
const PARACHUTE_DEPLOY_DELAY = 1.5; // Seconds after ejection before parachute opens

export function GroundCombat() {
  const isEjected = useGameStore(state => state.isEjected);
  const gameState = useGameStore(state => state.gameState);

  if (!isEjected || gameState !== 'playing') return null;

  return (
    <>
      <PilotController />
      <PilotModel />
    </>
  );
}

function PilotController() {
  const [, get] = useKeyboardControls();
  const lastFired = useRef(0);

  // Use useFrame's delta (2nd arg) — never call clock.getDelta() manually
  useFrame((state, delta) => {
    const store = useGameStore.getState();
    if (store.gameState !== 'playing' || !store.isEjected) return;

    // Clamp delta to avoid huge jumps on tab-switch
    const dt = Math.min(delta, 0.1);

    const mobile = useMobileStore.getState();
    const keys = get();
    const pilotPos = store.pilotPos;
    const isOnGround = store.isOnGround;

    const terrainHeight = getTerrainHeight(pilotPos.x, pilotPos.z);
    const groundLevel = terrainHeight + 1.8; // Eye height

    // ──────────────────────────────────────────────────────
    //  FALLING / PARACHUTE PHASE
    // ──────────────────────────────────────────────────────
    if (!isOnGround) {
      let velY = store.pilotVelocityY;
      const timeSinceEjection = state.clock.elapsedTime - store.ejectionTime;
      const chuteOpen = timeSinceEjection > PARACHUTE_DEPLOY_DELAY;

      // Deploy parachute after delay
      if (chuteOpen && !store.parachuteDeployed) {
        useGameStore.setState({ parachuteDeployed: true });
      }

      // Apply gravity
      velY -= GRAVITY * dt;

      // If parachute is deployed, apply drag to slow descent
      if (chuteOpen) {
        // Drag only slows downward velocity
        if (velY < 0) {
          velY *= Math.pow(PARACHUTE_DRAG, dt * 60); // frame-rate independent drag
          // Clamp to max fall speed
          velY = Math.max(velY, -PARACHUTE_MAX_FALL);
        }
      }

      // Update position
      const newPos = pilotPos.clone();
      newPos.y += velY * dt;

      // Wind drift (gentle)
      newPos.x += Math.sin(state.clock.elapsedTime * 0.5) * 1.5 * dt;
      newPos.z += Math.cos(state.clock.elapsedTime * 0.3) * 1.5 * dt;

      // Check ground collision
      if (newPos.y <= groundLevel) {
        newPos.y = groundLevel;
        velY = 0;
        useGameStore.setState({ 
          isOnGround: true,
          parachuteDeployed: false, // Hide parachute on landing
          pilotPos: newPos,
          pilotVelocityY: 0,
          altitude: 0,
          speed: 0,
        });
      } else {
        useGameStore.setState({ 
          pilotPos: newPos,
          pilotVelocityY: velY,
          altitude: Math.max(0, newPos.y - terrainHeight),
          speed: Math.abs(velY),
        });
      }
    }

    // ──────────────────────────────────────────────────────
    //  GROUND MOVEMENT
    // ──────────────────────────────────────────────────────
    if (isOnGround) {
      // Yaw control (look left/right)
      const yawLeft = keys.yawLeft || (mobile.isMobile && mobile.aimX < -0.3);
      const yawRight = keys.yawRight || (mobile.isMobile && mobile.aimX > 0.3);
      let yawDelta = 0;
      if (yawLeft) yawDelta += PILOT_LOOK_SPEED * dt;
      if (yawRight) yawDelta -= PILOT_LOOK_SPEED * dt;
      if (mobile.isMobile && Math.abs(mobile.aimX) > 0.1) {
        yawDelta = -mobile.aimX * PILOT_LOOK_SPEED * dt;
      }

      // Pitch control (look up/down)
      const pitchUp = keys.pitchUp || (mobile.isMobile && mobile.aimY > 0.3);
      const pitchDown = keys.pitchDown || (mobile.isMobile && mobile.aimY < -0.3);
      let pitchDelta = 0;
      if (pitchUp) pitchDelta += PILOT_LOOK_SPEED * dt;
      if (pitchDown) pitchDelta -= PILOT_LOOK_SPEED * dt;
      if (mobile.isMobile && Math.abs(mobile.aimY) > 0.1) {
        pitchDelta = mobile.aimY * PILOT_LOOK_SPEED * dt;
      }

      const newYaw = store.pilotYaw + yawDelta;
      const newPitch = Math.max(-1.2, Math.min(1.0, store.pilotPitch + pitchDelta));

      // Movement (WASD-style)
      const forward = keys.forward || (mobile.isMobile && mobile.moveY > 0.3);
      const backward = keys.backward || (mobile.isMobile && mobile.moveY < -0.3);
      const left = keys.rollLeft || (mobile.isMobile && mobile.moveX < -0.3);
      const right = keys.rollRight || (mobile.isMobile && mobile.moveX > 0.3);

      const moveDir = new THREE.Vector3();
      if (forward) moveDir.z -= 1;
      if (backward) moveDir.z += 1;
      if (left) moveDir.x -= 1;
      if (right) moveDir.x += 1;

      if (moveDir.length() > 0) {
        moveDir.normalize();
        // Rotate movement direction by pilot yaw
        moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), newYaw);
        const newPos = pilotPos.clone().addScaledVector(moveDir, PILOT_MOVE_SPEED * dt);
        const groundH = getTerrainHeight(newPos.x, newPos.z);
        newPos.y = groundH + 1.8;
        useGameStore.setState({ pilotPos: newPos });
      }

      useGameStore.setState({ pilotYaw: newYaw, pilotPitch: newPitch });
    }

    // ──────────────────────────────────────────────────────
    //  SHOOTING — both in air and on ground
    // ──────────────────────────────────────────────────────
    const fireBullets = keys.fireBullets || mobile.fireBullets;
    const fireRate = isOnGround ? 0.2 : 0.35;

    if (fireBullets && state.clock.elapsedTime - lastFired.current > fireRate && store.rifleAmmo > 0) {
      lastFired.current = state.clock.elapsedTime;
      audioSynth.playRifle();

      const yaw = store.pilotYaw;
      const pitch = store.pilotPitch;

      // Shooting direction from pilot's facing
      const shootDir = new THREE.Vector3(
        -Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        -Math.cos(yaw) * Math.cos(pitch)
      ).normalize();

      const bulletStart = pilotPos.clone().add(shootDir.clone().multiplyScalar(1.5));
      const gunRight = new THREE.Vector3().crossVectors(shootDir, new THREE.Vector3(0, 1, 0)).normalize();
      bulletStart.add(gunRight.multiplyScalar(0.3));

      useGameStore.getState().fireProjectile({
        position: bulletStart,
        velocity: shootDir.multiplyScalar(500),
        type: 'bullet',
        owner: 'player',
        createdAt: state.clock.elapsedTime,
      });

      useGameStore.setState({
        rifleAmmo: store.rifleAmmo - 1,
        shotsFired: store.shotsFired + 1,
      });
    }
  });

  return null;
}

// ──────────────────────────────────────────────────────────
//  VISUAL MODEL — Pilot + Parachute
// ──────────────────────────────────────────────────────────
function PilotModel() {
  const group = useRef<THREE.Group>(null);
  const parachuteGroup = useRef<THREE.Group>(null);
  const pilotPos = useGameStore(state => state.pilotPos);
  const isOnGround = useGameStore(state => state.isOnGround);
  const parachuteDeployed = useGameStore(state => state.parachuteDeployed);
  const pilotYaw = useGameStore(state => state.pilotYaw);
  const parachuteScale = useRef(0); // Animates from 0 to 1

  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.position.copy(pilotPos);
    group.current.rotation.y = pilotYaw;

    // Parachute deploy animation
    if (parachuteDeployed && !isOnGround) {
      // Smoothly open parachute
      parachuteScale.current = Math.min(1, parachuteScale.current + delta * 2);
    } else {
      // Collapse / hide parachute
      parachuteScale.current = Math.max(0, parachuteScale.current - delta * 4);
    }

    if (parachuteGroup.current) {
      parachuteGroup.current.visible = parachuteScale.current > 0.01;
      const s = parachuteScale.current;
      parachuteGroup.current.scale.set(s, s, s);
      // Gentle swaying when open
      if (s > 0.5) {
        parachuteGroup.current.rotation.x = Math.sin(state.clock.elapsedTime * 1.5) * 0.08;
        parachuteGroup.current.rotation.z = Math.cos(state.clock.elapsedTime * 1.2) * 0.08;
      }
    }
  });

  return (
    <group ref={group}>
      {/* Parachute */}
      <group ref={parachuteGroup} position={[0, 4, 0]}>
        {/* Canopy - half sphere */}
        <mesh position={[0, 1.5, 0]}>
          <sphereGeometry args={[3.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial
            color="#ff8800"
            side={THREE.DoubleSide}
            transparent
            opacity={0.85}
          />
        </mesh>
        {/* Strings */}
        {[0, 1, 2, 3, 4, 5].map(i => {
          const angle = (i / 6) * Math.PI * 2;
          const x = Math.cos(angle) * 3;
          const z = Math.sin(angle) * 3;
          return (
            <line key={i}>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  count={2}
                  array={new Float32Array([x, 1.5, z, 0, -4, 0])}
                  itemSize={3}
                />
              </bufferGeometry>
              <lineBasicMaterial color="#888" />
            </line>
          );
        })}
      </group>

      {/* Pilot body */}
      <group position={[0, 0, 0]}>
        {/* Torso */}
        <mesh position={[0, 0.1, 0]}>
          <boxGeometry args={[0.6, 0.8, 0.35]} />
          <meshStandardMaterial color="#2d4a2d" roughness={0.8} />
        </mesh>
        {/* Head */}
        <mesh position={[0, 0.7, 0]}>
          <sphereGeometry args={[0.2, 12, 12]} />
          <meshStandardMaterial color="#d4a574" roughness={0.6} />
        </mesh>
        {/* Helmet */}
        <mesh position={[0, 0.8, 0]}>
          <sphereGeometry args={[0.22, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#333" roughness={0.3} metalness={0.5} />
        </mesh>
        {/* Legs */}
        <mesh position={[0.12, -0.6, 0]}>
          <boxGeometry args={[0.18, 0.7, 0.2]} />
          <meshStandardMaterial color="#3a3a2a" roughness={0.9} />
        </mesh>
        <mesh position={[-0.12, -0.6, 0]}>
          <boxGeometry args={[0.18, 0.7, 0.2]} />
          <meshStandardMaterial color="#3a3a2a" roughness={0.9} />
        </mesh>
        {/* Right arm (holding rifle) */}
        <mesh position={[0.4, 0.05, -0.15]} rotation={[0.3, 0, 0.2]}>
          <boxGeometry args={[0.14, 0.5, 0.14]} />
          <meshStandardMaterial color="#2d4a2d" roughness={0.8} />
        </mesh>
        {/* Left arm */}
        <mesh position={[-0.4, 0.05, -0.1]} rotation={[0.2, 0, -0.2]}>
          <boxGeometry args={[0.14, 0.5, 0.14]} />
          <meshStandardMaterial color="#2d4a2d" roughness={0.8} />
        </mesh>
        {/* Rifle */}
        <group position={[0.35, -0.05, -0.35]} rotation={[0.5, 0, 0.1]}>
          <mesh>
            <boxGeometry args={[0.06, 0.06, 0.9]} />
            <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.3} />
          </mesh>
          {/* Stock */}
          <mesh position={[0, -0.04, 0.35]}>
            <boxGeometry args={[0.08, 0.12, 0.25]} />
            <meshStandardMaterial color="#5a3a1a" roughness={0.9} />
          </mesh>
        </group>
      </group>

      {/* Point light for muzzle flash effect */}
      <pointLight position={[0.3, 0.1, -0.8]} intensity={0} distance={5} color="#ffaa00" />
    </group>
  );
}
