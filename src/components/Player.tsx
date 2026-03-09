import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useKeyboardControls } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore, JETS } from '../store';

import { audioSynth } from '../audio';
import { getTerrainHeight } from '../utils/terrain';

const MAX_SPEED = 800;
const MIN_SPEED = 150;
const ACCELERATION = 200;
const AFTERBURNER_MULTIPLIER = 1.5;
const TURN_SPEED = 1.5;
const ROLL_SPEED = 3.0;

export function Player() {
  const group = useRef<THREE.Group>(null);
  const [, get] = useKeyboardControls();
  
  const playerPos = useGameStore(state => state.playerPos);
  const playerRot = useGameStore(state => state.playerRot);
  const playerVelocity = useGameStore(state => state.playerVelocity);
  const setPlayerStats = useGameStore(state => state.setPlayerStats);
  const gameState = useGameStore(state => state.gameState);
  const activeJetId = useGameStore(state => state.activeJet);
  const activeJet = JETS.find(j => j.id === activeJetId) || JETS[0];
  
  const speed = useRef(300);
  const pitch = useRef(0);
  const yaw = useRef(0);
  const roll = useRef(0);

  useEffect(() => {
    if (gameState === 'playing' && group.current) {
      group.current.position.copy(playerPos);
      group.current.quaternion.copy(playerRot);
      speed.current = 300;
      pitch.current = 0;
      yaw.current = 0;
      roll.current = 0;
    }
  }, [gameState]);
  
  // Visual parts for animation
  const leftAileron = useRef<THREE.Mesh>(null);
  const rightAileron = useRef<THREE.Mesh>(null);
  const elevator = useRef<THREE.Mesh>(null);
  const rudder = useRef<THREE.Mesh>(null);
  const afterburnerGlow = useRef<THREE.Mesh>(null);
  const heatBlur = useRef<THREE.Mesh>(null);

  const lastFired = useRef(0);
  const lastMissile = useRef(0);
  const fireProjectile = useGameStore(state => state.fireProjectile);
  const bullets = useGameStore(state => state.bullets);
  const homingMissiles = useGameStore(state => state.homingMissiles);
  const groundMissiles = useGameStore(state => state.groundMissiles);
  const lockedTargetId = useGameStore(state => state.lockedTargetId);

  const toggleCameraMode = useGameStore(state => state.toggleCameraMode);
  const lastCameraToggle = useRef(0);

  const isMouseDown = useRef(false);

  useEffect(() => {
    const handleMouseDown = () => (isMouseDown.current = true);
    const handleMouseUp = () => (isMouseDown.current = false);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  useFrame((state, delta) => {
    if (gameState !== 'playing' || !group.current) return;

    const { forward, backward, left, right, shift, camera, fireBullets, fireHoming, fireGround } = get();

    if (camera && state.clock.elapsedTime - lastCameraToggle.current > 0.5) {
      lastCameraToggle.current = state.clock.elapsedTime;
      toggleCameraMode();
    }

    // Shooting Bullets
    const fireRate = 0.1 / activeJet.weapons;
    if (fireBullets && state.clock.elapsedTime - lastFired.current > fireRate && bullets > 0) {
      lastFired.current = state.clock.elapsedTime;
      setPlayerStats({ bullets: bullets - 1 });
      audioSynth.playShoot();
      
      const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(group.current.quaternion);
      const projVel = direction.clone().multiplyScalar(2000).add(playerVelocity);
      
      fireProjectile({
        position: group.current.position.clone().add(direction.clone().multiplyScalar(10)),
        velocity: projVel,
        type: 'bullet',
        owner: 'player',
        createdAt: state.clock.elapsedTime
      });
    }

    // Homing Missiles
    if (fireHoming && state.clock.elapsedTime - lastMissile.current > 1.0 && homingMissiles > 0) {
      lastMissile.current = state.clock.elapsedTime;
      setPlayerStats({ homingMissiles: homingMissiles - 1 });
      audioSynth.playMissile();
      
      const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(group.current.quaternion);
      const projVel = direction.clone().multiplyScalar(1200).add(playerVelocity);
      
      fireProjectile({
        position: group.current.position.clone().add(direction.clone().multiplyScalar(10)),
        velocity: projVel,
        type: 'missile',
        owner: 'player',
        targetId: lockedTargetId || undefined,
        createdAt: state.clock.elapsedTime
      });
    }

    // Ground Missiles
    if (fireGround && state.clock.elapsedTime - lastMissile.current > 1.0 && groundMissiles > 0) {
      lastMissile.current = state.clock.elapsedTime;
      setPlayerStats({ groundMissiles: groundMissiles - 1 });
      audioSynth.playMissile();
      
      const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(group.current.quaternion);
      const projVel = direction.clone().multiplyScalar(1000).add(playerVelocity);
      
      fireProjectile({
        position: group.current.position.clone().add(direction.clone().multiplyScalar(10)),
        velocity: projVel,
        type: 'ground-missile',
        owner: 'player',
        createdAt: state.clock.elapsedTime
      });
    }

    // Throttle
    let targetSpeed = speed.current;
    if (forward) targetSpeed += ACCELERATION * delta;
    if (backward) targetSpeed -= ACCELERATION * delta;
    
    const currentMaxSpeed = shift ? activeJet.speed * AFTERBURNER_MULTIPLIER : activeJet.speed;
    targetSpeed = THREE.MathUtils.clamp(targetSpeed, MIN_SPEED, currentMaxSpeed);
    speed.current = THREE.MathUtils.lerp(speed.current, targetSpeed, delta * 2);
    
    audioSynth.setEngineSpeed((speed.current - MIN_SPEED) / (activeJet.speed * AFTERBURNER_MULTIPLIER - MIN_SPEED));

    // Rotation
    const pitchInput = (get().pitchUp ? 1 : 0) - (get().pitchDown ? 1 : 0);
    const rollInput = (get().rollRight ? 1 : 0) - (get().rollLeft ? 1 : 0);
    const yawInput = (get().yawRight ? 1 : 0) - (get().yawLeft ? 1 : 0);

    pitch.current = THREE.MathUtils.lerp(pitch.current, pitchInput * TURN_SPEED, delta * 5);
    roll.current = THREE.MathUtils.lerp(roll.current, rollInput * ROLL_SPEED, delta * 5);
    yaw.current = THREE.MathUtils.lerp(yaw.current, yawInput * TURN_SPEED, delta * 5);

    // Apply rotation
    group.current.rotateX(pitch.current * delta);
    group.current.rotateY(-yaw.current * delta);
    group.current.rotateZ(-roll.current * delta);

    // Move forward
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(group.current.quaternion);
    playerVelocity.copy(direction).multiplyScalar(speed.current);
    group.current.position.addScaledVector(playerVelocity, delta);

    // Collision detection with terrain
    const terrainHeight = getTerrainHeight(group.current.position.x, group.current.position.z);
    
    // Check for collision with terrain or buildings
    let hasCollided = group.current.position.y <= terrainHeight + 5;
    
    if (!hasCollided) {
      const buildings = useGameStore.getState().buildings;
      for (const building of buildings) {
        // Simple distance check for building collision
        // Building is 50x100x50, so we check if player is within a reasonable radius
        const dx = group.current.position.x - building.position.x;
        const dz = group.current.position.z - building.position.z;
        const dy = group.current.position.y - building.position.y;
        
        // Check if within building bounds (approximate with cylinder/box)
        if (Math.abs(dx) < 30 && Math.abs(dz) < 30 && dy > -50 && dy < 60) {
          hasCollided = true;
          break;
        }
      }
    }

    if (hasCollided) {
      setPlayerStats({ health: 0 });
      useGameStore.getState().setGameState('gameover');
      audioSynth.playExplosion();
      useGameStore.getState().spawnParticle({
        position: group.current.position.clone(),
        type: 'explosion',
        createdAt: state.clock.elapsedTime,
        duration: 2
      });
    }

    // Update store
    playerPos.copy(group.current.position);
    playerRot.copy(group.current.quaternion);
    
    // Update UI stats (throttled slightly by zustand if needed, but we'll just set it)
    if (state.clock.elapsedTime % 0.1 < delta) {
      setPlayerStats({
        speed: speed.current,
        altitude: group.current.position.y,
      });
    }

    // Animate control surfaces
    if (leftAileron.current && rightAileron.current) {
      leftAileron.current.rotation.x = rollInput * 0.5;
      rightAileron.current.rotation.x = -rollInput * 0.5;
    }
    if (elevator.current) {
      elevator.current.rotation.x = pitchInput * 0.5;
    }
    if (rudder.current) {
      rudder.current.rotation.y = yawInput * 0.5;
    }
    
    // Afterburner effect
    if (afterburnerGlow.current) {
      afterburnerGlow.current.scale.y = shift ? 2 + Math.random() * 0.5 : 1 + Math.random() * 0.2;
      (afterburnerGlow.current.material as THREE.MeshBasicMaterial).opacity = shift ? 0.8 : 0.4;
    }
  });

  return (
    <group ref={group} scale={4.0}>
      <group>
        {/* Fuselage */}
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.3, 0.5, activeJet.length, 16]} />
          <meshStandardMaterial color={activeJet.color} roughness={0.2} metalness={0.9} />
        </mesh>

        {/* Air Intake */}
        <mesh position={[0, -0.3, -activeJet.length * 0.1]} castShadow receiveShadow>
          <boxGeometry args={[0.8, 0.6, 1.2]} />
          <meshStandardMaterial color="#202020" roughness={0.3} metalness={0.7} />
        </mesh>

        {/* Bubble Canopy */}
        <mesh position={[0, 0.4, -activeJet.length * 0.1]} castShadow receiveShadow>
          <sphereGeometry args={[0.35, 16, 16, 0, Math.PI * 2, 0, Math.PI / 1.5]} />
          <meshStandardMaterial color="#111122" roughness={0.1} metalness={0.5} transparent opacity={0.8} />
        </mesh>

        {/* Main Wings (Swept) */}
        <mesh position={[0, 0, activeJet.length * 0.05]} rotation={[0, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[activeJet.wingSpan, 0.05, 1.5]} />
          <meshStandardMaterial color={activeJet.color} roughness={0.3} metalness={0.8} />
        </mesh>

        {/* Tail Fin */}
        <mesh position={[0, 1.0, activeJet.length * 0.4]} rotation={[0, 0, 0.1]} castShadow receiveShadow>
          <boxGeometry args={[0.1, 1.8, 1.2]} />
          <meshStandardMaterial color={activeJet.color} roughness={0.3} metalness={0.8} />
        </mesh>

        {/* Horizontal Stabilizers */}
        <mesh position={[0, 0.2, activeJet.length * 0.45]} castShadow receiveShadow>
          <boxGeometry args={[activeJet.wingSpan * 0.4, 0.05, 0.8]} />
          <meshStandardMaterial color={activeJet.color} roughness={0.3} metalness={0.8} />
        </mesh>

        {/* Engine Exhaust */}
        <mesh position={[0, 0, activeJet.length * 0.5]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.25, 0.35, 0.6, 16]} />
          <meshStandardMaterial color="#404040" roughness={0.1} metalness={0.9} />
        </mesh>

        {/* Engine glow */}
        <mesh ref={afterburnerGlow} position={[0, 0, activeJet.length * 0.5 + 0.3]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.3, 16]} />
          <meshBasicMaterial color="#ff6600" transparent opacity={0.8} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>
    </group>
  );
}
