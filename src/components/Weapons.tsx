import React, { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore, Projectile } from '../store';
import { Trail } from '@react-three/drei';

const BULLET_SPEED = 2000;
const MISSILE_SPEED = 1200;
const MISSILE_TURN_SPEED = 2.0;

function Bullet({ proj }: { proj: Projectile }) {
  const mesh = useRef<THREE.Mesh>(null);
  const removeProjectile = useGameStore(state => state.removeProjectile);
  const gameState = useGameStore(state => state.gameState);
  
  useFrame((state, delta) => {
    if (useGameStore.getState().gameState !== 'playing' || !mesh.current) return;
    
    // Move bullet
    mesh.current.position.addScaledVector(proj.velocity, delta);
    
    // Remove if too old (e.g. 2 seconds)
    if (state.clock.elapsedTime - proj.createdAt > 2) {
      removeProjectile(proj.id);
    }
  });

  return (
    <mesh ref={mesh} position={proj.position}>
      <sphereGeometry args={[0.2, 8, 8]} />
      <meshBasicMaterial color="#ffff00" />
    </mesh>
  );
}

function Missile({ proj }: { proj: Projectile }) {
  const group = useRef<THREE.Group>(null);
  const removeProjectile = useGameStore(state => state.removeProjectile);
  const spawnParticle = useGameStore(state => state.spawnParticle);
  const enemies = useGameStore(state => state.enemies);
  const gameState = useGameStore(state => state.gameState);
  const lastSmoke = useRef(0);
  
  useFrame((state, delta) => {
    if (useGameStore.getState().gameState !== 'playing' || !group.current) return;
    
    // Homing logic
    let targetPos: THREE.Vector3 | null = null;
    if (proj.owner === 'player' && proj.targetId) {
      const target = enemies.find(e => e.id === proj.targetId);
      if (target) targetPos = target.position;
    } else if (proj.owner === 'enemy') {
      const playerPos = useGameStore.getState().playerPos;
      targetPos = playerPos;
    }

    if (targetPos && group.current) {
        const directionToTarget = new THREE.Vector3().subVectors(targetPos, group.current.position).normalize();
        const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), directionToTarget);
        group.current.quaternion.slerp(targetQuaternion, delta * MISSILE_TURN_SPEED);
        
        // Update velocity based on new rotation
        proj.velocity.copy(new THREE.Vector3(0, 0, -1).applyQuaternion(group.current.quaternion)).multiplyScalar(MISSILE_SPEED);
    }
    
    // Move missile
    group.current.position.addScaledVector(proj.velocity, delta);
    
    // Spawn smoke trail
    if (state.clock.elapsedTime - lastSmoke.current > 0.05) {
      lastSmoke.current = state.clock.elapsedTime;
      spawnParticle({
        position: group.current.position.clone(),
        type: 'smoke',
        createdAt: state.clock.elapsedTime,
        duration: 1.0
      });
    }
    
    // Remove if too old (e.g. 10 seconds)
    if (state.clock.elapsedTime - proj.createdAt > 10) {
      removeProjectile(proj.id);
    }
  });

  return (
    <group ref={group} position={proj.position}>
      <mesh rotation={[Math.PI/2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 2, 8]} />
        <meshStandardMaterial color="#fff" />
      </mesh>
      {/* Missile trail */}
      <mesh position={[0, 0, 1.5]}>
        <sphereGeometry args={[0.3, 8, 8]} />
        <meshBasicMaterial color="#ffaa00" transparent opacity={0.6} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

export function Weapons() {
  const projectiles = useGameStore(state => state.projectiles);
  
  return (
    <>
      {projectiles.map(proj => (
        proj.type === 'bullet' ? 
          <Bullet key={proj.id} proj={proj} /> : 
          <Missile key={proj.id} proj={proj} />
      ))}
    </>
  );
}
