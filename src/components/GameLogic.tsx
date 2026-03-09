import React, { useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store';
import { audioSynth } from '../audio';

export function GameLogic() {
  const gameState = useGameStore(state => state.gameState);
  const setGameState = useGameStore(state => state.setGameState);
  const playerPos = useGameStore(state => state.playerPos);
  const enemies = useGameStore(state => state.enemies);
  const spawnEnemy = useGameStore(state => state.spawnEnemy);
  const removeEnemy = useGameStore(state => state.removeEnemy);
  const projectiles = useGameStore(state => state.projectiles);
  const removeProjectile = useGameStore(state => state.removeProjectile);
  const spawnParticle = useGameStore(state => state.spawnParticle);
  const setPlayerStats = useGameStore(state => state.setPlayerStats);
  const health = useGameStore(state => state.health);
  const score = useGameStore(state => state.score);
  const trophies = useGameStore(state => state.trophies);
  const saveProgress = useGameStore(state => state.saveProgress);

  const setLockedTargetId = useGameStore(state => state.setLockedTargetId);
  const lockedTargetId = useGameStore(state => state.lockedTargetId);
  const buildings = useGameStore(state => state.buildings);

  const lastSurvivalReward = React.useRef(0);

  // Survival rewards logic
  useEffect(() => {
    if (gameState === 'playing') {
      lastSurvivalReward.current = Date.now();
    }
  }, [gameState]);

  useFrame(() => {
    if (gameState !== 'playing') return;

    const now = Date.now();
    if (now - lastSurvivalReward.current >= 10000) {
      lastSurvivalReward.current = now;
      const currentTrophies = useGameStore.getState().trophies;
      setPlayerStats({ trophies: currentTrophies + 50 });
      saveProgress();
    }
  });

  // Spawning logic
  useEffect(() => {
    if (gameState !== 'playing') return;
    
    // Initialize buildings
    if (buildings.length === 0) {
      const newBuildings = [];
      for (let i = 0; i < 50; i++) {
        newBuildings.push({
          id: Math.random().toString(36).substring(7),
          position: new THREE.Vector3((Math.random() - 0.5) * 5000, 50, (Math.random() - 0.5) * 5000),
          health: 100
        });
      }
      useGameStore.setState({ buildings: newBuildings });
    }

    const interval = setInterval(() => {
      if (enemies.length < 5) {
        // Spawn enemy around player
        const angle = Math.random() * Math.PI * 2;
        const distance = 2000 + Math.random() * 2000;
        const x = playerPos.x + Math.cos(angle) * distance;
        const z = playerPos.z + Math.sin(angle) * distance;
        const y = playerPos.y + (Math.random() - 0.5) * 1000;

        spawnEnemy({
          position: new THREE.Vector3(x, y, z),
          rotation: new THREE.Quaternion(),
          velocity: new THREE.Vector3(),
          health: 100,
          type: 'fighter',
          lastFired: 0
        });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [gameState, enemies.length, playerPos, spawnEnemy]);

  // Collision logic
  useFrame((state) => {
    if (gameState !== 'playing') return;

    // Target locking logic
    let bestTarget = null;
    let bestAngle = Math.PI / 8; // Max lock angle (22.5 degrees)

    const playerForward = new THREE.Vector3(0, 0, -1).applyQuaternion(useGameStore.getState().playerRot);

    enemies.forEach(enemy => {
      const directionToEnemy = new THREE.Vector3().subVectors(enemy.position, playerPos).normalize();
      const angle = playerForward.angleTo(directionToEnemy);
      const dist = playerPos.distanceTo(enemy.position);

      if (angle < bestAngle && dist < 10000) {
        bestAngle = angle;
        bestTarget = enemy.id;
      }
    });

    if (bestTarget !== lockedTargetId) {
      setLockedTargetId(bestTarget);
    }

    // Check projectiles vs enemies
    projectiles.forEach(proj => {
      if (proj.owner === 'player') {
        enemies.forEach(enemy => {
          const dist = proj.position.distanceTo(enemy.position);
          if (dist < 20) { // Hit radius
            // Hit!
            removeProjectile(proj.id);
            audioSynth.playExplosion();
            spawnParticle({
              position: enemy.position.clone(),
              type: 'explosion',
              createdAt: state.clock.elapsedTime,
              duration: 2
            });
            spawnParticle({
              position: enemy.position.clone(),
              type: 'fire',
              createdAt: state.clock.elapsedTime,
              duration: 3
            });
            spawnParticle({
              position: enemy.position.clone(),
              type: 'smoke',
              createdAt: state.clock.elapsedTime,
              duration: 4
            });
            removeEnemy(enemy.id);
            const currentTrophies = useGameStore.getState().trophies;
            setPlayerStats({ 
              score: score + 100,
              trophies: currentTrophies + 100 
            });
            saveProgress();
          }
        });
        
        // Check building collision
        if (proj.type === 'ground-missile' || proj.type === 'missile' || proj.type === 'bullet') {
          buildings.forEach(building => {
            const dist = proj.position.distanceTo(building.position);
            if (dist < 50) {
              removeProjectile(proj.id);
              audioSynth.playExplosion();
              spawnParticle({
                position: building.position.clone(),
                type: 'explosion',
                createdAt: state.clock.elapsedTime,
                duration: 2
              });
              useGameStore.getState().destroyBuilding(building.id);
              setPlayerStats({ score: score + 50, trophies: useGameStore.getState().trophies + 1 });
            }
          });
        }
      } else if (proj.owner === 'enemy') {
        const dist = proj.position.distanceTo(playerPos);
        if (dist < 40) {
          removeProjectile(proj.id);
          audioSynth.playExplosion();
          const newHealth = health - 20;
          setPlayerStats({ health: newHealth });
          if (newHealth <= 0) {
            setGameState('gameover');
            audioSynth.stopEngine();
          }
        }
      }
    });

    // Check player vs ground
    if (playerPos.y < 0) {
      setGameState('gameover');
      audioSynth.stopEngine();
      audioSynth.playExplosion();
      spawnParticle({
        position: playerPos.clone(),
        type: 'explosion',
        createdAt: state.clock.elapsedTime,
        duration: 3
      });
      spawnParticle({
        position: playerPos.clone(),
        type: 'fire',
        createdAt: state.clock.elapsedTime,
        duration: 4
      });
      spawnParticle({
        position: playerPos.clone(),
        type: 'smoke',
        createdAt: state.clock.elapsedTime,
        duration: 5
      });
    }
  });

  return null;
}
