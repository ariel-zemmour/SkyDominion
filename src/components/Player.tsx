import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useKeyboardControls } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore, JETS } from '../store';

import { audioSynth } from '../audio';
import { getTerrainHeight } from '../utils/terrain';
import { useMobileStore } from '../hooks/useMobileControls';

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
  const spawnParticle = useGameStore(state => state.spawnParticle);
  const bullets = useGameStore(state => state.bullets);
  const homingMissiles = useGameStore(state => state.homingMissiles);
  const groundMissiles = useGameStore(state => state.groundMissiles);
  const setIsEjected = useGameStore(state => state.setIsEjected);
  const isEjected = useGameStore(state => state.isEjected);
  const jetStatus = useGameStore(state => state.jetStatus);
  const setJetStatus = useGameStore(state => state.setJetStatus);
  const lockedTargetId = useGameStore(state => state.lockedTargetId);
  const fuel = useGameStore(state => state.fuel);
  const setFuel = useGameStore(state => state.setFuel);
  const setRefueling = useGameStore(state => state.setRefueling);

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

    if (isEjected) {
        // Ejected pilot camera handling is in CameraController, but we stop control here
        return;
    }

    const keys = get();
    const mobile = useMobileStore.getState();

    // Merge keyboard + mobile inputs
    const forward = keys.forward || mobile.moveY > 0.3;
    const backward = keys.backward || mobile.moveY < -0.3;
    const yawLeft = keys.yawLeft || mobile.moveX < -0.3;
    const yawRight = keys.yawRight || mobile.moveX > 0.3;
    const pitchUp = keys.pitchUp || mobile.aimY > 0.3 || (mobile.gyroEnabled && mobile.gyroPitch > 0.15);
    const pitchDown = keys.pitchDown || mobile.aimY < -0.3 || (mobile.gyroEnabled && mobile.gyroPitch < -0.15);
    const rollLeft = keys.rollLeft || mobile.aimX < -0.3 || (mobile.gyroEnabled && mobile.gyroRoll < -0.15);
    const rollRight = keys.rollRight || mobile.aimX > 0.3 || (mobile.gyroEnabled && mobile.gyroRoll > 0.15);
    const shift = keys.shift || mobile.shift;
    const camera = keys.camera || mobile.camera;
    const fireBullets = keys.fireBullets || mobile.fireBullets;
    const fireHoming = keys.fireHoming || mobile.fireHoming;
    const fireGround = keys.fireGround || mobile.fireGround;
    const eject = keys.eject || mobile.eject;

    if (camera && state.clock.elapsedTime - lastCameraToggle.current > 0.5) {
      lastCameraToggle.current = state.clock.elapsedTime;
      toggleCameraMode();
    }

    // Shooting Bullets
    const fireRate = 0.1 / activeJet.weapons;
    if (fireBullets && state.clock.elapsedTime - lastFired.current > fireRate && bullets > 0) {
      lastFired.current = state.clock.elapsedTime;
      setPlayerStats({ 
        bullets: bullets - 1,
        shotsFired: useGameStore.getState().shotsFired + 1
      });
      audioSynth.playShoot();
      
      const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(group.current.quaternion);
      const projVel = direction.clone().multiplyScalar(2000).add(playerVelocity);
      
      fireProjectile({
        position: group.current.position.clone().add(direction.clone().multiplyScalar(activeJet.length * 2)),
        velocity: projVel,
        type: 'bullet',
        owner: 'player',
        createdAt: state.clock.elapsedTime
      });
    }

    // Homing Missiles
    if (fireHoming && state.clock.elapsedTime - lastMissile.current > 1.0 && homingMissiles > 0) {
      lastMissile.current = state.clock.elapsedTime;
      setPlayerStats({ 
        homingMissiles: homingMissiles - 1,
        shotsFired: useGameStore.getState().shotsFired + 1
      });
      audioSynth.playMissile();
      
      const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(group.current.quaternion);
      const projVel = direction.clone().multiplyScalar(1200).add(playerVelocity);
      
      fireProjectile({
        position: group.current.position.clone().add(direction.clone().multiplyScalar(activeJet.length * 2)),
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
      setPlayerStats({ 
        groundMissiles: groundMissiles - 1,
        shotsFired: useGameStore.getState().shotsFired + 1
      });
      audioSynth.playMissile();
      
      const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(group.current.quaternion);
      const projVel = direction.clone().multiplyScalar(1000).add(playerVelocity);
      
      fireProjectile({
        position: group.current.position.clone().add(direction.clone().multiplyScalar(activeJet.length * 2)),
        velocity: projVel,
        type: 'ground-missile',
        owner: 'player',
        createdAt: state.clock.elapsedTime
      });
    }

    // Fuel consumption
    const fuelRate = (speed.current / 1000) * (shift ? 3 : 1) * delta;
    setFuel(fuel - fuelRate);

    if (fuel <= 0) {
        speed.current = Math.max(speed.current - 100 * delta, 0); // Flame out
    }

    // Refueling logic (check for tanker - placeholder for now, just check a high altitude point)
    const tankerPos = new THREE.Vector3(0, 5000, 0); // Tanker at 5000ft over center
    if (group.current.position.distanceTo(tankerPos) < 200) {
        setFuel(fuel + 5 * delta);
        setRefueling(true);
    } else {
        setRefueling(false);
    }

    // Ejection
    if (eject && !isEjected) {
        setIsEjected(true);
        setJetStatus('crashing');
        useGameStore.setState({ pilotPos: group.current.position.clone().add(new THREE.Vector3(0, 2, 0)) });
        audioSynth.playExplosion();
    }

    // Throttle
    let targetSpeed = speed.current;
    if (forward) targetSpeed += ACCELERATION * delta;
    if (backward) targetSpeed -= ACCELERATION * delta;
    
    const currentMaxSpeed = shift ? activeJet.speed * AFTERBURNER_MULTIPLIER : activeJet.speed;
    targetSpeed = THREE.MathUtils.clamp(targetSpeed, MIN_SPEED, currentMaxSpeed);
    speed.current = THREE.MathUtils.lerp(speed.current, targetSpeed, delta * 2);
    
    audioSynth.setEngineSpeed((speed.current - MIN_SPEED) / (activeJet.speed * AFTERBURNER_MULTIPLIER - MIN_SPEED));

    // Rotation — blend keyboard boolean + mobile analog
    let pitchInput = (pitchUp ? 1 : 0) - (pitchDown ? 1 : 0);
    let rollInput = (rollRight ? 1 : 0) - (rollLeft ? 1 : 0);
    let yawInput = (yawRight ? 1 : 0) - (yawLeft ? 1 : 0);

    // On mobile, use analog values for smoother control
    if (mobile.isMobile) {
      // Right joystick analog
      if (Math.abs(mobile.aimY) > 0.05) pitchInput = mobile.aimY;
      if (Math.abs(mobile.aimX) > 0.05) rollInput = mobile.aimX;
      // Left joystick analog for yaw
      if (Math.abs(mobile.moveX) > 0.05) yawInput = mobile.moveX;

      // Blend gyroscope on top
      if (mobile.gyroEnabled) {
        pitchInput = Math.max(-1, Math.min(1, pitchInput + mobile.gyroPitch * 0.7));
        rollInput = Math.max(-1, Math.min(1, rollInput + mobile.gyroRoll * 0.7));
      }
    }

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
        const collisionWidth = activeJet.wingSpan * 2;
        const collisionHeight = activeJet.length * 4;
        if (Math.abs(dx) < collisionWidth && Math.abs(dz) < collisionWidth && dy > -collisionHeight && dy < collisionHeight) {
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

    // Update UI stats
    if (state.clock.elapsedTime % 0.1 < delta) {
      setPlayerStats({
        speed: speed.current,
        altitude: group.current.position.y,
      });
    }
  });

  useFrame((state, delta) => {
    if (jetStatus === 'crashing' && group.current) {
        // Crashing physics
        playerVelocity.y -= 30 * delta; // Gravity
        group.current.position.addScaledVector(playerVelocity, delta);
        group.current.rotateX(0.05 * delta); // Slow tumble
        group.current.rotateZ(0.1 * delta);

        if (state.clock.elapsedTime % 0.05 < delta) {
            spawnParticle({
                position: group.current.position.clone(),
                type: 'smoke',
                createdAt: state.clock.elapsedTime,
                duration: 1.5
            });
        }

        const terrainHeight = getTerrainHeight(group.current.position.x, group.current.position.z);
        if (group.current.position.y <= terrainHeight + 2) {
            spawnParticle({
                position: group.current.position.clone(),
                type: 'explosion',
                createdAt: state.clock.elapsedTime,
                duration: 3
            });
            audioSynth.playExplosion();
            setJetStatus('hidden');
        }
    }
  });

  if (jetStatus === 'hidden') return null;

  return (
    <group ref={group} scale={4.0}>
      {/* Cockpit Interior - Only rendered when in cockpit view */}
      {useGameStore.getState().cameraMode === 'cockpit' && (
        <group position={[0, 0.2, -activeJet.length * 0.1]}>
          {/* Dashboard */}
          <mesh position={[0, -0.2, -0.6]} rotation={[-Math.PI / 4, 0, 0]}>
            <boxGeometry args={[1.2, 0.8, 0.1]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.2} />
          </mesh>
          
          {/* Instruments / Screens with glowing effect */}
          <mesh position={[0, -0.15, -0.54]} rotation={[-Math.PI / 4, 0, 0]}>
            <planeGeometry args={[1.0, 0.6]} />
            <meshBasicMaterial color="#001100" />
          </mesh>
          <mesh position={[0, -0.1, -0.53]} rotation={[-Math.PI / 4, 0, 0]}>
            <planeGeometry args={[0.8, 0.4]} />
            <meshBasicMaterial color="#00ff00" transparent opacity={0.3} />
          </mesh>
          
          {/* HUD Frame */}
          <group position={[0, 0.3, -0.6]}>
            <mesh position={[0, 0, 0]} rotation={[0.4, 0, 0]}>
              <planeGeometry args={[0.6, 0.4]} />
              <meshBasicMaterial color="#00ff00" transparent opacity={0.15} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 0, 0]} rotation={[0.4, 0, 0]}>
               <edgesGeometry args={[new THREE.PlaneGeometry(0.6, 0.4)]} />
               <lineBasicMaterial color="#00ff00" transparent opacity={0.4} />
            </mesh>
          </group>
          
          {/* Pilot Seat */}
          <mesh position={[0, -0.5, 0.4]}>
            <boxGeometry args={[0.8, 1.2, 0.6]} />
            <meshStandardMaterial color="#222" />
          </mesh>

          {/* Controls / Flight Stick */}
          <group position={[0, -0.3, -0.2]}>
             <mesh rotation={[0.4, 0, 0]}>
               <cylinderGeometry args={[0.03, 0.03, 0.6]} />
               <meshStandardMaterial color="#111" />
             </mesh>
             <mesh position={[0, 0.3, 0.05]}>
               <sphereGeometry args={[0.06]} />
               <meshStandardMaterial color="#333" />
             </mesh>
          </group>
        </group>
      )}

      <group visible={useGameStore.getState().cameraMode !== 'cockpit' || true}>
        {/* Fuselage */}
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[activeJet.id === 'bomber' ? 0.6 : 0.3, 0.5, activeJet.length, 16]} />
          <meshStandardMaterial color={activeJet.color} roughness={0.2} metalness={0.9} />
        </mesh>

        {/* Air Intake - specialized for jet types */}
        {activeJet.id === 'bomber' ? (
          <>
            <mesh position={[0.7, 0, activeJet.length * 0.3]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.4, 0.4, 1.2, 16]} />
              <meshStandardMaterial color="#202020" />
            </mesh>
            <mesh position={[-0.7, 0, activeJet.length * 0.3]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.4, 0.4, 1.2, 16]} />
              <meshStandardMaterial color="#202020" />
            </mesh>
          </>
        ) : activeJet.id === 'stealth' ? (
          <mesh position={[0, -0.2, -activeJet.length * 0.2]} castShadow receiveShadow>
            <boxGeometry args={[1.2, 0.4, 1.5]} />
            <meshStandardMaterial color="#101010" />
          </mesh>
        ) : (
          <mesh position={[0, -0.3, -activeJet.length * 0.1]} castShadow receiveShadow>
            <boxGeometry args={[0.8, 0.6, 1.2]} />
            <meshStandardMaterial color="#202020" roughness={0.3} metalness={0.7} />
          </mesh>
        )}

        {/* Bubble Canopy */}
        <mesh position={[0, activeJet.id === 'ww2' ? 0.5 : 0.4, -activeJet.length * 0.1]} castShadow receiveShadow>
          <sphereGeometry args={[0.35, 16, 16, 0, Math.PI * 2, 0, Math.PI / 1.5]} />
          <meshStandardMaterial 
            color={activeJet.id === 'stealth' ? "#000" : "#111122"} 
            roughness={0.1} 
            metalness={0.5} 
            transparent 
            opacity={useGameStore.getState().cameraMode === 'cockpit' ? 0.2 : 0.8} 
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Main Wings */}
        <mesh position={[0, 0, activeJet.length * 0.05]} rotation={[0, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[activeJet.wingSpan, 0.05, 1.5]} />
          <meshStandardMaterial color={activeJet.color} roughness={0.3} metalness={0.8} />
        </mesh>
        
        {/* Additional wing parts for specific jets */}
        {activeJet.id === 'tomcat' && (
          <mesh position={[0, 0, activeJet.length * 0.05]} rotation={[0, 0, 0]}>
             <boxGeometry args={[activeJet.wingSpan * 0.8, 0.04, 1.2]} />
             <meshStandardMaterial color={activeJet.color} />
          </mesh>
        )}

        {/* Tail Fins */}
        {activeJet.id === 'advanced' || activeJet.id === 'stealth' || activeJet.id === 'viper' ? (
          <>
            <mesh position={[0.5, 0.8, activeJet.length * 0.4]} rotation={[0, 0, 0.3]} castShadow receiveShadow>
              <boxGeometry args={[0.1, 1.5, 1.2]} />
              <meshStandardMaterial color={activeJet.color} />
            </mesh>
            <mesh position={[-0.5, 0.8, activeJet.length * 0.4]} rotation={[0, 0, -0.3]} castShadow receiveShadow>
              <boxGeometry args={[0.1, 1.5, 1.2]} />
              <meshStandardMaterial color={activeJet.color} />
            </mesh>
          </>
        ) : (
          <mesh position={[0, 1.0, activeJet.length * 0.4]} rotation={[0, 0, 0.1]} castShadow receiveShadow>
            <boxGeometry args={[0.1, 1.8, 1.2]} />
            <meshStandardMaterial color={activeJet.color} roughness={0.3} metalness={0.8} />
          </mesh>
        )}

        {/* Horizontal Stabilizers */}
        <mesh position={[0, 0.2, activeJet.length * 0.45]} castShadow receiveShadow>
          <boxGeometry args={[activeJet.wingSpan * 0.4, 0.05, 0.8]} />
          <meshStandardMaterial color={activeJet.color} roughness={0.3} metalness={0.8} />
        </mesh>

        {/* Engine Exhausts */}
        {activeJet.id === 'advanced' || activeJet.id === 'interceptor' || activeJet.id === 'tomcat' || activeJet.id === 'eagle' ? (
          <>
            <mesh position={[0.3, 0, activeJet.length * 0.5]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.2, 0.25, 0.6, 16]} />
              <meshStandardMaterial color="#404040" />
            </mesh>
            <mesh position={[-0.3, 0, activeJet.length * 0.5]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.2, 0.25, 0.6, 16]} />
              <meshStandardMaterial color="#404040" />
            </mesh>
          </>
        ) : (
          <mesh position={[0, 0, activeJet.length * 0.5]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.25, 0.35, 0.6, 16]} />
            <meshStandardMaterial color="#404040" roughness={0.1} metalness={0.9} />
          </mesh>
        )}

        {/* Engine glow */}
        <mesh ref={afterburnerGlow} position={[0, 0, activeJet.length * 0.5 + 0.3]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.3, 16]} />
          <meshBasicMaterial color="#ff6600" transparent opacity={0.8} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>
    </group>
  );
}
