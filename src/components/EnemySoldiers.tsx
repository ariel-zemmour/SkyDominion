import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore, Soldier } from '../store';
import { getTerrainHeight } from '../utils/terrain';

const SOLDIER_SPEED = 4;
const SOLDIER_FIRE_RANGE = 80;
const SOLDIER_DETECT_RANGE = 120;

function EnemySoldier({ soldier }: { soldier: Soldier }) {
  const group = useRef<THREE.Group>(null);
  const walkPhase = useRef(Math.random() * Math.PI * 2);

  useFrame((state, delta) => {
    const store = useGameStore.getState();
    if (store.gameState !== 'playing' || !group.current) return;
    if (soldier.state === 'dead') return;

    const pilotPos = store.pilotPos;
    const distToPlayer = soldier.position.distanceTo(pilotPos);
    const isPlayerOnGround = store.isOnGround;
    const isEjected = store.isEjected;

    // State machine AI
    const now = state.clock.elapsedTime;

    if (isEjected) {
      if (distToPlayer < SOLDIER_DETECT_RANGE) {
        // Enter combat mode
        if (soldier.state !== 'combat') {
          store.updateSoldier(soldier.id, { state: 'combat', lastStateChange: now });
        }
      } else if (soldier.state === 'combat' && distToPlayer > SOLDIER_DETECT_RANGE * 1.5) {
        // Lose interest
        store.updateSoldier(soldier.id, { state: 'patrol', lastStateChange: now });
      }
    }

    // Behavior based on state
    switch (soldier.state) {
      case 'idle': {
        // Occasionally start patrolling
        if (now - soldier.lastStateChange > 3 + Math.random() * 4) {
          const angle = Math.random() * Math.PI * 2;
          const patrolDist = 20 + Math.random() * 30;
          store.updateSoldier(soldier.id, {
            state: 'patrol',
            targetPos: new THREE.Vector3(
              soldier.position.x + Math.cos(angle) * patrolDist,
              0,
              soldier.position.z + Math.sin(angle) * patrolDist
            ),
            lastStateChange: now,
          });
        }
        break;
      }

      case 'patrol': {
        // Walk towards target
        const dir = new THREE.Vector3().subVectors(soldier.targetPos, soldier.position);
        dir.y = 0;
        const dist = dir.length();

        if (dist > 1) {
          dir.normalize();
          const newPos = soldier.position.clone().addScaledVector(dir, SOLDIER_SPEED * delta);
          newPos.y = getTerrainHeight(newPos.x, newPos.z);
          soldier.position.copy(newPos);

          // Face movement direction
          if (group.current) {
            group.current.rotation.y = Math.atan2(dir.x, dir.z);
          }
        } else {
          // Reached target — go idle
          store.updateSoldier(soldier.id, { state: 'idle', lastStateChange: now });
        }
        break;
      }

      case 'combat': {
        // Face the player
        const dirToPlayer = new THREE.Vector3().subVectors(pilotPos, soldier.position);
        dirToPlayer.y = 0;
        const facingAngle = Math.atan2(dirToPlayer.x, dirToPlayer.z);

        if (group.current) {
          group.current.rotation.y = facingAngle;
        }

        // Strafe movement (dodge left/right periodically)
        const strafeDir = new THREE.Vector3(
          Math.cos(facingAngle + Math.PI / 2),
          0,
          Math.sin(facingAngle + Math.PI / 2)
        );
        const strafeFactor = Math.sin(now * 2 + soldier.lastStateChange) * 0.5;
        const newPos = soldier.position.clone().addScaledVector(strafeDir, strafeFactor * SOLDIER_SPEED * delta);

        // Also move closer if far, retreat if too close
        if (distToPlayer > SOLDIER_FIRE_RANGE * 0.7) {
          dirToPlayer.normalize();
          newPos.addScaledVector(dirToPlayer, SOLDIER_SPEED * 0.6 * delta);
        } else if (distToPlayer < 15) {
          dirToPlayer.normalize();
          newPos.addScaledVector(dirToPlayer, -SOLDIER_SPEED * 0.8 * delta);
        }

        newPos.y = getTerrainHeight(newPos.x, newPos.z);
        soldier.position.copy(newPos);

        // Shoot at player
        if (distToPlayer < SOLDIER_FIRE_RANGE && now - soldier.lastFired > 1.5 + Math.random() * 1.5) {
          store.updateSoldier(soldier.id, { lastFired: now });

          const shootDir = new THREE.Vector3().subVectors(pilotPos, soldier.position).normalize();
          // Add some inaccuracy
          shootDir.x += (Math.random() - 0.5) * 0.15;
          shootDir.y += (Math.random() - 0.5) * 0.1;
          shootDir.z += (Math.random() - 0.5) * 0.15;
          shootDir.normalize();

          store.fireProjectile({
            position: soldier.position.clone().add(new THREE.Vector3(0, 1.5, 0)).add(shootDir.clone().multiplyScalar(1)),
            velocity: shootDir.multiplyScalar(300),
            type: 'bullet',
            owner: 'enemy',
            createdAt: now,
          });
        }
        break;
      }
    }

    // Update visual position
    if (group.current) {
      group.current.position.copy(soldier.position);
      // Walking animation
      walkPhase.current += delta * 8;
    }
  });

  if (soldier.state === 'dead') {
    // Show dead body briefly
    return (
      <group position={soldier.position}>
        <mesh position={[0, 0.15, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <boxGeometry args={[0.5, 1.5, 0.3]} />
          <meshStandardMaterial color="#4a3a2a" />
        </mesh>
      </group>
    );
  }

  const isCombat = soldier.state === 'combat';

  return (
    <group ref={group} position={soldier.position}>
      {/* Body */}
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[0.5, 0.7, 0.3]} />
        <meshStandardMaterial color={isCombat ? '#5a2a1a' : '#4a4a3a'} roughness={0.9} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.45, 0]}>
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshStandardMaterial color="#c4956a" roughness={0.7} />
      </mesh>
      {/* Helmet */}
      <mesh position={[0, 1.55, 0]}>
        <sphereGeometry args={[0.18, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={isCombat ? '#4a2a1a' : '#3a3a2a'} roughness={0.5} />
      </mesh>
      {/* Legs */}
      <mesh position={[0.1, 0.3, 0]}>
        <boxGeometry args={[0.15, 0.5, 0.15]} />
        <meshStandardMaterial color="#3a3a2a" roughness={0.9} />
      </mesh>
      <mesh position={[-0.1, 0.3, 0]}>
        <boxGeometry args={[0.15, 0.5, 0.15]} />
        <meshStandardMaterial color="#3a3a2a" roughness={0.9} />
      </mesh>
      {/* Weapon */}
      {isCombat && (
        <group position={[0.25, 0.85, -0.3]} rotation={[0.3, 0, 0.1]}>
          <mesh>
            <boxGeometry args={[0.04, 0.04, 0.6]} />
            <meshStandardMaterial color="#222" metalness={0.8} roughness={0.2} />
          </mesh>
        </group>
      )}
      {/* Health bar */}
      {soldier.health < 100 && (
        <group position={[0, 2, 0]}>
          <mesh position={[0, 0, 0]}>
            <planeGeometry args={[0.8, 0.08]} />
            <meshBasicMaterial color="#333" />
          </mesh>
          <mesh position={[(soldier.health / 100 - 1) * 0.4, 0, 0.001]}>
            <planeGeometry args={[(soldier.health / 100) * 0.8, 0.08]} />
            <meshBasicMaterial color={soldier.health > 50 ? '#00ff00' : soldier.health > 25 ? '#ffaa00' : '#ff0000'} />
          </mesh>
        </group>
      )}
    </group>
  );
}

export function EnemySoldiers() {
  const soldiers = useGameStore(state => state.soldiers);

  return (
    <>
      {soldiers.map(soldier => (
        <EnemySoldier key={soldier.id} soldier={soldier} />
      ))}
    </>
  );
}
