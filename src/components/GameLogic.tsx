import React, { useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store';
import { audioSynth } from '../audio';
import { getTerrainHeight } from '../utils/terrain';

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
    if (playerPos.y < 0 && !useGameStore.getState().isEjected) {
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

  // ── Ejected Pilot Physics ──────────────────────────────────
  useFrame((state, delta) => {
    if (gameState !== 'playing') return;
    const store = useGameStore.getState();
    if (!store.isEjected) return;
    // Skip pilot physics during helicopter transport and repair
    if (['lifting', 'toHangar', 'landing', 'repairing', 'repaired'].includes(store.rescueState)) return;

    const pilotPos = store.pilotPos.clone();
    let velY = store.pilotVelocityY;

    // Parachute deployment — after 1.5 seconds of free fall
    if (!store.parachuteDeployed && (state.clock.elapsedTime - store.ejectionTime) > 1.5) {
      useGameStore.setState({ parachuteDeployed: true });
    }

    // Apply gravity
    const gravity = store.parachuteDeployed ? -5 : -20;
    velY += gravity * delta;

    // Terminal velocity with parachute
    if (store.parachuteDeployed && velY < -4) {
      velY = -4;
    }

    pilotPos.y += velY * delta;

    // Terrain landing check
    const terrainHeight = getTerrainHeight(pilotPos.x, pilotPos.z);
    if (pilotPos.y <= terrainHeight + 1.8) {
      pilotPos.y = terrainHeight + 1.8;
      velY = 0;
      if (!store.isOnGround) {
        useGameStore.setState({ isOnGround: true });
      }
    }

    useGameStore.setState({
      pilotPos,
      pilotVelocityY: velY,
    });

    // Ground movement (WASD) and mouse look
    if (store.isOnGround && store.rescueState === 'none') {
      // Mouse look
      const handleMouseMove = (e: MouseEvent) => {
        const s = useGameStore.getState();
        useGameStore.setState({
          pilotYaw: s.pilotYaw + e.movementX * 0.003,
          pilotPitch: Math.max(-Math.PI / 3, Math.min(Math.PI / 3, s.pilotPitch - e.movementY * 0.003)),
        });
      };
      // Only add once (check if already locked)
      if (document.pointerLockElement === null) {
        const canvas = document.querySelector('canvas');
        if (canvas) {
          canvas.requestPointerLock?.();
          document.addEventListener('mousemove', handleMouseMove);
          // Store cleanup ref
          (window as any).__pilotMouseHandler = handleMouseMove;
        }
      }
    }
  });

  // ── SOS / Rescue Calling (R key while on ground) ───────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const store = useGameStore.getState();
      if (store.gameState !== 'playing') return;

      if (e.code === store.keyMap.callRescue && store.isOnGround && !store.isRescueCalled && store.rescueState === 'none') {
        useGameStore.setState({
          isRescueCalled: true,
          sosFired: true,
          rescueState: 'incoming',
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      // Cleanup mouse handler
      if ((window as any).__pilotMouseHandler) {
        document.removeEventListener('mousemove', (window as any).__pilotMouseHandler);
        document.exitPointerLock?.();
      }
    };
  }, []);

  return null;
}
