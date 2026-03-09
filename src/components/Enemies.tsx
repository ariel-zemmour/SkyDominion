import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore, Enemy } from '../store';
import { getTranslation } from '../i18n';

import { Html } from '@react-three/drei';

const ENEMY_SPEED = 250;
const ENEMY_TURN_SPEED = 1.0;

function EnemyFighter({ enemy }: { enemy: Enemy }) {
  const group = useRef<THREE.Group>(null);
  const playerPos = useGameStore(state => state.playerPos);
  const lockedTargetId = useGameStore(state => state.lockedTargetId);
  const isLocked = lockedTargetId === enemy.id;
  const language = useGameStore(state => state.language);
  
  const fireProjectile = useGameStore(state => state.fireProjectile);
  
  const distanceRef = useRef<HTMLDivElement>(null);
  
  useFrame((state, delta) => {
    if (useGameStore.getState().gameState !== 'playing' || !group.current) return;
    
    // Simple AI: fly towards player
    const directionToPlayer = new THREE.Vector3().subVectors(playerPos, group.current.position).normalize();
    
    // Calculate desired rotation
    const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), directionToPlayer);
    
    // Slerp towards target rotation
    group.current.quaternion.slerp(targetQuaternion, delta * ENEMY_TURN_SPEED);
    
    // Move forward
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(group.current.quaternion);
    group.current.position.addScaledVector(forward, ENEMY_SPEED * delta);
    
    // Update store state (optional, but good for collision detection later)
    enemy.position.copy(group.current.position);
    enemy.rotation.copy(group.current.quaternion);
    enemy.velocity.copy(forward).multiplyScalar(ENEMY_SPEED);

    // Shooting
    const distToPlayer = group.current.position.distanceTo(playerPos);
    const angleToPlayer = forward.angleTo(directionToPlayer);
    
    if (distToPlayer < 3000 && angleToPlayer < 0.2 && state.clock.elapsedTime - enemy.lastFired > 2) {
      enemy.lastFired = state.clock.elapsedTime;
      
      // Randomly choose between bullet and missile
      const type = Math.random() > 0.7 ? 'missile' : 'bullet';
      
      fireProjectile({
        position: group.current.position.clone().add(forward.clone().multiplyScalar(10)),
        velocity: forward.clone().multiplyScalar(type === 'missile' ? 1200 : 2000).add(enemy.velocity),
        type: type,
        owner: 'enemy',
        targetId: type === 'missile' ? 'player' : undefined,
        createdAt: state.clock.elapsedTime
      });
    }

    if (distanceRef.current) {
      const tgt = getTranslation(language, 'tgt');
      const m = getTranslation(language, 'm');
      distanceRef.current.innerText = `${tgt} ${Math.round(distToPlayer)}${m}`;
    }
  });

  return (
    <group ref={group} position={enemy.position} quaternion={enemy.rotation}>
      {/* Fuselage (main body) */}
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.5, 0.7, 6, 16]} />
        <meshStandardMaterial color="#880000" roughness={0.3} metalness={0.8} />
      </mesh>

      {/* Cockpit */}
      <mesh position={[0, 0.3, -1.5]} castShadow receiveShadow>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial color="#ff2222" transparent opacity={0.7} />
      </mesh>

      {/* Main Wings */}
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[4, 0.1, 1.5]} />
        <meshStandardMaterial color="#660000" />
      </mesh>

      {/* Tail vertical stabilizer */}
      <mesh position={[0, 0.6, 2.5]} castShadow receiveShadow>
        <boxGeometry args={[0.2, 1, 0.8]} />
        <meshStandardMaterial color="#660000" />
      </mesh>

      {/* Tail horizontal stabilizers */}
      <mesh position={[0, 0.2, 2.5]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.1, 0.6]} />
        <meshStandardMaterial color="#660000" />
      </mesh>

      {/* Engine glow */}
      <mesh position={[0, 0, 3.2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.4, 0.4, 0.5, 16]} />
        <meshBasicMaterial color="#ff6600" transparent opacity={0.8} blending={THREE.AdditiveBlending} />
      </mesh>

      {/* Heat blur */}
      <mesh position={[0, 0, 4.5]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.5, 0.1, 3, 16]} />
        <meshPhysicalMaterial 
          transmission={1} 
          roughness={0.4} 
          thickness={2} 
          ior={1.2} 
          transparent 
          opacity={0.5} 
        />
      </mesh>
      
      <Html center zIndexRange={[100, 0]}>
        <div className={`w-16 h-16 border-2 ${isLocked ? 'border-red-500 animate-pulse' : 'border-green-500/50'} rounded-sm flex items-center justify-center`}>
          {isLocked && <div className="w-2 h-2 bg-red-500 rounded-full"></div>}
          <div ref={distanceRef} className="absolute -bottom-6 text-xs font-mono text-white whitespace-nowrap bg-black/50 px-1" dir={language === 'he' ? 'rtl' : 'ltr'}>
            {getTranslation(language, 'tgt')} 0{getTranslation(language, 'm')}
          </div>
        </div>
      </Html>
    </group>
  );
}

export function Enemies() {
  const enemies = useGameStore(state => state.enemies);
  
  return (
    <>
      {enemies.map(enemy => (
        <EnemyFighter key={enemy.id} enemy={enemy} />
      ))}
    </>
  );
}
